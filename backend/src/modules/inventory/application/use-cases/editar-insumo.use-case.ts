import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { validarNombreInsumo } from '../../domain/rules/nombres';
import {
  validarPresentacionInsumo,
  type PresentacionInsumo,
} from '../../domain/rules/presentacion-insumo';
import {
  InventoryRepository,
  type InsumoFila,
 } from '../../infrastructure/inventory.repository';

/**
 * Caso de uso: editar nombre y presentacion de un insumo del catalogo.
 *
 * Editar el catalogo no toca el stock: el `stock_minimo` y el estado viven en
 * `insumo_sucursal`, y son por sucursal. Cambiar el nombre si altera lo que se
 * ve en los listados de stock, pero no las cantidades.
 *
 * Solo se escribe lo que cambia. Un `PATCH` sin cambios reales devuelve la fila
 * tal cual y no mueve `updatedAt`, para no fingir una modificacion que no ha
 * ocurrido.
 */
@Injectable()
export class EditarInsumoUseCase {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async ejecutar(
    id: string,
    entrada: { nombre?: string; presentacion?: string },
  ): Promise<InsumoFila> {
    // La lectura inicial va fuera de la transaccion a proposito: si el insumo no
    // existe, la respuesta es un 404 sin abrir transaccion ni tomar candado.
    const actual = await this.inventoryRepository.buscarInsumoPorId(id);

    if (!actual) {
      throw new NotFoundException('El insumo no existe');
    }

    const cambios: { nombre?: string; presentacion?: PresentacionInsumo } = {};
    let candado: string | undefined;

    if (entrada.nombre !== undefined) {
      const nombre = validarNombreInsumo(entrada.nombre);

      if (nombre !== actual.nombre) {
        cambios.nombre = nombre;
        candado = nombre;
      }
    }

    if (entrada.presentacion !== undefined) {
      const presentacion = validarPresentacionInsumo(entrada.presentacion);

      if (presentacion !== actual.presentacion) {
        cambios.presentacion = presentacion;
      }
    }

    if (Object.keys(cambios).length === 0) {
      return actual;
    }

    if (candado === undefined) {
      return this.inventoryRepository.actualizarInsumo(id, cambios);
    }

    return this.inventoryRepository.enTransaccion(async (cliente) => {
      // Mismo candado que en el alta: sin el, dos renombrados simultaneos a un
      // mismo nombre pasarian los dos el `count` y quedaria el duplicado.
      await this.inventoryRepository.bloquearNombreInsumo(candado, cliente);

      // El propio insumo no cuenta como duplicado: sin el `NOT`, reenviar el mismo
      // nombre seria un 409 absurdo.
      if (await this.inventoryRepository.nombreInsumoEnUso(candado, id, cliente)) {
        throw new ConflictException('Ya existe un insumo con ese nombre');
      }

      return this.inventoryRepository.actualizarInsumo(id, cambios, cliente);
    });
  }
}
