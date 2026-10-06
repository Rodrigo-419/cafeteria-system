import { NotFoundException } from '@nestjs/common';
import type { InventoryRepository } from '../infrastructure/inventory.repository';

/**
 * Comprueba que la sucursal exista de verdad.
 *
 * `exigirAccesoSucursal` ya respondio 404 si el actor no tiene esa sucursal, asi
 * que cuando esta comprobacion falla la peticion es de un Admin sobre una
 * sucursal que no esta dada de alta. Sin ella, un listado sobre una sucursal
 * inexistente devolveria 200 con cero resultados, que es indistinguible de "esa
 * sucursal no tiene insumos" y deja a los clientes adivinar si se equivocaron al
 * escribir el identificador.
 *
 * @throws NotFoundException (404) si la sucursal no existe.
 */
export async function exigirSucursalExistente(
  inventoryRepository: InventoryRepository,
  sucursalId: string,
): Promise<void> {
  if (!(await inventoryRepository.existeSucursal(sucursalId))) {
    throw new NotFoundException('La sucursal no existe');
  }
}
