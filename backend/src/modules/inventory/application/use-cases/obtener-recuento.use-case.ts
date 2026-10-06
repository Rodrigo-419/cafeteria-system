import { Injectable, NotFoundException } from '@nestjs/common';
import {
  exigirAccesoSucursal,
  type ActorInventario,
} from '../../domain/rules/alcance-inventario';
import {
  InventoryRepository,
  type RecuentoCompletoFila,
 } from '../../infrastructure/inventory.repository';

/**
 * Caso de uso: obtener un recuento con sus lineas.
 *
 * El alcance se comprueba sobre la sucursal del propio recuento, no sobre un
 * filtro de la ruta: el recuento ya trae su `sucursal_id`. Asi no hay forma de
 * leer el detalle de un recuento de otra sucursal cambiando la URL.
 *
 * Cada linea trae el stock de sistema, el fisico y la diferencia de su momento.
 * El `stock_actual` de la linea es el de HOY, que puede ser distinto al que se
 * conto: entre el recuento y la consulta pudo entrar mercancia o volver a
 * contar. Para el stock de aquel momento esta `stock_sistema`.
 */
@Injectable()
export class ObtenerRecuentoUseCase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async ejecutar(
    actor: ActorInventario,
    id: string,
  ): Promise<RecuentoCompletoFila> {
    const recuento = await this.inventoryRepository.buscarRecuentoPorId(id);

    if (!recuento) {
      throw new NotFoundException('El recuento no existe');
    }

    exigirAccesoSucursal(actor, recuento.sucursalId);

    return recuento;
  }
}
