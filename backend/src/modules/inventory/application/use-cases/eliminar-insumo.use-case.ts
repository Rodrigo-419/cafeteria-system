import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaRepository } from '../../../auditoria/infrastructure/auditoria.repository';
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
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  async ejecutar(actorId: string, id: string): Promise<void> {
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

    // El borrado y su evento son atomicos: o desaparece el insumo y queda
    // registrado quien lo hizo, o no pasa ninguna de las dos cosas.
    await this.inventoryRepository.enTransaccion(async (cliente) => {
      await this.inventoryRepository.eliminarInsumo(id, cliente);

      await this.auditoria.registrar(
        {
          entidad: 'insumo',
          entidadId: insumo.id,
          accion: 'insumo_eliminado',
          actorId,
          detalle: {
            antes: { nombre: insumo.nombre, presentacion: insumo.presentacion },
          },
        },
        cliente,
      );
    });
  }
}
