// Repositorio de ventas: todo el acceso a las tablas del modulo.
//
// Decisiones que se repiten en cada metodo:
//
//   * `select` explicito en todas las consultas. Ningun listado pide columnas
//     que no usa, y anadir una columna a `venta` no cambia la respuesta de la
//     API por accidente.
//   * Cliente variable (`db`). Cada metodo acepta un cliente opcional para que
//     un caso de uso pueda meterlo en una transaccion y varias operaciones
//     committeen o fallen juntas. Sin cliente se usa `PrismaService`.
//   * Todo `Decimal` sale ya como texto con exactamente dos decimales. El
//     `Decimal` de Prisma se serializa a JSON con la escala con la que se
//     construyo, asi que un `subtotal` leido de la base podria salir `"8"` y
//     otro `"8.00"` segun como se escribiera antes. Fijando la escala en la
//     frontera, la respuesta es siempre la misma forma.
//
// OJO con los `import type` de esta clase: los tipos de fila SI se pueden
// importar con `import type`, pero `SalesRepository` NO. Los casos de uso la
// reciben por inyeccion, y Nest necesita la clase en tiempo de ejecucion para
// resolverla: con `import type { SalesRepository }` el modulo se compila igual,
// `tsc` no dice nada, y el fallo sale al arrancar la app con "Nest can't
// resolve dependencies of the XxxUseCase". Los tipos van con `type` dentro del
// mismo `import`, no en un `import type` aparte.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { $Enums, Prisma } from '../../../generated/prisma/client';
import type {
  EstadoOfertaVenta,
  EstadoVenta,
  MetodoPagoVenta,
} from '../domain/rules/estados-venta';
import { aCentimos, centimosATexto } from '../domain/rules/dinero';

/**
 * Cliente con el que se puede trabajar tanto fuera como dentro de una
 * transaccion. `PrismaService` hereda de `PrismaClient`, asi que satisface el
 * mismo contrato que el cliente transaccional.
 */
export type ClienteVentas = PrismaService | Prisma.TransactionClient;

/*
 * Comprobacion de que los estados del dominio y los de la base siguen siendo el
 * mismo conjunto. Si dejan de coincidir, el tipo se vuelve `never` y la
 * asignacion de abajo deja de compilar.
 */
type Coincide<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

type _MetodoPagoCoincide = Coincide<
  (typeof $Enums.VentaMetodoPago)[keyof typeof $Enums.VentaMetodoPago],
  MetodoPagoVenta
>;
type _EstadoVentaCoincide = Coincide<
  (typeof $Enums.VentaEstado)[keyof typeof $Enums.VentaEstado],
  EstadoVenta
>;
type _EstadoOfertaCoincide = Coincide<
  (typeof $Enums.ProductoSucursalVarianteEstado)[keyof typeof $Enums.ProductoSucursalVarianteEstado],
  EstadoOfertaVenta
>;

export const ENUMS_VENTAS_COINCIDEN_CON_LA_BASE: [
  _MetodoPagoCoincide,
  _EstadoVentaCoincide,
  _EstadoOfertaCoincide,
] = [true, true, true];

// ---------------------------------------------------------------------- tipos

/** Una oferta vendible, con el precio ya en texto. */
export type OfertaVenta = {
  id: string;
  productoId: string;
  sucursalId: string;
  varianteId: string;
  precio: string;
  estado: EstadoOfertaVenta;
  producto: { id: string; nombre: string };
  variante: { id: string; nombre: string };
};

/** Fila de `venta` con sus relaciones, sin los importes (no estan en la tabla). */
export type VentaFila = {
  id: string;
  sucursalId: string;
  usuarioId: string;
  metodoPago: MetodoPagoVenta;
  estado: EstadoVenta;
  fechaAnulacion: Date | null;
  usuarioAnuladorId: string | null;
  motivoAnulacion: string | null;
  createdAt: Date;
  updatedAt: Date;
  sucursal: { id: string; nombre: string };
  vendedor: { id: string; nombre: string };
  anulador: { id: string; nombre: string } | null;
};

