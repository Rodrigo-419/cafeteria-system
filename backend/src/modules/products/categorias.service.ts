// Logica de negocio de categorias de producto.
//
// El permiso `productos.catalogo.editar` ya lo exige el guard, asi que aqui solo
// se resuelven las reglas de nombre duplicado y de borrado con dependencias.
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ProductsRepository,
  type CategoriaRespuesta,
} from './products.repository';

const CATEGORIA_NO_ENCONTRADA = 'Categoria de producto no encontrada';
const NOMBRE_DUPLICADO = 'Ya existe una categoria con ese nombre';

@Injectable()
export class CategoriasService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  listar(): Promise<CategoriaRespuesta[]> {
    return this.productsRepository.listarCategorias();
  }

  obtener(id: string): Promise<CategoriaRespuesta> {
    return this.exigirCategoria(id);
  }

  async crear(nombre: string): Promise<CategoriaRespuesta> {
    const limpio = nombre.trim();

    if (await this.productsRepository.nombreCategoriaEnUso(limpio)) {
      throw new ConflictException(NOMBRE_DUPLICADO);
    }

    return this.productsRepository.crearCategoria(limpio);
  }

  /** Renombra una categoria. Conserva su propio nombre si no cambia. */
  async actualizar(id: string, nombre: string): Promise<CategoriaRespuesta> {
    await this.exigirCategoria(id);
    const limpio = nombre.trim();

    if (await this.productsRepository.nombreCategoriaEnUso(limpio, id)) {
      throw new ConflictException(NOMBRE_DUPLICADO);
    }

    return this.productsRepository.actualizarCategoria(id, limpio);
  }

  /**
   * Borra una categoria vacia. Si tiene productos responde 409 y no borra nada:
   * borrarla dejaria esos productos sin categoria, que la base no permite.
   */
  async eliminar(id: string): Promise<void> {
    await this.exigirCategoria(id);

    const productos = await this.productsRepository.contarProductosDeCategoria(id);
    if (productos > 0) {
      throw new ConflictException(
        'La categoria tiene productos asociados: muevelos a otra categoria antes de borrarla',
      );
    }

    await this.productsRepository.eliminarCategoria(id);
  }

  private async exigirCategoria(id: string): Promise<CategoriaRespuesta> {
    const categoria = await this.productsRepository.buscarCategoriaPorId(id);
    if (!categoria) {
      throw new NotFoundException(CATEGORIA_NO_ENCONTRADA);
    }
    return categoria;
  }
}
