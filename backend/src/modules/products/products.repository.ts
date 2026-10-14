// Repositorio de productos: catalogo global (categorias, variantes, productos)
// y ofertas por sucursal.
//
// Todas las consultas van con `select` explicito: si manana se anade una
// columna a `producto`, la respuesta de la API no cambia por accidente.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { type EstadoOferta, mismoNombre } from './products.rules';

/** Cliente con el que se puede trabajar fuera o dentro de una transaccion. */
export type ClienteProductos = PrismaService | Prisma.TransactionClient;

// ------------------------------------------------------------------ respuestas

export type CategoriaRespuesta = {
  id: string;
  nombre: string;
  createdAt: Date;
  updatedAt: Date;
};

export type VarianteRespuesta = {
  id: string;
  nombre: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Un producto con su categoria: el listado global siempre la devuelve. */
export type ProductoRespuesta = {
  id: string;
  nombre: string;
  categoriaId: string;
  descripcion: string | null;
  createdAt: Date;
  updatedAt: Date;
  categoria: { id: string; nombre: string };
};

/** Una fila de la carta de una sucursal. El precio llega como texto. */
export type OfertaRespuesta = {
  precio: string;
  estado: EstadoOferta;
};

/** Fila de la carta: producto, categoria, variante, precio y estado. */
export type CartaFila = {
  id: string;
  productoId: string;
  varianteId: string;
  precio: string;
  estado: EstadoOferta;
  producto: {
    id: string;
    nombre: string;
    categoriaId: string;
    categoria: { id: string; nombre: string };
  };
  variante: { id: string; nombre: string };
};

export type FiltrosListadoProductos = {
  page: number;
  limit: number;
  categoriaId?: string;
  busqueda?: string;
};

/** Envoltorio de listado paginado, con la misma forma que usa el modulo users. */
export type ResultadoListado<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPaginas: number;
};

type NombreYId = {

  id: string;
  nombre: string;
};

