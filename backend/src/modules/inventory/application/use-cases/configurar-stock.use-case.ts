import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

      const fila = await this.inventoryRepository.configurarStock(
        insumoId,
        sucursalId,
        {
          ...(stockMinimo !== undefined ? { stockMinimo } : {}),
          ...(estado !== undefined ? { estado } : {}),
        },
        cliente,
      );

      await this.reevaluarAlertasService.ejecutar(fila.id, cliente);

      return fila;
    });
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
