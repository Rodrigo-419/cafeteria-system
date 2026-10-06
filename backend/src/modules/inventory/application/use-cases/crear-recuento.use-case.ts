import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  exigirAccesoSucursal,
  type ActorInventario,
} from '../../domain/rules/alcance-inventario';
import {
  calcularDiferencia,
  cantidadATexto,
  diferenciaEsCero,
  problemasCantidad,
  tipoProblemasCantidad,
} from '../../domain/rules/cantidades';
import {
  exigirInsumoOperativo,
  INSUMO_NO_ACTIVADO_EN_SUCURSAL,
} from '../../domain/rules/operatividad-insumo';
import {
  InventoryRepository,
  type ClienteInventario,
  type DetalleRecuentoEntrada,
  type MovimientoEntrada,
  type RecuentoFila,
  type StockFila,
 } from '../../infrastructure/inventory.repository';
import { ReevaluarAlertasService } from './reevaluar-alertas.service';

/** Motivo con el que se registran los ajustes que provoca un recuento. */
export const MOTIVO_AJUSTE_RECUENTO = 'Ajuste por recuento fisico';

export type LineaRecuento = {
  insumoId: string;
  stockFisico: number;
};

export type EntradaCrearRecuento = {
  /** Ids de `insumo`, no de `insumo_sucursal`: quien cuenta conoce el catalogo. */
  items: LineaRecuento[];
};

/**
 * Caso de uso: registrar un recuento fisico y ajustar el stock a lo contado.
 *
 * Es lo unico que puede BAJAR el stock. Una entrada solo suma; restar porque
 * "creo que sobraba" no deja constancia de nada. Un recuento si: quedan
 * guardados el stock que tenia el sistema, el que se conto y la diferencia.
 *
 * Todo el recuento va en una sola transaccion, con tres garantias:
 *
 *   1. `SELECT ... FOR UPDATE` sobre las filas implicadas ANTES de leerlas. Sin
 *      ese bloqueo explicito, dos recuentos simultaneos leerian el mismo stock de
 *      sistema y el segundo machacaria el ajuste del primero. Se bloquean todas
 *      las filas de golpe y la base las ordena por id, para que dos recuentos
 *      que incluyan los mismos insumos no se esperen en sentidos opuestos.
 *   2. Los detalles guardan el stock de sistema leido YA bajo el bloqueo, de
 *      modo que `stock_sistema` es de verdad el valor que se sustituyo y no una
 *      foto anterior al ajuste.
 *   3. Si algo falla a mitad, no queda ni el recuento, ni el stock movido, ni
 *      los movimientos de ajuste.
 *
 * Una linea con diferencia cero NO genera movimiento: no hubo cambio de stock y
 * un movimiento de 0 solo inflaria el historico. La linea se guarda igualmente,
 * porque contar un insumo y que cuadre tambien es informacion.
 */
