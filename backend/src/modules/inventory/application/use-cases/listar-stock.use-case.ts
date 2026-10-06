import { Injectable } from '@nestjs/common';
import { pagina, type Paginado } from '../paginado';
import {
  exigirAccesoSucursal,
  type ActorInventario,
} from '../../domain/rules/alcance-inventario';
import { esEstadoStockInsumo } from '../../domain/rules/estados-insumo';
import { exigirSucursalExistente } from '../exigir-sucursal';
import {
  InventoryRepository,
  type StockFila,
 } from '../../infrastructure/inventory.repository';

export type EntradaListarStock = {
  page: number;
  limit: number;
  estado?: string;
  soloBajoMinimo?: boolean;
  busqueda?: string;
};

export type PaginaStock = Paginado<StockFila>;

/**
 * Caso de uso: listar el stock de una sucursal.
 *
 * El alcance se comprueba antes de tocar la base. Un Gerente que pide la sucursal
 * de otro recibe 404 sin que exista consulta alguna, y una sucursal que no esta
 * dada de alta recibe 404 tambien, en vez de un 200 vacio.
 */
@Injectable()
export class ListarStockUseCase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async ejecutar(
    actor: ActorInventario,
    sucursalId: string,
    entrada: EntradaListarStock,
  ): Promise<PaginaStock> {
    exigirAccesoSucursal(actor, sucursalId);
    await exigirSucursalExistente(this.inventoryRepository, sucursalId);

    // Un filtro que no es un estado valido se ignora en vez de convertirse en un
    // filtro imposible que siempre sale vacio. El DTO ya lo rechaza, pero el caso
    // de uso no debe depender de que siempre venga por HTTP.
    const estado =
      entrada.estado !== undefined && esEstadoStockInsumo(entrada.estado)
        ? entrada.estado
        : undefined;

    const filtros = {
      page: entrada.page,
      limit: entrada.limit,
      sucursalId,
      ...(estado !== undefined ? { estado } : {}),
      ...(entrada.soloBajoMinimo !== undefined
        ? { soloBajoMinimo: entrada.soloBajoMinimo }
        : {}),
      ...(entrada.busqueda !== undefined && entrada.busqueda !== ''
        ? { busqueda: entrada.busqueda.trim() }
        : {}),
    };

    const data = await this.inventoryRepository.listarStock(filtros);
    const total = await this.inventoryRepository.contarStock(filtros);

    return pagina(data, total, entrada.page, entrada.limit);
  }
}
