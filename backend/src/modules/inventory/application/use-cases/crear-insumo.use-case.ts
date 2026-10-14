import { ConflictException, Injectable } from '@nestjs/common';
import { AuditoriaRepository } from '../../../auditoria/infrastructure/auditoria.repository';
import { validarNombreInsumo } from '../../domain/rules/nombres';
import { validarPresentacionInsumo } from '../../domain/rules/presentacion-insumo';
import {
  InventoryRepository,
  type InsumoFila,
 } from '../../infrastructure/inventory.repository';

/**
 * Caso de uso: crear un insumo en el catalogo global.
 *
 * El catalogo no es por sucursal: un "Cafe molido" es el mismo insumo en todas
 * las sucursales. Lo que cambia por sucursal es el stock, y eso lo gestiona el
 * servicio de stock.
 */
@Injectable()
export class CrearInsumoUseCase {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  async ejecutar(
    actorId: string,
    entrada: {
      nombre: string;
      presentacion: string;
    },
  ): Promise<InsumoFila> {
    // La validacion va antes de abrir la transaccion: un nombre malo no tiene por
    // que esperar a nadie, y no deja nada a medias.
    const nombre = validarNombreInsumo(entrada.nombre);
    const presentacion = validarPresentacionInsumo(entrada.presentacion);

    return this.inventoryRepository.enTransaccion(async (cliente) => {
      // `insumo.nombre` no tiene indice unico en la base, asi que comprobar que
      // no exista NO basta: dos altas simultaneas leerian las dos que no existe.
      // El candado convierte comprobar e insertar en una seccion critica, y el
      // `count` que va detras ya ve lo que escribio el otro.
      await this.inventoryRepository.bloquearNombreInsumo(nombre, cliente);

      if (await this.inventoryRepository.nombreInsumoEnUso(nombre, undefined, cliente)) {
        throw new ConflictException('Ya existe un insumo con ese nombre');
      }

      const insumo = await this.inventoryRepository.crearInsumo(
        { nombre, presentacion },
        cliente,
      );

      await this.auditoria.registrar(
        {
          entidad: 'insumo',
          entidadId: insumo.id,
          accion: 'insumo_creado',
          actorId,
          detalle: {
            despues: { nombre: insumo.nombre, presentacion: insumo.presentacion },
          },
        },
        cliente,
      );

      return insumo;
    });
  }
}