@Injectable()
export class CrearRecuentoUseCase {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly reevaluarAlertasService: ReevaluarAlertasService,
  ) {}

  async ejecutar(
    actor: ActorInventario,
    sucursalId: string,
    entrada: EntradaCrearRecuento,
  ): Promise<RecuentoFila> {
    exigirAccesoSucursal(actor, sucursalId);

    const items = this.validarItems(entrada.items);

    return this.inventoryRepository.enTransaccion(async (cliente) => {
      await this.exigirSucursal(sucursalId, cliente);
      await this.exigirInsumosEnCatalogo(items, cliente);

      const stockPorInsumo = await this.leerStockBloqueado(
        items,
        sucursalId,
        cliente,
      );

      const detalles: DetalleRecuentoEntrada[] = [];
      const ajustes: MovimientoEntrada[] = [];
      const filasMovidas: StockFila[] = [];

      for (const item of items) {
        const fila = stockPorInsumo.get(item.insumoId);

        if (!fila) {
          // Esta en el catalogo pero no dado de alta en esta sucursal: no hay
          // stock que sustituir. 404, no 409.
          throw new NotFoundException(INSUMO_NO_ACTIVADO_EN_SUCURSAL);
        }

        // Descontinuado: 409.
        exigirInsumoOperativo(fila.estado);

        // El repositorio ya entrega los decimales como texto con dos decimales,
        // asi que el stock de sistema va directo a la linea del recuento.
        const stockSistema = fila.stockActual;
        const stockFisico = cantidadATexto(item.stockFisico);
        const diferencia = calcularDiferencia(stockFisico, stockSistema);

        detalles.push({
          insumoSucursalId: fila.id,
          stockSistema,
          stockFisico,
          diferencia,
        });

        if (diferenciaEsCero(diferencia)) {
          continue;
        }

        // Se fija el stock, no se incrementa: es el valor contado, no una suma.
        await this.inventoryRepository.fijarStock(fila.id, stockFisico, cliente);

        ajustes.push({
          insumoSucursalId: fila.id,
          tipo: 'ajuste',
          cantidad: diferencia,
          usuarioId: actor.id,
          motivo: MOTIVO_AJUSTE_RECUENTO,
        });

        filasMovidas.push(fila);
      }

      const recuento = await this.inventoryRepository.crearRecuento(
        { sucursalId, usuarioId: actor.id, detalles },
        cliente,
      );

      await this.inventoryRepository.crearMovimientos(ajustes, cliente);

      // Solo las filas que de verdad cambiaron. Una linea que quadraba no puede
      // abrir ni cerrar una alerta: su stock no se ha movido.
      for (const fila of filasMovidas) {
        await this.reevaluarAlertasService.ejecutar(fila.id, cliente);
      }

      return recuento;
    });
  }

  /**
   * Comprueba las lineas antes de abrir la transaccion.
   *
   * Un cuerpo invalido (vacio, con el mismo insumo dos veces, con un fisico
   * negativo) es un 400 de peticion, no un fallo de negocio: se rechaza antes de
   * tocar la base para no dejar bloqueos ni escrituras a medias.
   */
  private validarItems(items: LineaRecuento[]): LineaRecuento[] {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('El recuento debe incluir al menos un insumo');
    }

    const vistos = new Set<string>();

    return items.map((item) => {
      const insumoId = item.insumoId?.trim() ?? '';

      if (insumoId === '') {
        throw new BadRequestException('Cada linea debe indicar el insumo contado');
      }

      // Contar el mismo insumo dos veces en una peticion no tiene sentido: la
      // segunda linea machacaria el ajuste de la primera.
      if (vistos.has(insumoId)) {
        throw new BadRequestException('El recuento incluye el mismo insumo mas de una vez');
      }

      vistos.add(insumoId);

      // El fisico admite cero: "no queda ninguno" es un resultado legitimo.
      const problemas = problemasCantidad(
        item.stockFisico,
        tipoProblemasCantidad.noNegativa,
      );

      if (problemas.length > 0) {
        throw new BadRequestException({
          message: `El stock fisico del insumo ${insumoId} no es valido`,
          problemas,
        });
      }

      return { insumoId, stockFisico: item.stockFisico };
    });
  }

  /**
   * Bloquea las filas de stock y devuelve su estado ya bloqueado, indexado por
   * `insumo_id` para emparejarlo con las lineas peticiones.
   *
   * Puede faltar alguna: un insumo del catalogo que no esta dado de alta en esta
   * sucursal no tiene fila, y por tanto no hay nada que bloquear. El 404 lo lanza
   * despues el bucle principal, ya con el id que falta.
   */
  private async leerStockBloqueado(
    items: LineaRecuento[],
    sucursalId: string,
    cliente: ClienteInventario,
  ): Promise<Map<string, StockFila>> {
    const idsBloqueados = await this.inventoryRepository.bloquearStocks(
      items.map((item) => item.insumoId),
      sucursalId,
      cliente,
    );

    const filas = await this.inventoryRepository.buscarStocksPorIds(
      idsBloqueados,
      cliente,
    );

    return new Map(filas.map((fila) => [fila.insumoId, fila]));
  }

  private async exigirSucursal(
    sucursalId: string,
    cliente: ClienteInventario,
  ): Promise<void> {
    if (!(await this.inventoryRepository.existeSucursal(sucursalId, cliente))) {
      throw new NotFoundException('La sucursal no existe');
    }
  }

  /** Una sola consulta para todas las lineas, no una por insumo. */
  private async exigirInsumosEnCatalogo(
    items: LineaRecuento[],
    cliente: ClienteInventario,
  ): Promise<void> {
    const ids = items.map((item) => item.insumoId);
    const existentes = await this.inventoryRepository.contarInsumosPorIds(ids, cliente);

    if (existentes !== ids.length) {
      throw new NotFoundException('El insumo no existe');
    }
  }
}
