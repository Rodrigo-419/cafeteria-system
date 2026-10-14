// Logica de negocio de categorias de producto.
//
// El permiso `productos.catalogo.editar` ya lo exige el guard, asi que aqui solo
// se resuelven las reglas de nombre duplicado y de borrado con dependencias.
//
// El catalogo es global: sus eventos de auditoria van con la sucursal afectada
// en null.
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaRepository } from '../auditoria/infrastructure/auditoria.repository';
import {
  type ClienteProductos,
  ProductsRepository,
  type CategoriaRespuesta,
} from './products.repository';

const CATEGORIA_NO_ENCONTRADA = 'Categoria no encontrada';
const NOMBRE_DUPLICADO = 'Ya existe una categoria con ese nombre';

@Injectable()
export class CategoriasService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  listar(): Promise<CategoriaRespuesta[]> {
    return this.productsRepository.listarCategorias();
  }

  obtener(id: string): Promise<CategoriaRespuesta> {
    return this.exigirCategoria(id);
  }

  async crear(actorId: string, nombre: string): Promise<CategoriaRespuesta> {
    const limpio = nombre.trim();

    return this.productsRepository.enTransaccion(async (cliente) => {
      if (
        await this.productsRepository.nombreCategoriaEnUso(
          limpio,
          undefined,
          cliente,
        )
      ) {
        throw new ConflictException(NOMBRE_DUPLICADO);
      }

      const categoria = await this.productsRepository.crearCategoria(
        limpio,
        cliente,
      );

      await this.auditoria.registrar(
        {
          entidad: 'categoria',
          entidadId: categoria.id,
          accion: 'categoria_creada',
          actorId,
          detalle: { despues: { nombre: categoria.nombre } },
        },
        cliente,
      );

      return categoria;
    });
  }

  /** Renombra una categoria. Conserva su propio nombre si no cambia. */
  async actualizar(
    actorId: string,
    id: string,
    nombre: string,
  ): Promise<CategoriaRespuesta> {
    const limpio = nombre.trim();

    return this.productsRepository.enTransaccion(async (cliente) => {
      const actual = await this.exigirCategoria(id, cliente);

      if (
        await this.productsRepository.nombreCategoriaEnUso(limpio, id, cliente)
      ) {
        throw new ConflictException(NOMBRE_DUPLICADO);
      }

      const categoria = await this.productsRepository.actualizarCategoria(
        id,
        limpio,
        cliente,
      );

      if (categoria.nombre !== actual.nombre) {
        await this.auditoria.registrar(
          {
            entidad: 'categoria',
            entidadId: categoria.id,
            accion: 'categoria_editada',
            actorId,
            detalle: {
              antes: { nombre: actual.nombre },
              despues: { nombre: categoria.nombre },
            },
          },
          cliente,
        );
      }

      return categoria;
    });
  }

  /**
   * Borra una categoria vacia. Si tiene productos responde 409 y no borra nada:
   * borrarla dejaria esos productos sin categoria, que la base no permite.
   */
  async eliminar(actorId: string, id: string): Promise<void> {
    await this.productsRepository.enTransaccion(async (cliente) => {
      const categoria = await this.exigirCategoria(id, cliente);

      const productos = await this.productsRepository.contarProductosDeCategoria(
        id,
        cliente,
      );
      if (productos > 0) {
        throw new ConflictException(
          'La categoria tiene productos asociados: muevelos a otra categoria antes de borrarla',
        );
      }

      await this.productsRepository.eliminarCategoria(id, cliente);

      await this.auditoria.registrar(
        {
          entidad: 'categoria',
          entidadId: categoria.id,
          accion: 'categoria_eliminada',
          actorId,
          detalle: { antes: { nombre: categoria.nombre } },
        },
        cliente,
      );
    });
  }

  private async exigirCategoria(
    id: string,
    cliente?: ClienteProductos,
  ): Promise<CategoriaRespuesta> {
    const categoria = await this.productsRepository.buscarCategoriaPorId(
      id,
      cliente,
    );
    if (!categoria) {
      throw new NotFoundException(CATEGORIA_NO_ENCONTRADA);
    }
    return categoria;
  }
}
