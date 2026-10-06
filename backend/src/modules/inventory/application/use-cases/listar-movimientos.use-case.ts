import { Injectable, NotFoundException } from '@nestjs/common';
import { pagina, type Paginado } from '../paginado';
import {
  exigirAccesoSucursal,
  type ActorInventario,
} from '../../domain/rules/alcance-inventario';
import {
  TIPOS_MOVIMIENTO_INVENTARIO,
  type TipoMovimientoInventario,
} from '../../domain/rules/estados-insumo';
import { exigirSucursalExistente } from '../exigir-sucursal';
import {
  InventoryRepository,
  type MovimientoFila,
 } from '../../infrastructure/inventory.repository';

export type EntradaListarMovimientos = {
  page: number;
  limit: number;
  insumoId?: string;
  tipo?: string;
  desde?: Date;
  hasta?: Date;
};

export type PaginaMovimientos = Paginado<MovimientoFila>;

/**
 * Caso de uso: listar los movimientos de stock de una sucursal.
 *
 * `cantidad` es la VARIACION del stock, no el valor final. Una entrada de 5 con
 * stock previo 8 deja el stock en 13 y guarda un movimiento de 5.
 */
@Injectable()
export class ListarMovimientosUseCase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async ejecutar(
    actor: ActorInventario,
    sucursalId: string,
    entrada: EntradaListarMovimientos,
  ): Promise<PaginaMovimientos> {
    exigirAccesoSucursal(actor, sucursalId);
    await exigirSucursalExistente(this.inventoryRepository, sucursalId);

    const insumoSucursalId = await this.resolverFila(
      entrada.insumoId,
      sucursalId,
    );

    // Un tipo que no es valido se ignora en vez de convertirse en un filtro
    // imposible que siempre sale vacio. El DTO ya lo rechaza, pero el caso de uso
    // no debe depender de que siempre venga por HTTP.
    const tipo =
      entrada.tipo !== undefined &&
      (TIPOS_MOVIMIENTO_INVENTARIO as readonly string[]).includes(entrada.tipo)
        ? (entrada.tipo as TipoMovimientoInventario)
        : undefined;

    const filtros = {
      page: entrada.page,
      limit: entrada.limit,
      sucursalId,
      ...(insumoSucursalId !== undefined ? { insumoSucursalId } : {}),
      ...(tipo !== undefined ? { tipo } : {}),
      ...(entrada.desde !== undefined ? { desde: entrada.desde } : {}),
      ...(entrada.hasta !== undefined ? { hasta: entrada.hasta } : {}),
    };

    const data = await this.inventoryRepository.listarMovimientos(filtros);
    const total = await this.inventoryRepository.contarMovimientos(filtros);

    return pagina(data, total, entrada.page, entrada.limit);
  }

  /**
   * El filtro va por `insumo_sucursal_id`, pero quien pregunta conoce el
   * `insumo_id` del catalogo. Sin este paso, el filtro por insumo no existiria.
   *
   * Un insumo que no esta en la sucursal da 404: se pidio el historial de algo
   * que en esa sucursal no existe, no una lista vacia.
   */
  private async resolverFila(
    insumoId: string | undefined,
    sucursalId: string,
  ): Promise<string | undefined> {
    if (insumoId === undefined) {
      return undefined;
    }

    const fila = await this.inventoryRepository.buscarStock(insumoId, sucursalId);

    if (!fila) {
      throw new NotFoundException('El insumo no esta dado de alta en esta sucursal');
    }

    return fila.id;
  }
}