const SELECT_CATEGORIA = {
  id: true,
  nombre: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategoriaProductoSelect;

const SELECT_VARIANTE = {
  id: true,
  nombre: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VarianteSelect;

const SELECT_PRODUCTO = {
  id: true,
  nombre: true,
  categoriaId: true,
  descripcion: true,
  createdAt: true,
  updatedAt: true,
  categoria: { select: { id: true, nombre: true } },
} satisfies Prisma.ProductoSelect;

const SELECT_NOMBRE_Y_ID = {
  id: true,
  nombre: true,
} satisfies Prisma.CategoriaProductoSelect;

const SELECT_OFERTA = {
  id: true,
  precio: true,
  estado: true,
} satisfies Prisma.ProductoSucursalVarianteSelect;

const SELECT_CARTA = {
  id: true,
  productoId: true,
  varianteId: true,
  precio: true,
  estado: true,
  producto: {
    select: {
      id: true,
      nombre: true,
      categoriaId: true,
      categoria: { select: { id: true, nombre: true } },
    },
  },
  variante: { select: { id: true, nombre: true } },
} satisfies Prisma.ProductoSucursalVarianteSelect;

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta `operacion` dentro de una transaccion y le pasa el cliente.
   *
   * Las lecturas que condicionan una escritura (comprobar duplicados, leer la
   * oferta previa) tienen que usar ese cliente para que la operacion y su evento
   * de auditoria sean atomicos.
   */
  async enTransaccion<T>(
    operacion: (cliente: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(operacion);
  }

  private db(cliente?: ClienteProductos): ClienteProductos {
    return cliente ?? this.prisma;
  }

  // -------------------------------------------------------------- categorias

  async listarCategorias(): Promise<CategoriaRespuesta[]> {
    return this.prisma.categoriaProducto.findMany({
      select: SELECT_CATEGORIA,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    });
  }

  async buscarCategoriaPorId(
    id: string,
    cliente?: ClienteProductos,
  ): Promise<CategoriaRespuesta | null> {
    return this.db(cliente).categoriaProducto.findUnique({
      where: { id },
      select: SELECT_CATEGORIA,
    });
  }

  /** Numero de productos de una categoria. Lo usa el borrado. */
  async contarProductosDeCategoria(
    categoriaId: string,
    cliente?: ClienteProductos,
  ): Promise<number> {
    return this.db(cliente).producto.count({ where: { categoriaId } });
  }

  async existeCategoria(
    id: string,
    cliente?: ClienteProductos,
  ): Promise<boolean> {
    const categoria = await this.db(cliente).categoriaProducto.findUnique({
      where: { id },
      select: { id: true },
    });
    return categoria !== null;
  }

  /**
   * true si el nombre ya lo usa otra categoria, ignorando mayusculas y espacios
   * sobrantes. `exceptoCategoriaId` deja que conserve su nombre al editarla.
   *
   * La comparacion es en memoria a proposito: `mode: 'insensitive'` de Prisma
   * no cubre el colapso de espacios internos. La tabla es pequena y acotada.
   */
  async nombreCategoriaEnUso(
    nombre: string,
    exceptoCategoriaId?: string,
    cliente?: ClienteProductos,
  ): Promise<boolean> {
    const categorias = await this.db(cliente).categoriaProducto.findMany({
      select: SELECT_NOMBRE_Y_ID,
    });

    return categorias.some(
      (c) => c.id !== exceptoCategoriaId && mismoNombre(c.nombre, nombre),
    );
  }

  async crearCategoria(
    nombre: string,
    cliente?: ClienteProductos,
  ): Promise<CategoriaRespuesta> {
    return this.db(cliente).categoriaProducto.create({
      data: { nombre },
      select: SELECT_CATEGORIA,
    });
  }

  async actualizarCategoria(
    id: string,
    nombre: string,
    cliente?: ClienteProductos,
  ): Promise<CategoriaRespuesta> {
    return this.db(cliente).categoriaProducto.update({
      where: { id },
      data: { nombre },
      select: SELECT_CATEGORIA,
    });
  }

  /** Borra la categoria. La base restringe el borrado si tiene productos. */
  async eliminarCategoria(
    id: string,
    cliente?: ClienteProductos,
  ): Promise<void> {
    await this.db(cliente).categoriaProducto.delete({
      where: { id },
      select: { id: true },
    });
  }

  // --------------------------------------------------------------- variantes

  async listarVariantes(): Promise<VarianteRespuesta[]> {
    return this.prisma.variante.findMany({
      select: SELECT_VARIANTE,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    });
  }

  async buscarVariantePorId(
    id: string,
    cliente?: ClienteProductos,
  ): Promise<VarianteRespuesta | null> {
    return this.db(cliente).variante.findUnique({
      where: { id },
      select: SELECT_VARIANTE,
    });
  }

  /** Numero de ofertas en cualquier sucursal que usen esta variante. */
  async contarOfertasDeVariante(
    varianteId: string,
    cliente?: ClienteProductos,
  ): Promise<number> {
    return this.db(cliente).productoSucursalVariante.count({
      where: { varianteId },
    });
  }

  async existeVariante(
    id: string,
    cliente?: ClienteProductos,
  ): Promise<boolean> {
    const variante = await this.db(cliente).variante.findUnique({
      where: { id },
      select: { id: true },
    });
    return variante !== null;
  }

  async nombreVarianteEnUso(
    nombre: string,
    exceptoVarianteId?: string,
    cliente?: ClienteProductos,
  ): Promise<boolean> {
    const variantes: NombreYId[] = await this.db(cliente).variante.findMany({
      select: SELECT_NOMBRE_Y_ID,
    });

    return variantes.some(
      (v) => v.id !== exceptoVarianteId && mismoNombre(v.nombre, nombre),
    );
  }

  async crearVariante(
    nombre: string,
    cliente?: ClienteProductos,
  ): Promise<VarianteRespuesta> {
    return this.db(cliente).variante.create({
      data: { nombre },
      select: SELECT_VARIANTE,
    });
  }

  async actualizarVariante(
    id: string,
    nombre: string,
    cliente?: ClienteProductos,
  ): Promise<VarianteRespuesta> {
    return this.db(cliente).variante.update({
      where: { id },
      data: { nombre },
      select: SELECT_VARIANTE,
    });
  }

  async eliminarVariante(
    id: string,
    cliente?: ClienteProductos,
  ): Promise<void> {
    await this.db(cliente).variante.delete({
      where: { id },
      select: { id: true },
    });
  }

  // --------------------------------------------------------------- productos

  /**
   * Listado paginado con filtro por categoria y busqueda por nombre.
   *
   * La busqueda ignora mayusculas con `mode: 'insensitive'`. Aqui no hace falta
   * colapsar espacios: es una busqueda difusa, no una comprobacion de unicidad.
   */
  async listarProductos(
    filtros: FiltrosListadoProductos,
  ): Promise<ProductoRespuesta[]> {
    return this.prisma.producto.findMany({
      where: this.whereProductos(filtros),
      select: SELECT_PRODUCTO,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      skip: (filtros.page - 1) * filtros.limit,
      take: filtros.limit,
    });
  }

  async contarProductos(filtros: FiltrosListadoProductos): Promise<number> {
    return this.prisma.producto.count({ where: this.whereProductos(filtros) });
  }

  async buscarProductoPorId(
    id: string,
    cliente?: ClienteProductos,
  ): Promise<ProductoRespuesta | null> {
    return this.db(cliente).producto.findUnique({
      where: { id },
      select: SELECT_PRODUCTO,
    });
  }

  async existeProducto(
    id: string,
    cliente?: ClienteProductos,
  ): Promise<boolean> {
    const producto = await this.db(cliente).producto.findUnique({
      where: { id },
      select: { id: true },
    });
    return producto !== null;
  }

  /** Numero de ofertas en cualquier sucursal de este producto. */
  async contarOfertasDeProducto(
    productoId: string,
    cliente?: ClienteProductos,
  ): Promise<number> {
    return this.db(cliente).productoSucursalVariante.count({
      where: { productoId },
    });
  }

  /**
   * true si el nombre ya lo usa otro producto DE LA MISMA CATEGORIA, ignorando
   * mayusculas y espacios sobrantes. `exceptoProductoId` deja que conserve su
   * nombre al editarlo.
   */
  async nombreProductoEnUso(
    nombre: string,
    categoriaId: string,
    exceptoProductoId?: string,
    cliente?: ClienteProductos,
  ): Promise<boolean> {
    const productos = await this.db(cliente).producto.findMany({
      where: { categoriaId },
      select: SELECT_NOMBRE_Y_ID,
    });

    return productos.some(
      (p) => p.id !== exceptoProductoId && mismoNombre(p.nombre, nombre),
    );
  }

  async crearProducto(
    datos: {
      nombre: string;
      categoriaId: string;
      descripcion?: string | null;
    },
    cliente?: ClienteProductos,
  ): Promise<ProductoRespuesta> {
    return this.db(cliente).producto.create({
      data: {
        nombre: datos.nombre,
        categoriaId: datos.categoriaId,
        descripcion: datos.descripcion ?? null,
      },
      select: SELECT_PRODUCTO,
    });
  }

  async actualizarProducto(
    id: string,
    data: { nombre?: string; categoriaId?: string; descripcion?: string | null },
    cliente?: ClienteProductos,
  ): Promise<ProductoRespuesta> {
    return this.db(cliente).producto.update({
      where: { id },
      data,
      select: SELECT_PRODUCTO,
    });
  }

  async eliminarProducto(
    id: string,
    cliente?: ClienteProductos,
  ): Promise<void> {
    await this.db(cliente).producto.delete({
      where: { id },
      select: { id: true },
    });
  }

  // ----------------------------------------------------------------- ofertas

  async existeSucursal(
    id: string,
    cliente?: ClienteProductos,
  ): Promise<boolean> {
    const sucursal = await this.db(cliente).sucursal.findUnique({
      where: { id },
      select: { id: true },
    });
    return sucursal !== null;
  }

  /**
   * Carta de una sucursal: las ofertas filtradas por los estados visibles.
   *
   * El filtro de estados y el que pide el cliente se combinan con `AND`, no
   * sobreescribiendose: asi un Empleado que pide `?estado=inactivo` no esquiva
   * su propia restriccion, y si `visibles` llegara vacio la consulta no devuelve
   * nada en vez de devolverlo todo.
   */
  async listarCarta(params: {
    sucursalId: string;
    estadosVisibles: EstadoOferta[];
    filtroEstado?: EstadoOferta;
  }): Promise<CartaFila[]> {
    const filas = await this.prisma.productoSucursalVariante.findMany({
      where: {
        AND: [
          { sucursalId: params.sucursalId },
          { estado: { in: params.estadosVisibles } },
          ...(params.filtroEstado !== undefined
            ? [{ estado: params.filtroEstado }]
            : []),
        ],
      },
      select: SELECT_CARTA,
      orderBy: [
        { producto: { nombre: 'asc' } },
        { variante: { nombre: 'asc' } },
      ],
    });

    return filas.map((f) => ({
      id: f.id,
      productoId: f.productoId,
      varianteId: f.varianteId,
      precio: f.precio.toFixed(2),
      estado: f.estado as EstadoOferta,
      producto: {
        id: f.producto.id,
        nombre: f.producto.nombre,
        categoriaId: f.producto.categoriaId,
        categoria: f.producto.categoria,
      },
      variante: f.variante,
    }));
  }

  /** Oferta previa (precio y estado) si existe, para derivar el evento. */
  async buscarOferta(
    productoId: string,
    sucursalId: string,
    varianteId: string,
    cliente?: ClienteProductos,
  ): Promise<OfertaRespuesta | null> {
    const oferta = await this.db(cliente).productoSucursalVariante.findUnique({
      where: {
        productoId_sucursalId_varianteId: {
          productoId,
          sucursalId,
          varianteId,
        },
      },
      select: SELECT_OFERTA,
    });

    if (oferta === null) {
      return null;
    }

    return {
      precio: oferta.precio.toFixed(2),
      estado: oferta.estado as EstadoOferta,
    };
  }

  /**
   * Crea o actualiza la oferta de una variante de un producto en una sucursal.
   * El `precio` llega ya como texto con dos decimales desde el servicio.
   */
  async upsertOferta(
    params: {
      productoId: string;
      sucursalId: string;
      varianteId: string;
      precio: string;
      estado: EstadoOferta;
    },
    cliente?: ClienteProductos,
  ): Promise<OfertaRespuesta & { id: string }> {
    const oferta = await this.db(cliente).productoSucursalVariante.upsert({
      where: {
        productoId_sucursalId_varianteId: {
          productoId: params.productoId,
          sucursalId: params.sucursalId,
          varianteId: params.varianteId,
        },
      },
      create: {
        productoId: params.productoId,
        sucursalId: params.sucursalId,
        varianteId: params.varianteId,
        precio: params.precio,
        estado: params.estado,
      },
      update: { precio: params.precio, estado: params.estado },
      select: SELECT_OFERTA,
    });

    return {
      id: oferta.id,
      precio: oferta.precio.toFixed(2),
      estado: oferta.estado as EstadoOferta,
    };
  }

  // ------------------------------------------------------------------ privado

  private whereProductos(
    filtros: FiltrosListadoProductos,
  ): Prisma.ProductoWhereInput {
    return {
      ...(filtros.categoriaId !== undefined ? { categoriaId: filtros.categoriaId } : {}),
      ...(filtros.busqueda !== undefined
        ? { nombre: { contains: filtros.busqueda, mode: 'insensitive' } }
        : {}),
    };
  }
}