/** Fila de `venta` sin sus relaciones, tal y como la devuelve la base. */
type VentaEscalares = {
  id: string;
  sucursalId: string;
  usuarioId: string;
  metodoPago: $Enums.VentaMetodoPago;
  estado: $Enums.VentaEstado;
  fechaAnulacion: Date | null;
  usuarioAnuladorId: string | null;
  motivoAnulacion: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Una linea de `venta_detalle`, con los dos decimales ya fijados. */
export type DetalleVentaFila = {
  id: string;
  productoSucursalVarianteId: string;
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
  producto: { id: string; nombre: string };
  variante: { id: string; nombre: string };
};

/** Venta con sus lineas. */
export type VentaCompleta = {
  venta: VentaFila;
  detalles: DetalleVentaFila[];
};

/**
 * Importe total y numero de lineas de una venta.
 *
 * La tabla `venta` no tiene columna de total: se suma de `venta_detalle`. No
 * guardar el total evita que el importe y sus lineas puedan discrepar si
 * alguna vez se corrige una venta por tambien.
 */
export type TotalesVenta = {
  total: string;
  lineas: number;
};

/** Totales de una venta sin lineas. */
export const TOTALES_VACIOS: TotalesVenta = { total: '0.00', lineas: 0 };

export type FiltrosVentas = {
  sucursalId?: string;
  estado?: EstadoVenta;
  metodoPago?: MetodoPagoVenta;
  /** Inicio inclusive del intervalo, en UTC. */
  desde?: Date;
  /** Fin exclusivo del intervalo, en UTC. */
  hasta?: Date;
};

export type LineaAInsertar = {
  productoSucursalVarianteId: string;
  cantidad: number;
  precioUnitarioSnapshot: string;
  subtotal: string;
};

// -------------------------------------------------------------------- selects

const SELECT_VENTA = {
  id: true,
  sucursalId: true,
  usuarioId: true,
  metodoPago: true,
  estado: true,
  fechaAnulacion: true,
  usuarioAnuladorId: true,
  motivoAnulacion: true,
  createdAt: true,
  updatedAt: true,
  sucursal: { select: { id: true, nombre: true } },
  vendedor: { select: { id: true, nombre: true } },
  anulador: { select: { id: true, nombre: true } },
} satisfies Prisma.VentaSelect;

/**
 * Los mismos campos escalares de `venta`, pero sin sus tres relaciones.
 *
 * Prisma resuelve `sucursal`, `vendedor` y `anulador` con consultas aparte y,
 * cuando la fila sale de un `create` o de un `findUnique`, las lanza todas a
 * la vez. Dentro de una transaccion las tres caen sobre la MISMA conexion y el
 * cliente de pg encola la segunda mientras la primera sigue en vuelo, lo que
 * repite en cada operacion el aviso "Calling client.query() when the client is
 * already executing a query" (deprecado en pg@9). Por eso, donde la lectura
 * entra en la transaccion, la fila se pide sin relaciones y
 * `conRelacionesDeVenta` las resuelve despues, una detras de otra.
 *
 * `listarVentas` no usa este select: un `findMany` reparte las relaciones con
 * una consulta por tabla y no solapa nada.
 */
const SELECT_VENTA_SIN_RELACIONES = {
  id: true,
  sucursalId: true,
  usuarioId: true,
  metodoPago: true,
  estado: true,
  fechaAnulacion: true,
  usuarioAnuladorId: true,
  motivoAnulacion: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VentaSelect;

const SELECT_DETALLE = {
  id: true,
  productoSucursalVarianteId: true,
  cantidad: true,
  precioUnitarioSnapshot: true,
  subtotal: true,
  productoSucursalVariante: {
    select: {
      producto: { select: { id: true, nombre: true } },
      variante: { select: { id: true, nombre: true } },
    },
  },
} satisfies Prisma.VentaDetalleSelect;

const SELECT_OFERTA = {
  id: true,
  productoId: true,
  sucursalId: true,
  varianteId: true,
  precio: true,
  estado: true,
  producto: { select: { id: true, nombre: true } },
  variante: { select: { id: true, nombre: true } },
} satisfies Prisma.ProductoSucursalVarianteSelect;

@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta `operacion` dentro de una transaccion y le pasa el cliente.
   *
   * Todas las consultas del caso de uso tienen que usar ese cliente, incluidas
   * las lecturas que condicionan una escritura. Si alguna se fuera al
   * `PrismaService` de fuera, la escritura podria confirmarse con una lectura
   * que otra transaccion ya habia dejado obsoleta.
   */
  async enTransaccion<T>(
    operacion: (cliente: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(operacion);
  }

  async existeSucursal(id: string, cliente?: ClienteVentas): Promise<boolean> {
    const total = await this.db(cliente).sucursal.count({ where: { id } });

    return total > 0;
  }

  // ------------------------------------------------------------------ ofertas

  /**
   * Carga las ofertas por id para registrar una venta.
   *
   * Se piden todas en una sola consulta y en el orden del `IN` se reordenan
   * despues: el caso de uso necesita encontrar cada linea por su id, y sin
   * reordenar `findMany` no garantiza ningun orden.
   *
   * Las que no existan simplemente no salen; el caso de uso es quien responde
   * 404.
   */
  async buscarOfertas(
    ids: readonly string[],
    cliente?: ClienteVentas,
  ): Promise<OfertaVenta[]> {
    if (ids.length === 0) {
      return [];
    }

    const filas = await this.db(cliente).productoSucursalVariante.findMany({
      where: { id: { in: [...ids] } },
      select: SELECT_OFERTA,
    });

    const porId = new Map(filas.map((fila) => [fila.id, aOferta(fila)]));

    return ids
      .map((id) => porId.get(id))
      .filter((oferta): oferta is OfertaVenta => oferta !== undefined);
  }

  // -------------------------------------------------------------------- ventas

  async buscarVentaCompleta(
    id: string,
    cliente?: ClienteVentas,
  ): Promise<VentaCompleta | null> {
    const db = this.db(cliente);

    const escalares = await db.venta.findUnique({
      where: { id },
      select: SELECT_VENTA_SIN_RELACIONES,
    });

    if (escalares === null) {
      return null;
    }

    const venta = await this.conRelacionesDeVenta(escalares, db);

    return { venta, detalles: await this.detallesDeVenta(id, db) };
  }

  /**
   * Lineas de una venta, con producto y variante ya resueltos.
   *
   * Tambien se usa al registrar: `createMany` no devuelve los ids que acaba de
   * crear, y la respuesta necesita los de verdad.
   */
  async detallesDeVenta(
    ventaId: string,
    cliente?: ClienteVentas,
  ): Promise<DetalleVentaFila[]> {
    const filas = await this.db(cliente).ventaDetalle.findMany({
      where: { ventaId },
      select: SELECT_DETALLE,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return filas.map((fila) => ({
      id: fila.id,
      productoSucursalVarianteId: fila.productoSucursalVarianteId,
      cantidad: fila.cantidad,
      precioUnitario: fila.precioUnitarioSnapshot.toFixed(2),
      subtotal: fila.subtotal.toFixed(2),
      producto: fila.productoSucursalVariante.producto,
      variante: fila.productoSucursalVariante.variante,
    }));
  }

  async crearVenta(
    datos: { sucursalId: string; usuarioId: string; metodoPago: MetodoPagoVenta },
    cliente?: ClienteVentas,
  ): Promise<VentaFila> {
    const db = this.db(cliente);

    const escalares = await db.venta.create({
      data: datos,
      select: SELECT_VENTA_SIN_RELACIONES,
    });

    return this.conRelacionesDeVenta(escalares, db);
  }

  /**
   * Inserta las lineas de la venta.
   *
   * `createMany` no devuelve las filas creadas, y aqui no hacen falta: los
   * precios son los que acaba de leer el caso de uso y los subtotales los
   * calculo el, asi que el resultado de la insercion no aporta nada.
   */
  async crearDetalles(
    ventaId: string,
    lineas: readonly LineaAInsertar[],
    cliente?: ClienteVentas,
  ): Promise<number> {
    if (lineas.length === 0) {
      return 0;
    }

    const { count } = await this.db(cliente).ventaDetalle.createMany({
      data: lineas.map((linea) => ({ ventaId, ...linea })),
    });

    return count;
  }

  /**
   * Marca la venta como anulada con su motivo, su autor y su hora.
   *
   * El `where` lleva tambien el estado: si dos peticiones anularan la misma
   * venta a la vez, solo una encontraria la fila `completada` y la otra
   * recibira `count = 0` en vez de anular dos veces. Se usa `updateMany` en vez
   * de `update` porque `update` lanza cuando no encuentra fila, y distinguir
   * esa excepcion de un fallo real obligaria a mirar codigos de error de
   * Prisma. Devuelve `null` cuando nadie anulo nada.
   *
   * @returns la venta anulada, o `null` si no estaba completada.
   */
  async anularVenta(
    id: string,
    datos: {
      fechaAnulacion: Date;
      usuarioAnuladorId: string;
      motivoAnulacion: string;
    },
    cliente?: ClienteVentas,
  ): Promise<VentaFila | null> {
    const db = this.db(cliente);

    const { count } = await db.venta.updateMany({
      where: { id, estado: 'completada' },
      data: { estado: 'anulada', ...datos },
    });

    if (count === 0) {
      return null;
    }

    const escalares = await db.venta.findUnique({
      where: { id },
      select: SELECT_VENTA_SIN_RELACIONES,
    });

    if (escalares === null) {
      return null;
    }

    return this.conRelacionesDeVenta(escalares, db);
  }

  async listarVentas(
    filtros: FiltrosVentas,
    page: number,
    limit: number,
    cliente?: ClienteVentas,
  ): Promise<VentaFila[]> {
    const filas = await this.db(cliente).venta.findMany({
      where: whereVentas(filtros),
      select: SELECT_VENTA,
      // Las mas recientes primero, con el id como desempate: dos ventas
      // creadas en el mismo milisegundo se ordenarian siempre igual.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    });

    return filas.map(aVenta);
  }

  async contarVentas(
    filtros: FiltrosVentas,
    cliente?: ClienteVentas,
  ): Promise<number> {
    return this.db(cliente).venta.count({ where: whereVentas(filtros) });
  }

  /**
   * Total y numero de lineas de cada una de las ventas indicadas.
   *
   * El importe se suma de `venta_detalle`, no se guarda en `venta`, asi que
   * para listar hace falta una segunda consulta. Se piden todas las lineas de
   * la pagina de una vez y se suman aqui en centimos exactos: una consulta por
   * venta seria un juego de N idas y venidas, y sumar en coma flotante dejaria
   * los totales con errores de redondeo.
   */
  async totalesDeVentas(
    ventaIds: readonly string[],
    cliente?: ClienteVentas,
  ): Promise<Map<string, TotalesVenta>> {
    const totales = new Map<string, TotalesVenta>();

    if (ventaIds.length === 0) {
      return totales;
    }

    const lineas = await this.db(cliente).ventaDetalle.findMany({
      where: { ventaId: { in: [...ventaIds] } },
      select: { ventaId: true, subtotal: true },
    });

    for (const id of ventaIds) {
      totales.set(id, TOTALES_VACIOS);
    }

    for (const linea of lineas) {
      const centimos = aCentimos(linea.subtotal.toString());
      if (centimos === null) {
        throw new Error(
          `El subtotal guardado en la venta ${linea.ventaId} no es un importe valido`,
        );
      }

      const acumulado = totales.get(linea.ventaId) ?? TOTALES_VACIOS;
      const total = aCentimos(acumulado.total) ?? 0;

      totales.set(linea.ventaId, {
        total: centimosATexto(total + centimos),
        lineas: acumulado.lineas + 1,
      });
    }

    return totales;
  }

  // ------------------------------------------------------------------ privado

  /**
   * Resuelve `sucursal`, `vendedor` y `anulador` de una venta, una detras de
   * otra.
   *
   * Es lo que Prisma haria solo al recibir un `select` con relaciones, pero
   * esperando a cada consulta antes de lanzar la siguiente: asi ninguna llega
   * a la conexion mientras otra sigue en vuelo, que es lo que el cliente de pg
   * no admite dentro de una transaccion (ver `SELECT_VENTA_SIN_RELACIONES`).
   */
  private async conRelacionesDeVenta(
    fila: VentaEscalares,
    db: ClienteVentas,
  ): Promise<VentaFila> {
    const sucursal = await db.sucursal.findUnique({
      where: { id: fila.sucursalId },
      select: { id: true, nombre: true },
    });
    const vendedor = await db.usuario.findUnique({
      where: { id: fila.usuarioId },
      select: { id: true, nombre: true },
    });
    const anulador =
      fila.usuarioAnuladorId === null
        ? null
        : await db.usuario.findUnique({
            where: { id: fila.usuarioAnuladorId },
            select: { id: true, nombre: true },
          });

    if (sucursal === null || vendedor === null) {
      // Las dos claves ajenas estan garantizadas por el esquema: llegar aqui
      // solo podria pasar con datos rotos a mano.
      throw new Error(
        `La venta ${fila.id} apunta a una sucursal o a un usuario que ya no existe`,
      );
    }

    return aVenta({ ...fila, sucursal, vendedor, anulador });
  }

  private db(cliente?: ClienteVentas): ClienteVentas {
    return cliente ?? this.prisma;
  }
}

// ------------------------------------------------------------------ funciones

function aVenta(fila: {
  id: string;
  sucursalId: string;
  usuarioId: string;
  metodoPago: $Enums.VentaMetodoPago;
  estado: $Enums.VentaEstado;
  fechaAnulacion: Date | null;
  usuarioAnuladorId: string | null;
  motivoAnulacion: string | null;
  createdAt: Date;
  updatedAt: Date;
  sucursal: { id: string; nombre: string };
  vendedor: { id: string; nombre: string };
  anulador: { id: string; nombre: string } | null;
}): VentaFila {
  return {
    id: fila.id,
    sucursalId: fila.sucursalId,
    usuarioId: fila.usuarioId,
    metodoPago: fila.metodoPago as MetodoPagoVenta,
    estado: fila.estado as EstadoVenta,
    fechaAnulacion: fila.fechaAnulacion,
    usuarioAnuladorId: fila.usuarioAnuladorId,
    motivoAnulacion: fila.motivoAnulacion,
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
    sucursal: fila.sucursal,
    vendedor: fila.vendedor,
    anulador: fila.anulador,
  };
}

function aOferta(fila: {
  id: string;
  productoId: string;
  sucursalId: string;
  varianteId: string;
  precio: Prisma.Decimal;
  estado: $Enums.ProductoSucursalVarianteEstado;
  producto: { id: string; nombre: string };
  variante: { id: string; nombre: string };
}): OfertaVenta {
  return {
    id: fila.id,
    productoId: fila.productoId,
    sucursalId: fila.sucursalId,
    varianteId: fila.varianteId,
    precio: fila.precio.toFixed(2),
    estado: fila.estado as EstadoOfertaVenta,
    producto: fila.producto,
    variante: fila.variante,
  };
}

function whereVentas(filtros: FiltrosVentas): Prisma.VentaWhereInput {
  return {
    ...(filtros.sucursalId !== undefined ? { sucursalId: filtros.sucursalId } : {}),
    ...(filtros.estado !== undefined
      ? { estado: filtros.estado as $Enums.VentaEstado }
      : {}),
    ...(filtros.metodoPago !== undefined
      ? { metodoPago: filtros.metodoPago as $Enums.VentaMetodoPago }
      : {}),
    ...(filtros.desde !== undefined || filtros.hasta !== undefined
      ? {
          createdAt: {
            ...(filtros.desde !== undefined ? { gte: filtros.desde } : {}),
            ...(filtros.hasta !== undefined ? { lt: filtros.hasta } : {}),
          },
        }
      : {}),
  };
}
