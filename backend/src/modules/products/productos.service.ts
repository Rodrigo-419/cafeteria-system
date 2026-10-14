// Logica de negocio de productos del catalogo global.
//
// El catalogo es global: sus eventos de auditoria van con la sucursal afectada
// en null.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditoriaRepository } from '../auditoria/infrastructure/auditoria.repository';
import {
  type ClienteProductos,
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
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly auditoria: AuditoriaRepository,
  ) {}

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

    const data = await this.productsRepository.listarProductos(
      filtrosNormalizados,
    );
    const total = await this.productsRepository.contarProductos(
      filtrosNormalizados,
    );

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

  async crear(
    actorId: string,
    entrada: {
      nombre: string;
      categoriaId: string;
      descripcion?: string | null;
    },
  ): Promise<ProductoRespuesta> {
    const nombre = entrada.nombre.trim();

    return this.productsRepository.enTransaccion(async (cliente) => {
      await this.exigirCategoria(entrada.categoriaId, cliente);
      await this.exigirNombreLibre(nombre, entrada.categoriaId, undefined, cliente);

      const producto = await this.productsRepository.crearProducto(
        {
          nombre,
          categoriaId: entrada.categoriaId,
          descripcion: limpiarOpcional(entrada.descripcion),
        },
        cliente,
      );

      await this.auditoria.registrar(
        {
          entidad: 'producto',
          entidadId: producto.id,
          accion: 'producto_creado',
          actorId,
          detalle: {
            despues: {
              nombre: producto.nombre,
              categoriaId: producto.categoriaId,
              descripcion: producto.descripcion,
            },
          },
        },
        cliente,
      );

      return producto;
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
    actorId: string,
    id: string,
    entrada: {
      nombre?: string;
      categoriaId?: string;
      descripcion?: string | null;
    },
  ): Promise<ProductoRespuesta> {
    const nombre = entrada.nombre !== undefined ? entrada.nombre.trim() : undefined;

    return this.productsRepository.enTransaccion(async (cliente) => {
      const actual = await this.exigirProducto(id, cliente);

      const categoriaId =
        entrada.categoriaId !== undefined ? entrada.categoriaId : actual.categoriaId;

      if (entrada.categoriaId !== undefined) {
        await this.exigirCategoria(entrada.categoriaId, cliente);
      }

      if (nombre !== undefined || entrada.categoriaId !== undefined) {
        await this.exigirNombreLibre(
          nombre ?? actual.nombre,
          categoriaId,
          id,
          cliente,
        );
      }

      const producto = await this.productsRepository.actualizarProducto(
        id,
        {
          ...(nombre !== undefined ? { nombre } : {}),
          ...(entrada.categoriaId !== undefined ? { categoriaId } : {}),
          ...(entrada.descripcion !== undefined
            ? { descripcion: limpiarOpcional(entrada.descripcion) }
            : {}),
        },
        cliente,
      );

      await this.registrarEdicion(actorId, actual, producto, cliente);

      return producto;
    });
  }

  /**
   * Borra un producto sin precios. Con precios en cualquier sucursal responde
   * 409: la base no deja borrar una oferta, y la forma de retirar un producto es
   * desactivar su oferta en cada sucursal, no borrarlo.
   */
  async eliminar(actorId: string, id: string): Promise<void> {
    await this.productsRepository.enTransaccion(async (cliente) => {
      const producto = await this.exigirProducto(id, cliente);

      const ofertas = await this.productsRepository.contarOfertasDeProducto(
        id,
        cliente,
      );
      if (ofertas > 0) {
        throw new ConflictException(
          'El producto tiene precios en alguna sucursal: desactiva su oferta en cada sucursal en vez de borrarlo',
        );
      }

      await this.productsRepository.eliminarProducto(id, cliente);

      await this.auditoria.registrar(
        {
          entidad: 'producto',
          entidadId: producto.id,
          accion: 'producto_eliminado',
          actorId,
          detalle: {
            antes: { nombre: producto.nombre, categoriaId: producto.categoriaId },
          },
        },
        cliente,
      );
    });
  }

  // ------------------------------------------------------------------ privado

  /**
   * Escribe un `producto_editado` con los campos que cambiaron de verdad. Un
   * PATCH sin cambios reales no deja evento.
   */
  private async registrarEdicion(
    actorId: string,
    actual: ProductoRespuesta,
    producto: ProductoRespuesta,
    cliente: ClienteProductos,
  ): Promise<void> {
    const antes: Record<string, unknown> = {};
    const despues: Record<string, unknown> = {};

    if (producto.nombre !== actual.nombre) {
      antes.nombre = actual.nombre;
      despues.nombre = producto.nombre;
    }
    if (producto.categoriaId !== actual.categoriaId) {
      antes.categoriaId = actual.categoriaId;
      despues.categoriaId = producto.categoriaId;
    }
    if (producto.descripcion !== actual.descripcion) {
      antes.descripcion = actual.descripcion;
      despues.descripcion = producto.descripcion;
    }

    if (Object.keys(despues).length === 0) {
      return;
    }

    await this.auditoria.registrar(
      {
        entidad: 'producto',
        entidadId: producto.id,
        accion: 'producto_editado',
        actorId,
        detalle: { antes, despues },
      },
      cliente,
    );
  }

  private async exigirProducto(
    id: string,
    cliente?: ClienteProductos,
  ): Promise<ProductoRespuesta> {
    const producto = await this.productsRepository.buscarProductoPorId(
      id,
      cliente,
    );
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
   * invalido, igual que un nombre de usuario mal escrito. Coherente con
   * `CrearUsuarioUseCase`, que responde 400 cuando la sucursal no existe.
   */
  private async exigirCategoria(
    categoriaId: string,
    cliente?: ClienteProductos,
  ): Promise<void> {
    if (!(await this.productsRepository.existeCategoria(categoriaId, cliente))) {
      throw new BadRequestException(CATEGORIA_INEXISTENTE);
    }
  }

  private async exigirNombreLibre(
    nombre: string,
    categoriaId: string,
    exceptoProductoId: string | undefined,
    cliente?: ClienteProductos,
  ): Promise<void> {
    const enUso = await this.productsRepository.nombreProductoEnUso(
      nombre,
      categoriaId,
      exceptoProductoId,
      cliente,
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
