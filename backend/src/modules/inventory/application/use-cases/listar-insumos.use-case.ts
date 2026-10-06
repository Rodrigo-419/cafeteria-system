import { Injectable } from '@nestjs/common';
import { pagina, type Paginado } from '../paginado';
import {
  PRESENTACIONES_INSUMO,
  type PresentacionInsumo,
} from '../../domain/rules/presentacion-insumo';
import {
  InventoryRepository,
  type InsumoFila,
 } from '../../infrastructure/inventory.repository';

export type EntradaListarInsumos = {
  page: number;
  limit: number;
  busqueda?: string;
  presentacion?: string;
};

export type PaginaInsumos = Paginado<InsumoFila>;

/**
 * Caso de uso: listar el catalogo de insumos con paginado y filtros.
 *
 * No lleva alcance de sucursal porque el catalogo es global. Quien puede
 * consultar el catalogo lo ve entero; el stock de cada insumo, que si es por
 * sucursal, se consulta aparte.
 */
@Injectable()
export class ListarInsumosUseCase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async ejecutar(entrada: EntradaListarInsumos): Promise<PaginaInsumos> {
    // Un filtro que no esta en la lista de valores admitidos se ignora en vez de
    // become un filtro imposible que siempre sale vacio. El DTO ya lo rechaza,
    // pero el caso de uso no debe depender de que siempre venga por HTTP.
    const presentacion = normalizarPresentacion(entrada.presentacion);

    const filtros = {
      page: entrada.page,
      limit: entrada.limit,
      ...(entrada.busqueda !== undefined && entrada.busqueda !== ''
        ? { busqueda: entrada.busqueda.trim() }
        : {}),
      ...(presentacion !== undefined ? { presentacion } : {}),
    };

    // Las dos consultas se lanzan una detras de otra, sin solaparlas.
    const data = await this.inventoryRepository.listarInsumos(filtros);
    const total = await this.inventoryRepository.contarInsumos(filtros);

    return pagina(data, total, entrada.page, entrada.limit);
  }
}

function normalizarPresentacion(valor: string | undefined): PresentacionInsumo | undefined {
  if (valor === undefined) {
    return undefined;
  }

  return (PRESENTACIONES_INSUMO as readonly string[]).includes(valor)
    ? (valor as PresentacionInsumo)
    : undefined;
}
