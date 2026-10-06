import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryRepository } from '../../infrastructure/inventory.repository';

/**
 * Caso de uso: borrar un insumo del catalogo.
 *
 * Con stock configurado en alguna sucursal responde 409. La base no deja
 * borrarlo igualmente (`insumo_sucursal` lo referencia con `Restrict`, porque
 * arrastra recuentos y alertas), y ademas borrarlo dejaria huecos en ese
 * historial. La forma correcta de retirarlo es descontinuarlo en cada sucursal:
 * asi sigue saliendo en los historiales, marcado como descontinuado.
 */
@Injectable()
export class EliminarInsumoUseCase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async ejecutar(id: string): Promise<void> {
    const insumo = await this.inventoryRepository.buscarInsumoPorId(id);

    if (!insumo) {
      throw new NotFoundException('El insumo no existe');
    }

    const sucursalesConStock = await this.inventoryRepository.contarSucursalesDeInsumo(id);

    if (sucursalesConStock > 0) {
      throw new ConflictException(
        'El insumo ya tiene stock configurado en alguna sucursal: descontinualo en cada una en vez de borrarlo',
      );
    }

    await this.inventoryRepository.eliminarInsumo(id);
  }
}
