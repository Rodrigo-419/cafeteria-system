import { Injectable, NotFoundException } from '@nestjs/common';
import { pagina, type Paginado } from '../paginado';
import {
  exigirAccesoSucursal,
  filtroSucursalAlcance,
  type ActorInventario,
} from '../../domain/rules/alcance-inventario';
import { exigirSucursalExistente } from '../exigir-sucursal';
import {
  InventoryRepository,
  type RecuentoFila,
 } from '../../infrastructure/inventory.repository';

export type EntradaListarRecuentos = {
  page: number;
  limit: number;
  sucursalId?: string;
};

export type PaginaRecuentos = Paginado<RecuentoFila>;

/**
 * Caso de uso: listar recuentos.
 *
 * El filtro de sucursal sale de la ruta si viene; si no, lo impone el alcance:
 * un Gerente ve los de su sucursal y el Admin los de todas. Una sucursal pedida
 * que este fuera del alcance da 404 en `filtroSucursalAlcance`, y la que llegue
 * de un Admin se comprueba contra la base para no devolver un 200 vacio por una
 * sucursal que no existe.
 */
@Injectable()
export class ListarRecuentosUseCase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async ejecutar(
    actor: ActorInventario,
    entrada: EntradaListarRecuentos,
  ): Promise<PaginaRecuentos> {
    const sucursalId = filtroSucursalAlcance(actor, entrada.sucursalId);

    if (sucursalId !== undefined) {
      exigirAccesoSucursal(actor, sucursalId);
      await exigirSucursalExistente(this.inventoryRepository, sucursalId);
    }

    const filtros = {
      page: entrada.page,
      limit: entrada.limit,
      ...(sucursalId !== undefined ? { sucursalId } : {}),
    };

    const [data, total] = await Promise.all([
      this.inventoryRepository.listarRecuentos(filtros),
      this.inventoryRepository.contarRecuentos(filtros),
    ]);

    return pagina(data, total, entrada.page, entrada.limit);
  }
}

/**
 * Caso de uso: obtener un recuento con sus lineas.
 *
 * El alcance se comprueba sobre la sucursal del propio recuento, no sobre un
 * filtro de la ruta: el recuento ya trae su `sucursal_id`. Asi no hay forma de
 * leer el detalle de un recuento de otra sucursal cambiando la URL.
 */
@Injectable()
export class ObtenerRecuentoUseCase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async ejecutar(actor: ActorInventario, id: string) {
    const recuento = await this.inventoryRepository.buscarRecuentoPorId(id);

    if (!recuento) {
      throw new NotFoundException('El recuento no existe');
    }

    exigirAccesoSucursal(actor, recuento.sucursalId);

    return recuento;
  }
}
