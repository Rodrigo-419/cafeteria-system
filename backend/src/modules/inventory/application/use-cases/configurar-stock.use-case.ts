import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaRepository } from '../../../auditoria/infrastructure/auditoria.repository';
import {
  exigirAccesoSucursal,
  type ActorInventario,
} from '../../domain/rules/alcance-inventario';
import {
  ESTADOS_INSUMO_SUCURSAL,
  esEstadoStockInsumo,
  type EstadoStockInsumo,
} from '../../domain/rules/estados-insumo';
import {
  cantidadATexto,
  problemasCantidad,
  tipoProblemasCantidad,
} from '../../domain/rules/cantidades';
import {
  InventoryRepository,
  type ClienteInventario,
  type StockFila,
} from '../../infrastructure/inventory.repository';
import { ReevaluarAlertasService } from './reevaluar-alertas.service';

/**
 * Caso de uso: dar de alta un insumo en una sucursal y ajustar su configuracion.
 *
 * Sirve para tres cosas distintas con un solo endpoint:
 *   * activar un insumo que aun no estaba en la sucursal (la fila nace con
 *     stock 0 y estado activo),
 *   * cambiar su `stock_minimo`,
 *   * descontinuarlo o volverlo a activar.
 *
 * Se puede pedir solo una de las dos. Si solo llega `estado`, el minimo no se
 * toca: mandarlo con su valor por defecto (0) borraria el que el usuario hubiera
 * fijado antes.
 *
 * Al mover el minimo o el estado hay que revisar la alerta, porque cualquiera de
 * las dos cosas puede disparar una nueva o cerrar la anterior. La revision va
 * DENTRO de la misma transaccion que el cambio: por separado, un cambio que abre
 * alerta y otro que la resuelve podrian pisarse.
 */
@Injectable()
export class ConfigurarStockUseCase {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly reevaluarAlertasService: ReevaluarAlertasService,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  async ejecutar(
    actor: ActorInventario,
    sucursalId: string,
    insumoId: string,
    entrada: { stockMinimo?: number; estado?: string },
  ): Promise<StockFila> {
    exigirAccesoSucursal(actor, sucursalId);

    const stockMinimo = this.validarStockMinimo(entrada.stockMinimo);
    const estado = this.validarEstado(entrada.estado);

    if (stockMinimo === undefined && estado === undefined) {
      throw new BadRequestException(
        'Indica al menos el stock minimo o el estado del insumo',
      );
    }

    return this.inventoryRepository.enTransaccion(async (cliente) => {
      await this.exigirSucursal(sucursalId, cliente);
      await this.exigirInsumo(insumoId, cliente);

      // Fila previa (o null si el insumo no estaba dado de alta aqui): distingue
      // un alta de un cambio y permite registrar que campos se movieron.
      const previa = await this.inventoryRepository.buscarStock(
        insumoId,
        sucursalId,
        cliente,
      );

      const fila = await this.inventoryRepository.configurarStock(
        insumoId,
        sucursalId,
        {
          ...(stockMinimo !== undefined ? { stockMinimo } : {}),
          ...(estado !== undefined ? { estado } : {}),
        },
        cliente,
      );

      await this.registrarAuditoria(actor.id, sucursalId, previa, fila, cliente);

      await this.reevaluarAlertasService.ejecutar(fila.id, cliente);

      return fila;
    });
  }

  /**
   * Deja el evento (o eventos) de la configuracion, en la misma transaccion.
   *
   * Un alta emite `insumo_sucursal_creado`. Un cambio puede mover el minimo y el
   * estado a la vez, y entonces emite un evento por cada campo que cambio: asi el
   * historial distingue "cambiar el minimo" de "descontinuar", que son decisiones
   * distintas aunque lleguen en la misma peticion.
   */
  private async registrarAuditoria(
    actorId: string,
    sucursalId: string,
    previa: StockFila | null,
    fila: StockFila,
    cliente: ClienteInventario,
  ): Promise<void> {
    if (previa === null) {
      await this.auditoria.registrar(
        {
          entidad: 'insumo_sucursal',
          entidadId: fila.id,
          accion: 'insumo_sucursal_creado',
          actorId,
          sucursalAfectadaId: sucursalId,
          detalle: {
            despues: { stockMinimo: fila.stockMinimo, estado: fila.estado },
          },
        },
        cliente,
      );

      return;
    }

    if (fila.stockMinimo !== previa.stockMinimo) {
      await this.auditoria.registrar(
        {
          entidad: 'insumo_sucursal',
          entidadId: fila.id,
          accion: 'insumo_sucursal_stock_minimo_cambiado',
          actorId,
          sucursalAfectadaId: sucursalId,
          detalle: {
            antes: { stockMinimo: previa.stockMinimo },
            despues: { stockMinimo: fila.stockMinimo },
          },
        },
        cliente,
      );
    }

    if (fila.estado !== previa.estado) {
      await this.auditoria.registrar(
        {
          entidad: 'insumo_sucursal',
          entidadId: fila.id,
          accion:
            fila.estado === 'descontinuado'
              ? 'insumo_sucursal_descontinuado'
              : 'insumo_sucursal_activado',
          actorId,
          sucursalAfectadaId: sucursalId,
          detalle: {
            antes: { estado: previa.estado },
            despues: { estado: fila.estado },
          },
        },
        cliente,
      );
    }
  }

  private validarStockMinimo(valor: number | undefined): string | undefined {
    if (valor === undefined) {
      return undefined;
    }

    // El minimo admite cero: un insumo sin minimo esta por debajo de el desde el
    // principio, que es justo el caso "activar sin minima".
    const problemas = problemasCantidad(valor, tipoProblemasCantidad.noNegativa);

    if (problemas.length > 0) {
      throw new BadRequestException({
        message: 'El stock minimo no es valido',
        problemas,
      });
    }

    // Se serializa a texto para la columna `Decimal(12,2)`: mandar el `number`
    // haria que Prisma arrastrase el error de representacion binaria.
    return cantidadATexto(valor);
  }

  private validarEstado(valor: string | undefined): EstadoStockInsumo | undefined {
    if (valor === undefined) {
      return undefined;
    }

    if (!esEstadoStockInsumo(valor)) {
      throw new BadRequestException(
        `El estado debe ser uno de: ${ESTADOS_INSUMO_SUCURSAL.join(', ')}`,
      );
    }

    return valor;
  }

  private async exigirSucursal(
    sucursalId: string,
    cliente: ClienteInventario,
  ): Promise<void> {
    if (!(await this.inventoryRepository.existeSucursal(sucursalId, cliente))) {
      throw new NotFoundException('La sucursal no existe');
    }
  }

  private async exigirInsumo(
    insumoId: string,
    cliente: ClienteInventario,
  ): Promise<void> {
    if (!(await this.inventoryRepository.existeInsumo(insumoId, cliente))) {
      throw new NotFoundException('El insumo no existe');
    }
  }
}
