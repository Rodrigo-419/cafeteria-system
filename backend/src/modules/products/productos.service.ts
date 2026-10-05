// Logica de negocio de productos del catalogo global.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type FiltrosListadoProductos,
  ProductsRepository,
  type ProductoRespuesta,
  type ResultadoListado,
} from './products.repository';

export const PAGE_POR_DEFECTO = 1;
export const LIMIT_POR_DEFECTO = 20;
export const LIMIT_MAXIMO = 100;

const PRODUCTO_NO_ENCONTRADO = 'Producto no encontrado';
const CATEGORIA_INEXISTENTE = 'La categoria indicada no existe';
const NOMBRE_DUPLICADO =
  'Ya existe un producto con ese nombre en la categoria';

@Injectable()
export class ProductosService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  /** Listado paginado del catalogo global, con filtro de categoria y busqueda. */
  async listar(filtros: {
    page?: number;
    limit?: number;
    categoriaId?: string;
    q?: string;
  }): Promise<ResultadoListado<ProductoRespuesta>> {
    const page = filtros.page ?? PAGE_POR_DEFECTO;
    const limit = Math.min(filtros.limit ?? LIMIT_POR_DEFECTO, LIMIT_MAXIMO);
    const busqueda = filtros.q?.trim();

    const filtrosNormalizados: FiltrosListadoProductos = {
      page,
      limit,
      ...(filtros.categoriaId !== undefined
        ? { categoriaId: filtros.categoriaId }
        : {}),
      ...(busqueda !== undefined && busqueda.length > 0
        ? { busqueda }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.productsRepository.listarProductos(filtrosNormalizados),
      this.productsRepository.contarProductos(filtrosNormalizados),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPaginas: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }

  obtener(id: string): Promise<ProductoRespuesta> {
    return this.exigirProducto(id);
  }

  async crear(entrada: {
    nombre: string;
    categoriaId: string;
    descripcion?: string | null;
  }): Promise<ProductoRespuesta> {
    const nombre = entrada.nombre.trim();

    await this.exigirCategoria(entrada.categoriaId);
    await this.exigirNombreLibre(nombre, entrada.categoriaId);

    return this.productsRepository.crearProducto({
      nombre,
      categoriaId: entrada.categoriaId,
      descripcion: limpiarOpcional(entrada.descripcion),
    });
  }

  /**
   * Edicion parcial.
   *
   * El nombre solo es unico DENTRO de la categoria, asi que al mover el producto
   * a otra categoria hay que volver a comprobar el nombre contra la nueva, no
   * solo cuando el nombre cambia.
   */
  async actualizar(
    id: string,
    entrada: { nombre?: string; categoriaId?: string; descripcion?: string | null },
  ): Promise<ProductoRespuesta> {
    const actual = await this.exigirProducto(id);

    const nombre = entrada.nombre !== undefined ? entrada.nombre.trim() : undefined;
    const categoriaId =
      entrada.categoriaId !== undefined ? entrada.categoriaId : actual.categoriaId;

    if (entrada.categoriaId !== undefined) {
      await this.exigirCategoria(entrada.categoriaId);
    }

    if (nombre !== undefined || entrada.categoriaId !== undefined) {
      await this.exigirNombreLibre(nombre ?? actual.nombre, categoriaId, id);
    }

    return this.productsRepository.actualizarProducto(id, {
      ...(nombre !== undefined ? { nombre } : {}),
      ...(entrada.categoriaId !== undefined ? { categoriaId } : {}),
      ...(entrada.descripcion !== undefined
        ? { descripcion: limpiarOpcional(entrada.descripcion) }
        : {}),
    });
  }

  /**
   * Borra un producto sin precios. Con precios en cualquier sucursal responde
   * 409: la base no deja borrar una oferta, y la forma de retirar un producto es
   * desactivar su oferta en cada sucursal, no borrarlo.
   */
  async eliminar(id: string): Promise<void> {
    await this.exigirProducto(id);

    const ofertas = await this.productsRepository.contarOfertasDeProducto(id);
    if (ofertas > 0) {
      throw new ConflictException(
        'El producto tiene precios en alguna sucursal: desactiva su oferta en cada sucursal en vez de borrarlo',
      );
    }

    await this.productsRepository.eliminarProducto(id);
  }

  // ------------------------------------------------------------------ privado

  private async exigirProducto(id: string): Promise<ProductoRespuesta> {
    const producto = await this.productsRepository.buscarProductoPorId(id);
    if (!producto) {
      throw new NotFoundException(PRODUCTO_NO_ENCONTRADO);
    }
    return producto;
  }

  /**
   * Una categoria que no existe se responde 400, no 404.
   *
   * El 404 esta reservado para "no existe el recurso que pediste" (un producto,
   * una sucursal). Aqui la peticion es correcta en su forma pero el cuerpo
   * apunta a una categoria que no esta en el catalogo: es un dato de entrada
   * invalido, igual que un correo mal escrito. Coherente con
   * `CrearUsuarioUseCase`, que responde 400 cuando la sucursal no existe.
   */
  private async exigirCategoria(categoriaId: string): Promise<void> {
    if (!(await this.productsRepository.existeCategoria(categoriaId))) {
      throw new BadRequestException(CATEGORIA_INEXISTENTE);
    }
  }

  private async exigirNombreLibre(
    nombre: string,
    categoriaId: string,
    exceptoProductoId?: string,
  ): Promise<void> {
    const enUso = await this.productsRepository.nombreProductoEnUso(
      nombre,
      categoriaId,
      exceptoProductoId,
    );

    if (enUso) {
      throw new ConflictException(NOMBRE_DUPLICADO);
    }
  }
}

/**
 * Normaliza un campo opcional de texto: sin valor, o solo con espacios, es null.
 *
 * Un `''` en la base significa "descripcion rellenada con nada", que despues se
 * lee igual que `null` pero ocupa sitio. Se guarda `null`.
 */
function limpiarOpcional(valor: string | null | undefined): string | null {
  if (valor === undefined || valor === null) {
    return null;
  }

  const limpio = valor.trim();
  return limpio.length === 0 ? null : limpio;
}
