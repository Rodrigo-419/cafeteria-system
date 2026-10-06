import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  exigirAccesoSucursal,
  type ActorInventario,
} from '../../domain/rules/alcance-inventario';
import {
  cantidadATexto,
  problemasCantidad,
  tipoProblemasCantidad,
} from '../../domain/rules/cantidades';
import { exigirInsumoOperativo, INSUMO_NO_ACTIVADO_EN_SUCURSAL } from '../../domain/rules/operatividad-insumo';
import {
  InventoryRepository,
  type MovimientoFila,
  type StockFila,
 } from '../../infrastructure/inventory.repository';
import { ReevaluarAlertasService } from './reevaluar-alertas.service';

/** Motivo que se guarda cuando el cliente no indica uno. */
export const MOTIVO_ENTRADA_POR_DEFECTO = 'Entrada de inventario';

/** Lo que devuelve la entrada: el stock ya subi y el movimiento que lo explica. */
export type ResultadoEntrada = {
  stock: StockFila;
  movimiento: MovimientoFila;
};

/**
 * Caso de uso: registrar una entrada de stock.
 *
 * Incrementa el stock y deja el movimiento que explica el incremento. Las dos
 * cosas van en la misma transaccion: un stock subido sin movimiento pierde la
 * trazabilidad de donde salio, y un movimiento sin stock subido miente.
 *
 * Una entrada siempre suma, nunca resta. La cantidad tiene que ser mayor que
 * cero: "registrar una entrada de 0 unidades" no es una entrada. Para restar hay
 * que contar fisicamente (`POST /inventario/recuentos`), que es lo que deja
 * constancia de lo que habia de verdad en la estanteria.
 *
 * Al subir el stock puede abrirse una alerta (si estaba en o por debajo del
 * minimo) o resolverse la que hubiera (si el stock queda por encima). Se
 * evalua dentro de la misma transaccion del incremento.
 */
@Injectable()
export class RegistrarEntradaUseCase {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly reevaluarAlertasService: ReevaluarAlertasService,
  ) {}

  async ejecutar(
    actor: ActorInventario,
    sucursalId: string,
    insumoId: string,
    entrada: { cantidad: number; motivo?: string },
  ): Promise<ResultadoEntrada> {
    exigirAccesoSucursal(actor, sucursalId);

    const cantidad = this.validarCantidad(entrada.cantidad);
    const motivo = this.normalizarMotivo(entrada.motivo);

    return this.inventoryRepository.enTransaccion(async (cliente) => {
      // El alcance ya esta comprobado, pero el insumo puede no existir en la
      // base: 404. Descontinuado: 409. Sin fila o descontinuado no entra.
      const fila = await this.inventoryRepository.buscarStock(
        insumoId,
        sucursalId,
        cliente,
      );

      if (!fila) {
        // El insumo existe en el catalogo pero no esta dado de alta aqui: no hay
        // stock sobre el que Increase. Se responde 404, no 409.
        throw new NotFoundException(INSUMO_NO_ACTIVADO_EN_SUCURSAL);
      }

      // Descontinuado en esta sucursal: existe pero no se repone. 409.
      exigirInsumoOperativo(fila.estado);

      // `increment` lo resuelve la base: dos entradas simultaneas sobre la misma
      // fila se sumarian bien sin tocar la lectura previa.
      const stock = await this.inventoryRepository.incrementarStock(
        fila.id,
        cantidad,
        cliente,
      );

      const movimiento = await this.inventoryRepository.crearMovimiento(
        {
          insumoSucursalId: fila.id,
          tipo: 'entrada',
          cantidad,
          usuarioId: actor.id,
          motivo,
        },
        cliente,
      );

      await this.reevaluarAlertasService.ejecutar(fila.id, cliente);

      return { stock, movimiento };
    });
  }

  private validarCantidad(valor: number): string {
    const problemas = problemasCantidad(valor, tipoProblemasCantidad.positiva);

    if (problemas.length > 0) {
      throw new BadRequestException({ message: 'La cantidad no es valida', problemas });
    }

    return cantidadATexto(valor);
  }

  /**
   * `motivo` es NOT NULL en la base, asi que siempre tiene que haber uno. Si no
   * llega se guarda un texto generico en vez de rechazar la peticion: la entrada
   * es valida, lo que falta es la explicacion, y un motivo por defecto es mejor
   * que bloquear la operacion.
   */
  private normalizarMotivo(motivo: string | undefined): string {
    const limpio = motivo?.trim();

    return limpio !== undefined && limpio !== '' ? limpio : MOTIVO_ENTRADA_POR_DEFECTO;
  }
}
