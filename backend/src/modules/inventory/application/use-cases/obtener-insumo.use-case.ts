import { Injectable, NotFoundException } from '@nestjs/common';
import {
  InventoryRepository,
  type InsumoFila,
 } from '../../infrastructure/inventory.repository';

/**
 * Caso de uso: obtener un insumo del catalogo por id.
 *
 * 404 si no existe. El catalogo es global, asi que aqui no hay nada que filtrar
 * por sucursal.
 */
@Injectable()
export class ObtenerInsumoUseCase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async ejecutar(id: string): Promise<InsumoFila> {
    const insumo = await this.inventoryRepository.buscarInsumoPorId(id);

    if (!insumo) {
      throw new NotFoundException('El insumo no existe');
    }

    return insumo;
  }
}
