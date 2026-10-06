// Repositorio de inventario: todo el acceso a las seis tablas del modulo.
//
// Decisiones que se repiten en cada metodo:
//
//   * `select` explicito en todas las consultas. Ningun listado pide columnas
//     que no usa.
//   * Cliente variable (`db`). Cada metodo acepta un cliente opcional para que un
//     caso de uso pueda meterlo en una transaccion y varias operaciones
//     committeen o fallen juntas. Sin cliente se usa `PrismaService`.
//   * `stock_actual <= stock_minimo` compara dos columnas de la misma fila, y el
//     API de filtros de Prisma no sabe expresar eso. Por eso el filtro
//     `soloBajoMinimo` resuelve los ids con SQL a mano y luego hidrata las filas
//     por Prisma, en vez de traer todo y filtrar en memoria.
//
// OJO con los `import type` de esta clase: los tipos de fila (`InsumoFila`,
// `StockFila`, `RecuentoFila`, ...) SI se pueden importar con `import type`,
// pero `InventoryRepository` NO. Los casos de uso la reciben por inyeccion, y
// Nest necesita la clase en tiempo de ejecucion para resolverla: con
// `import type { InventoryRepository }` el modulo se compila igual, `tsc` no
// dice nada, y el fallo sale al arrancar la app con "Nest can't resolve
// dependencies of the XxxUseCase". Los tipos van con `type` dentro del mismo
// `import`, no en un `import type` aparte.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  $Enums,
  Prisma,
  type AlertaStock,
  type Insumo,
  type InsumoSucursal,
  type MovimientoInventario,
  type RecuentoInventario,
  type RecuentoInventarioDetalle,
} from '../../../generated/prisma/client';
import { CANTIDAD_DECIMALES } from '../domain/rules/cantidades';
import type {
  EstadoAlertaStock,
  EstadoStockInsumo,
  TipoMovimientoInventario,
} from '../domain/rules/estados-insumo';
import type { PresentacionInsumo } from '../domain/rules/presentacion-insumo';

/**
 * Cliente con el que se puede trabajar tanto fuera como dentro de una
 * transaccion. `PrismaService` hereda de `PrismaClient`, asi que satisface el
 * mismo contrato que el cliente transaccional.
 */
export type ClienteInventario = PrismaService | Prisma.TransactionClient;

/*
 * Los enums se redeclaran como texto plano en el dominio (`estados-insumo` y
 * `presentacion-insumo`) para que las reglas puras y los DTO no dependan de
 * Prisma. Estas comprobaciones son la red de seguridad: si alguien anade un valor
 * al enum de la base y olvida la lista del dominio, o al reves, el `build` falla
 * en vez de dejar un filtro que acepta un valor que la base va a rechazar.
 *
 * `Coincide` exige que ambos conjuntos se contengan mutuamente. Si dejan de
 * coincidir, el tipo se vuelve `never` y la asignacion de abajo deja de
 * compilar.
 */
type Coincide<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

type _PresentacionCoincide = Coincide<
  (typeof $Enums.InsumoPresentacion)[keyof typeof $Enums.InsumoPresentacion],
  PresentacionInsumo
>;
type _EstadoStockCoincide = Coincide<
  (typeof $Enums.InsumoSucursalEstado)[keyof typeof $Enums.InsumoSucursalEstado],
  EstadoStockInsumo
>;
type _TipoMovimientoCoincide = Coincide<
  (typeof $Enums.MovimientoInventarioTipo)[keyof typeof $Enums.MovimientoInventarioTipo],
  TipoMovimientoInventario
>;
type _EstadoAlertaCoincide = Coincide<
  (typeof $Enums.AlertaStockEstado)[keyof typeof $Enums.AlertaStockEstado],
  EstadoAlertaStock
>;

export const ENUMS_INVENTARIO_COINCIDEN_CON_LA_BASE: [
  _PresentacionCoincide,
  _EstadoStockCoincide,
  _TipoMovimientoCoincide,
  _EstadoAlertaCoincide,
] = [true, true, true, true];

// --------------------------------------------------------------------- tipos
//
// Los tipos de salida de este repositorio NO son los de Prisma. Toda columna
// `Decimal` sale ya como texto con exactamente dos decimales.
//
// El motivo es que el `Decimal` de Prisma se serializa a JSON con la escala con la
// que se construyo, y eso depende de como llego el valor: un `stock_actual` leido
// de la base puede salir `"8"` y otro `"8.00"` segun como se escribiera antes. Un
// cliente que compare strings no puede fiarse de eso. Fijando la escala en la
// frontera de la base, la respuesta es siempre la misma forma y los casos de uso
// trabajan con `string` sin sorpresas.

/** Fila de `insumo` tal y como la devuelve la base. */
export type InsumoFila = Pick<
  Insumo,
  'id' | 'nombre' | 'presentacion' | 'createdAt' | 'updatedAt'
>;

/** Fila de `insumo_sucursal` con los decimales ya en texto. */
export type InsumoSucursalFila = Omit<
  Pick<
    InsumoSucursal,
    | 'id'
    | 'insumoId'
    | 'sucursalId'
    | 'stockActual'
    | 'stockMinimo'
    | 'estado'
    | 'createdAt'
    | 'updatedAt'
  >,
  'stockActual' | 'stockMinimo' | 'estado'
> & {
  stockActual: string;
  stockMinimo: string;
  estado: EstadoStockInsumo;
};

/** Fila de `insumo_sucursal` con la cabecera del insumo anadida. */
export type StockFila = InsumoSucursalFila & {
  insumo: InsumoFila;
};

/** Movimiento con `cantidad` en texto. */
export type MovimientoFila = Omit<MovimientoInventario, 'cantidad' | 'tipo'> & {
  cantidad: string;
  tipo: TipoMovimientoInventario;
};

export type RecuentoFila = RecuentoInventario;

export type AlertaFila = Omit<AlertaStock, 'estado'> & {
  estado: EstadoAlertaStock;
};

/** Linea de un recuento con el stock y el insumo anadidos. */
export type RecuentoDetalleFila = Omit<
  Pick<
    RecuentoInventarioDetalle,
    | 'id'
    | 'recuentoId'
    | 'insumoSucursalId'
    | 'stockSistema'
    | 'stockFisico'
    | 'diferencia'
    | 'createdAt'
  >,
  'stockSistema' | 'stockFisico' | 'diferencia'
> & {
  stockSistema: string;
  stockFisico: string;
  diferencia: string;
  insumoSucursal: StockFila;
};

/** Recuento con sus lineas, el usuario que lo hizo y la sucursal. */
export type RecuentoCompletoFila = RecuentoFila & {
  usuario: { id: string; nombre: string };
  sucursal: { id: string; nombre: string };
  detalles: RecuentoDetalleFila[];
};

/** Alerta con el stock y el insumo anadidos, para poder mostrarla completa. */
export type AlertaConContextoFila = AlertaFila & {
  insumoSucursal: StockFila;
};

// --------------------------------------------------------------------- select

const SELECT_INSUMO = {
  id: true,
  nombre: true,
  presentacion: true,
  createdAt: true,
  updatedAt: true,
} as const;

const SELECT_INSUMO_SUCURSAL = {
  id: true,
  insumoId: true,
  sucursalId: true,
  stockActual: true,
  stockMinimo: true,
  estado: true,
  createdAt: true,
  updatedAt: true,
} as const;

const SELECT_MOVIMIENTO = {
  id: true,
  insumoSucursalId: true,
  tipo: true,
  cantidad: true,
  usuarioId: true,
  motivo: true,
  createdAt: true,
} as const;

const SELECT_RECUENTO = {
  id: true,
  sucursalId: true,
  usuarioId: true,
  createdAt: true,
} as const;

const SELECT_ALERTA = {
  id: true,
  insumoSucursalId: true,
  estado: true,
  fechaResuelta: true,
  createdAt: true,
  updatedAt: true,
} as const;

const SELECT_STOCK = {
  ...SELECT_INSUMO_SUCURSAL,
  insumo: { select: SELECT_INSUMO },
} as const;

const SELECT_ALERTA_CON_CONTEXTO = {
  ...SELECT_ALERTA,
  insumoSucursal: { select: SELECT_STOCK },
} as const;

const SELECT_RECUENTO_DETALLE = {
  id: true,
  recuentoId: true,
  insumoSucursalId: true,
  stockSistema: true,
  stockFisico: true,
  diferencia: true,
  createdAt: true,
  insumoSucursal: { select: SELECT_STOCK },
} as const;

const SELECT_RECUENTO_COMPLETO = {
  ...SELECT_RECUENTO,
  usuario: { select: { id: true, nombre: true } },
  sucursal: { select: { id: true, nombre: true } },
  detalles: { select: SELECT_RECUENTO_DETALLE },
} as const;

// -------------------------------------------------------------------- mappers
//
// Traducen una fila cruda de Prisma al tipo de salida del modulo. Todo metodo
// que devuelva una de estas filas pasa por aqui, para que no se escape ninguna sin
// convertir y la escala de los decimales sea siempre la misma.

/** Lo que Prisma devuelve para `insumo_sucursal` con el `Decimal` sin tocar. */
type FilaStockCruda = Prisma.InsumoSucursalGetPayload<{ select: typeof SELECT_STOCK }>;

function aStock(fila: FilaStockCruda): StockFila {
  return {
    ...fila,
    stockActual: fila.stockActual.toFixed(CANTIDAD_DECIMALES),
    stockMinimo: fila.stockMinimo.toFixed(CANTIDAD_DECIMALES),
  };
}

function aMovimiento(
  fila: Prisma.MovimientoInventarioGetPayload<{ select: typeof SELECT_MOVIMIENTO }>,
): MovimientoFila {
  return {
    ...fila,
    cantidad: fila.cantidad.toFixed(CANTIDAD_DECIMALES),
  };
}

function aMovimientos(
  filas: Prisma.MovimientoInventarioGetPayload<{ select: typeof SELECT_MOVIMIENTO }>[],
): MovimientoFila[] {
  return filas.map(aMovimiento);
}

function aAlerta(
  fila: Prisma.AlertaStockGetPayload<{ select: typeof SELECT_ALERTA }>,
): AlertaFila {
  return { ...fila };
}

function aAlertasConContexto(
  filas: Prisma.AlertaStockGetPayload<{ select: typeof SELECT_ALERTA_CON_CONTEXTO }>[],
): AlertaConContextoFila[] {
  return filas.map((fila) => ({
    ...fila,
    insumoSucursal: aStock(fila.insumoSucursal),
  }));
}

function aDetalle(
  fila: Prisma.RecuentoInventarioDetalleGetPayload<{
    select: typeof SELECT_RECUENTO_DETALLE;
  }>,
): RecuentoDetalleFila {
  return {
    ...fila,
    stockSistema: fila.stockSistema.toFixed(CANTIDAD_DECIMALES),
    stockFisico: fila.stockFisico.toFixed(CANTIDAD_DECIMALES),
    diferencia: fila.diferencia.toFixed(CANTIDAD_DECIMALES),
    insumoSucursal: aStock(fila.insumoSucursal),
  };
}

function aRecuentoCompleto(
  fila: Prisma.RecuentoInventarioGetPayload<{ select: typeof SELECT_RECUENTO_COMPLETO }>,
): RecuentoCompletoFila {
  return { ...fila, detalles: fila.detalles.map(aDetalle) };
}

// -------------------------------------------------------------------- filtros

export type FiltrosListadoInsumos = {
  page: number;
  limit: number;
  busqueda?: string;
  presentacion?: PresentacionInsumo;
};

export type FiltrosListadoStock = {
  page: number;
  limit: number;
  sucursalId: string;
  estado?: EstadoStockInsumo;
  soloBajoMinimo?: boolean;
  busqueda?: string;
};

export type FiltrosListadoMovimientos = {
  page: number;
  limit: number;
  /**
   * Sucursal obligatoria. El movimiento pertenece a un `insumo_sucursal`, que a
   * su vez pertenece a una sucursal, asi que sin este filtro un listado sin
   * `insumoId` devolveria el historico de todas las sucursales.
   */
  sucursalId: string;
  insumoSucursalId?: string;
  tipo?: TipoMovimientoInventario;
  desde?: Date;
  hasta?: Date;
};

export type FiltrosListadoRecuentos = {
  page: number;
  limit: number;
  sucursalId?: string;
};

export type FiltrosListadoAlertas = {
  page: number;
  limit: number;
  sucursalId?: string;
  estado?: EstadoAlertaStock;
};

/** Linea a insertar en `recuento_inventario_detalle`. */
export type DetalleRecuentoEntrada = {
  insumoSucursalId: string;
  stockSistema: string;
  stockFisico: string;
  diferencia: string;
};

/** Movimiento a insertar, ya resuelto por el caso de uso. */
export type MovimientoEntrada = {
  insumoSucursalId: string;
  tipo: TipoMovimientoInventario;
  cantidad: string;
  usuarioId: string;
  motivo: string;
};

/** Codigo con el que Prisma marca una violacion de indice unico. */
export const CODIGO_UNIQUE_VIOLADO = 'P2002';

/**
 * true si el error es una violacion de unicidad.
 */
export function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === CODIGO_UNIQUE_VIOLADO
  );
}

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Cliente efectivo: el de la transaccion si se pasa, si no el global. */
  private db(cliente?: ClienteInventario): ClienteInventario {
    return cliente ?? this.prisma;
  }

  /**
   * Ejecuta `operacion` dentro de una transaccion y le pasa el cliente.
   *
   * Todas las consultas del caso de uso tienen que usar ese cliente, incluidas
   * las lecturas que condicionan una escritura. Si alguna se va al
   * `PrismaService` global estara leyendo fuera de la transaccion y no vera los
   * cambios propios.
   */
  async enTransaccion<T>(
    operacion: (cliente: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(operacion);
  }

  // ------------------------------------------------------------------- insumos

  async listarInsumos(
    filtros: FiltrosListadoInsumos,
    cliente?: ClienteInventario,
  ): Promise<InsumoFila[]> {
    return this.db(cliente).insumo.findMany({
      where: whereInsumos(filtros),
      select: SELECT_INSUMO,
      orderBy: { nombre: 'asc' },
      skip: (filtros.page - 1) * filtros.limit,
      take: filtros.limit,
    });
  }

  async contarInsumos(
    filtros: FiltrosListadoInsumos,
    cliente?: ClienteInventario,
  ): Promise<number> {
    return this.db(cliente).insumo.count({ where: whereInsumos(filtros) });
  }

  async buscarInsumoPorId(
    id: string,
    cliente?: ClienteInventario,
  ): Promise<InsumoFila | null> {
    return this.db(cliente).insumo.findUnique({
      where: { id },
      select: SELECT_INSUMO,
    });
  }

/**
 * true si otro insumo distinto de `exceptoInsumoId` ya usa ese nombre.
 *
 * La comparacion no distingue mayusculas: "Cafe molido" y "CAFE MOLIDO" son el
 * mismo insumo para quien esta delante de la pantalla, y admitirlos como dos
 * produciria dos filas de stock que se parecen y no se pueden distinguir. El
 * nombre ya viene recortado de la regla de dominio, asi que no hay que comparar
 * espacios.
 *
 * El filtro es de aplicacion y por lo tanto no cierra la carrera: dos altas
 * simultaneas pueden leer `false` las dos. Para eso esta `bloquearNombreInsumo`.
 */
async nombreInsumoEnUso(
    nombre: string,
    exceptoInsumoId?: string,
    cliente?: ClienteInventario,
  ): Promise<boolean> {
    const total = await this.db(cliente).insumo.count({
      where: {
        nombre: { equals: nombre, mode: 'insensitive' },
        ...(exceptoInsumoId !== undefined ? { NOT: { id: exceptoInsumoId } } : {}),
      },
    });

    return total > 0;
  }

  /**
   * Retiene un candado de Postgres sobre el nombre hasta que termine la
   * transaccion en curso.
   *
 * `insumo.nombre` no tiene indice unico en la base, asi que el `count` anterior
   * por si solo deja pasar dos altas simultaneas con el mismo nombre: las dos
   * leerian cero y las dos insertarian. Este candado convierte el par
   * "comprobar e insertar" en una seccion critica: la segunda transaccion espera
   * a que la primera termine y entonces su `count` ya ve el nombre usado, con lo
   * que responde 409 en vez de duplicar.
   *
   * Es un candado de TRANSACCION (`pg_advisory_xact_lock`), no de sesion: se
   * libera solo al hacer `COMMIT` o `ROLLBACK`, asi que un fallo no deja la tabla
   * bloqueada para el resto del proceso de PostgreSQL.
   *
   * La clave es el hash del nombre normalizado en minusculas, de modo que
   * "Cafe" y "CAFE" compiten por el mismo candado. Dos nombres distintos pueden
   * compartir hash: solo se serializan entre si de mas, lo cual es inofensivo.
   * Llama siempre a esta funcion DENTRO de la transaccion que va a insertar.
   *
   * Va con `$executeRaw` y no con `$queryRaw` a proposito: `pg_advisory_xact_lock`
   * devuelve `void`, y el adaptador de Prisma no sabe deserializar una columna de
   * ese tipo ("Failed to deserialize column of type 'void'"), con lo que
   * `$queryRaw` responderia 500. `$executeRaw` solo mira cuantas filas toco la
   * sentencia y no intenta hidratar el resultado, que es justo lo que interesa
   * de una funcion cuyo unico efecto es dejar el candado puesto.
   */
  async bloquearNombreInsumo(
    nombre: string,
    cliente?: ClienteInventario,
  ): Promise<void> {
    await this.db(cliente).$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${nombre.toLowerCase()}))
    `;
  }

  async crearInsumo(
    datos: { nombre: string; presentacion: PresentacionInsumo },
    cliente?: ClienteInventario,
  ): Promise<InsumoFila> {
    return this.db(cliente).insumo.create({
      data: datos,
      select: SELECT_INSUMO,
    });
  }

  async actualizarInsumo(
    id: string,
    datos: { nombre?: string; presentacion?: PresentacionInsumo },
    cliente?: ClienteInventario,
  ): Promise<InsumoFila> {
    return this.db(cliente).insumo.update({
      where: { id },
      data: datos,
      select: SELECT_INSUMO,
    });
  }

  /** Numero de filas `insumo_sucursal` de un insumo: stock, alertas y recuentos. */
  async contarSucursalesDeInsumo(
    insumoId: string,
    cliente?: ClienteInventario,
  ): Promise<number> {
    return this.db(cliente).insumoSucursal.count({ where: { insumoId } });
  }

  async eliminarInsumo(id: string, cliente?: ClienteInventario): Promise<void> {
    await this.db(cliente).insumo.delete({ where: { id } });
  }

  /** true si el insumo existe en el catalogo global. */
  async existeInsumo(id: string, cliente?: ClienteInventario): Promise<boolean> {
    const total = await this.db(cliente).insumo.count({ where: { id } });

    return total > 0;
  }

  /**
   * Cuantos de esos ids existen en el catalogo.
   *
   * Una consulta en vez de una por insumo, que es lo que haria un
   * `existeInsumo` en bucle. El recuento compara el total con el numero de ids
   * pedidos para saber si falta alguno.
   */
  async contarInsumosPorIds(
    ids: string[],
    cliente?: ClienteInventario,
  ): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    return this.db(cliente).insumo.count({ where: { id: { in: ids } } });
  }

  /** true si la sucursal existe. */
  async existeSucursal(id: string, cliente?: ClienteInventario): Promise<boolean> {
    const total = await this.db(cliente).sucursal.count({ where: { id } });

    return total > 0;
  }

  // --------------------------------------------------------------------- stock

  async listarStock(
    filtros: FiltrosListadoStock,
    cliente?: ClienteInventario,
  ): Promise<StockFila[]> {
    const db = this.db(cliente);

if (filtros.soloBajoMinimo) {
      return this.listarStockBajoMinimo(filtros, db);
    }

    const filas = await db.insumoSucursal.findMany({
      where: whereStock(filtros),
      select: SELECT_STOCK,
      orderBy: [{ sucursalId: 'asc' }, { insumo: { nombre: 'asc' } }],
      skip: (filtros.page - 1) * filtros.limit,
      take: filtros.limit,
    });

    return filas.map(aStock);
  }

  async contarStock(
    filtros: FiltrosListadoStock,
    cliente?: ClienteInventario,
  ): Promise<number> {
    const db = this.db(cliente);

if (filtros.soloBajoMinimo) {
      // La condicion `stock_actual <= stock_minimo` tiene que estar TAMBIEN en
      // el conteo, no solo en el listado: si el total saliera de contar todas
      // las filas de la sucursal, `total` seria mayor que `data.length` y el
      // `totalPaginas` del sobre seria mentira.
      const [conteo] = await db.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT count(*) AS total
        FROM insumo_sucursal s
        INNER JOIN insumo i ON i.id = s.insumo_id
        WHERE ${whereStockCrudo(filtros)} AND s.stock_actual <= s.stock_minimo
      `);

      return Number(conteo.total);
    }

    return db.insumoSucursal.count({ where: whereStock(filtros) });
  }

async buscarStock(
    insumoId: string,
    sucursalId: string,
    cliente?: ClienteInventario,
  ): Promise<StockFila | null> {
    const fila = await this.db(cliente).insumoSucursal.findUnique({
      where: { insumoId_sucursalId: { insumoId, sucursalId } },
      select: SELECT_STOCK,
    });

    return fila === null ? null : aStock(fila);
  }

  /** Fila `insumo_sucursal` por su id, con el insumo anadido. */
  async buscarStockPorId(
    insumoSucursalId: string,
    cliente?: ClienteInventario,
  ): Promise<StockFila | null> {
    const fila = await this.db(cliente).insumoSucursal.findUnique({
      where: { id: insumoSucursalId },
      select: SELECT_STOCK,
    });

    return fila === null ? null : aStock(fila);
  }

  /**
   * Varias filas de stock por id, en una sola consulta.
   *
   * Los ids llegan ya bloqueados por `bloquearStocks`, asi que el `stock_actual`
   * que se lee aqui es el que va a quedar bajo el bloqueo.
   */
  async buscarStocksPorIds(
    ids: string[],
    cliente?: ClienteInventario,
  ): Promise<StockFila[]> {
    if (ids.length === 0) {
      return [];
    }

    const filas = await this.db(cliente).insumoSucursal.findMany({
      where: { id: { in: ids } },
      select: SELECT_STOCK,
    });

    return filas.map(aStock);
  }

  /**
   * Fija stock minimo y/o estado de la fila, creandola si no existia.
   *
   * El `upsert` cubre los dos casos de una: activar un insumo que aun no estaba
   * en esa sucursal, que nace con stock 0, y reconfigurar uno que ya estaba.
   *
   * `stock_minimo` solo se escribe si viene informado. Mandarlo siempre con su
   * valor por defecto (0) borraria el minimo que el usuario habia fijado al
   * mover el estado, que no es lo que pide la peticion.
   */
  async configurarStock(
    insumoId: string,
    sucursalId: string,
    datos: {
      stockMinimo?: string;
      estado?: EstadoStockInsumo;
    },
cliente?: ClienteInventario,
  ): Promise<StockFila> {
    const fila = await this.db(cliente).insumoSucursal.upsert({
      where: { insumoId_sucursalId: { insumoId, sucursalId } },
      create: {
        insumoId,
        sucursalId,
        stockMinimo: datos.stockMinimo ?? '0.00',
        estado: datos.estado ?? $Enums.InsumoSucursalEstado.activo,
      },
      update: {
        ...(datos.stockMinimo !== undefined ? { stockMinimo: datos.stockMinimo } : {}),
        ...(datos.estado !== undefined ? { estado: datos.estado } : {}),
      },
      select: SELECT_STOCK,
    });

    return aStock(fila);
  }

  /**
   * Suma `cantidad` al stock de forma atomica y devuelve la fila actualizada.
   *
   * El `increment` lo resuelve la base, no una lectura previa mas una
   * escritura: dos entradas simultaneas sobre la misma fila se sumarian bien.
   */
async incrementarStock(
    insumoSucursalId: string,
    cantidad: string,
    cliente?: ClienteInventario,
  ): Promise<StockFila> {
    const fila = await this.db(cliente).insumoSucursal.update({
      where: { id: insumoSucursalId },
      data: { stockActual: { increment: cantidad } },
      select: SELECT_STOCK,
    });

    return aStock(fila);
  }

  /** Fija el stock al valor contado, dentro de la transaccion del recuento. */
  async fijarStock(
    insumoSucursalId: string,
    stockFisico: string,
    cliente?: ClienteInventario,
  ): Promise<StockFila> {
    const fila = await this.db(cliente).insumoSucursal.update({
      where: { id: insumoSucursalId },
      data: { stockActual: stockFisico },
      select: SELECT_STOCK,
    });

    return aStock(fila);
  }

  /**
   * Bloquea en exclusivo las filas de stock de esos insumos en esa sucursal.
   *
   * Este es el `SELECT ... FOR UPDATE`. Sin el, dos recuentos simultaneos leerian
   * el mismo stock de sistema y el segundo machacaria el ajuste del primero.
   *
   * Se bloquean todas las filas del recuento de una vez, y siempre en el mismo
   * orden (por id de insumo), para que dos recuentos que incluyan los mismos
   * insumos no se bloqueen entre si en sentidos opuestos.
   *
* @returns los ids bloqueados, que pueden ser menos de los pedidos: un insumo
   * que no esta activo en esa sucursal no tiene fila que bloquear.
   *
   * El `IN` se arma con `Prisma.join`, sin castear la lista: `Prisma.join`
   * reparte los ids en un parametro por cada uno (`$1, $2, $3`), y colarle un
   * `::uuid[]` detras dejaria `IN ($1, $2, $3::uuid[])`, donde el ultimo
   * parametro llega como `uuid[]` y PostgreSQL responde `operator does not
   * exist: uuid = uuid[]`. PostgreSQL ya infiere el tipo de cada parametro
   * comparandolo con la columna `insumo_id`, que es uuid.
   */
  async bloquearStocks(
    insumoIds: string[],
    sucursalId: string,
    cliente?: ClienteInventario,
  ): Promise<string[]> {
    if (insumoIds.length === 0) {
      return [];
    }

    const ordenados = [...new Set(insumoIds)].sort();

    const filas = await this.db(cliente).$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM insumo_sucursal
      WHERE sucursal_id = ${sucursalId}::uuid
        AND insumo_id IN (${Prisma.join(ordenados)})
      ORDER BY id
      FOR UPDATE
    `);

    return filas.map((fila) => fila.id);
  }

  /**
   * Resuelve los ids y el total del filtro "bajo minimo" con SQL a mano.
   *
   * La comparacion es entre dos columnas de la misma fila (`stock_actual` y
   * `stock_minimo`), cosa que el API de filtros de Prisma no expresa. Se
   * pagina aqui en SQL y despues se hidratan las filas con Prisma para no perder
   * el `insumo` anidado.
   */
  private async listarStockBajoMinimo(
    filtros: FiltrosListadoStock,
    cliente: ClienteInventario,
  ): Promise<StockFila[]> {
    const ids = await cliente.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT s.id
      FROM insumo_sucursal s
      INNER JOIN insumo i ON i.id = s.insumo_id
      WHERE ${whereStockCrudo(filtros)} AND s.stock_actual <= s.stock_minimo
      ORDER BY s.sucursal_id ASC, i.nombre ASC
      LIMIT ${filtros.limit} OFFSET ${(filtros.page - 1) * filtros.limit}
    `);

    const ordenados = ids.map((fila) => fila.id);

    if (ordenados.length === 0) {
      return [];
    }

    const filas = await cliente.insumoSucursal.findMany({
      where: { id: { in: ordenados } },
      select: SELECT_STOCK,
    });

    // `findMany` no garantiza el orden, y la paginacion depende del: las filas
    // se reordenan siguiendo el `id` que salio de la consulta paginada.
    const porId = new Map(filas.map((fila) => [fila.id, aStock(fila)]));

    return ordenados
      .map((id) => porId.get(id))
      .filter((fila): fila is StockFila => fila !== undefined);
  }

  // --------------------------------------------------------------- movimientos

  async crearMovimiento(
    movimiento: MovimientoEntrada,
    cliente?: ClienteInventario,
  ): Promise<MovimientoFila> {
    const fila = await this.db(cliente).movimientoInventario.create({
      data: movimiento,
      select: SELECT_MOVIMIENTO,
    });

    return aMovimiento(fila);
  }

  /**
   * Inserta varios movimientos a la vez, para los ajustes de un recuento.
   *
   * `createMany` no devuelve las filas creadas, y aqui no hacen falta: el
   * recuento ya guarda el stock de sistema, el contado y la diferencia.
   */
  async crearMovimientos(
    movimientos: MovimientoEntrada[],
    cliente?: ClienteInventario,
  ): Promise<number> {
    if (movimientos.length === 0) {
      return 0;
    }

    const { count } = await this.db(cliente).movimientoInventario.createMany({
      data: movimientos,
    });

    return count;
  }

async listarMovimientos(
    filtros: FiltrosListadoMovimientos,
    cliente?: ClienteInventario,
  ): Promise<MovimientoFila[]> {
    const filas = await this.db(cliente).movimientoInventario.findMany({
      where: whereMovimientos(filtros),
      select: SELECT_MOVIMIENTO,
      orderBy: { createdAt: 'desc' },
      skip: (filtros.page - 1) * filtros.limit,
      take: filtros.limit,
    });

    return aMovimientos(filas);
  }

  async contarMovimientos(
    filtros: FiltrosListadoMovimientos,
    cliente?: ClienteInventario,
  ): Promise<number> {
    return this.db(cliente).movimientoInventario.count({
      where: whereMovimientos(filtros),
    });
  }

  // ---------------------------------------------------------------- recuentos

  /**
   * Crea un recuento con sus lineas en una sola sentencia.
   *
   * El `create` con `detalles: { create: [...] }` es atomico: o se guarda el
   * recuento y todas sus lineas, o no se guarda nada. Un recuento sin lineas no
   * significa nada, asi que no tiene sentido guardarlo a medias.
   */
  async crearRecuento(
    datos: {
      sucursalId: string;
      usuarioId: string;
      detalles: DetalleRecuentoEntrada[];
    },
    cliente?: ClienteInventario,
  ): Promise<RecuentoFila> {
    return this.db(cliente).recuentoInventario.create({
      data: {
        sucursalId: datos.sucursalId,
        usuarioId: datos.usuarioId,
        detalles: {
          create: datos.detalles.map((detalle) => ({
            insumoSucursalId: detalle.insumoSucursalId,
            stockSistema: detalle.stockSistema,
            stockFisico: detalle.stockFisico,
            diferencia: detalle.diferencia,
          })),
        },
      },
      select: SELECT_RECUENTO,
    });
  }

async buscarRecuentoPorId(
    id: string,
    cliente?: ClienteInventario,
  ): Promise<RecuentoCompletoFila | null> {
    const fila = await this.db(cliente).recuentoInventario.findUnique({
      where: { id },
      select: SELECT_RECUENTO_COMPLETO,
    });

    return fila === null ? null : aRecuentoCompleto(fila);
  }

  async listarRecuentos(
    filtros: FiltrosListadoRecuentos,
    cliente?: ClienteInventario,
  ): Promise<RecuentoFila[]> {
    return this.db(cliente).recuentoInventario.findMany({
      where: whereRecuentos(filtros),
      select: SELECT_RECUENTO,
      orderBy: { createdAt: 'desc' },
      skip: (filtros.page - 1) * filtros.limit,
      take: filtros.limit,
    });
  }

  async contarRecuentos(
    filtros: FiltrosListadoRecuentos,
    cliente?: ClienteInventario,
  ): Promise<number> {
    return this.db(cliente).recuentoInventario.count({
      where: whereRecuentos(filtros),
    });
  }

  // ------------------------------------------------------------------ alertas

/**
   * Abre una alerta para un insumo en una sucursal, si no hay ya una abierta.
   *
   * Va con `createMany` y `skipDuplicates` a proposito, en vez de `create` con la
   * excepcion `P2002` atrapada en JavaScript. En PostgreSQL, una violacion de
   * unicidad ABORTA la transaccion: aunque el `catch` se tragase el error, la
   * siguiente sentencia fallaria con "current transaction is aborted" y el
   * `COMMIT` tambien. `ON CONFLICT DO NOTHING` no aborta nada, asi que la
   * transaccion sigue sana y el resultado es el mismo: como maximo una alerta
   * abierta por insumo, garantizado por el indice unico parcial
   * `alerta_stock_abierta_unica`.
   *
   * Por eso devuelve cuantos registros se insertaron de verdad:
   *   * 1 - se abrio la alerta,
   *   * 0 - ya habia una abierta, lo cual tambien es el estado buscado.
   *
   * Quien llama puede ignorar el valor; la diferencia es util para pruebas y para
   * dejar constancia de si esta transaccion fue la que abrio la alerta.
   */
  async abrirAlerta(
    insumoSucursalId: string,
    cliente?: ClienteInventario,
  ): Promise<number> {
    const { count } = await this.db(cliente).alertaStock.createMany({
      data: [{ insumoSucursalId, estado: $Enums.AlertaStockEstado.abierta }],
      skipDuplicates: true,
    });

    return count;
  }

  /** Cierra la alerta abierta de un insumo. No toca las ya resueltas. */
  async resolverAlerta(
    insumoSucursalId: string,
    cliente?: ClienteInventario,
  ): Promise<number> {
    const { count } = await this.db(cliente).alertaStock.updateMany({
      where: {
        insumoSucursalId,
        estado: $Enums.AlertaStockEstado.abierta,
      },
      data: {
        estado: $Enums.AlertaStockEstado.resuelta,
        fechaResuelta: new Date(),
      },
    });

    return count;
  }

  /** La alerta ABIERTA de un insumo, o null si no hay ninguna. */
async alertaAbierta(
    insumoSucursalId: string,
    cliente?: ClienteInventario,
  ): Promise<AlertaFila | null> {
    const fila = await this.db(cliente).alertaStock.findFirst({
      where: {
        insumoSucursalId,
        estado: $Enums.AlertaStockEstado.abierta,
      },
      orderBy: { createdAt: 'desc' },
      select: SELECT_ALERTA,
    });

    return fila === null ? null : aAlerta(fila);
  }

async listarAlertas(
    filtros: FiltrosListadoAlertas,
    cliente?: ClienteInventario,
  ): Promise<AlertaConContextoFila[]> {
    const filas = await this.db(cliente).alertaStock.findMany({
      where: whereAlertas(filtros),
      select: SELECT_ALERTA_CON_CONTEXTO,
      orderBy: { createdAt: 'desc' },
      skip: (filtros.page - 1) * filtros.limit,
      take: filtros.limit,
    });

    return aAlertasConContexto(filas);
  }

  async contarAlertas(
    filtros: FiltrosListadoAlertas,
    cliente?: ClienteInventario,
  ): Promise<number> {
    return this.db(cliente).alertaStock.count({ where: whereAlertas(filtros) });
  }
}

// --------------------------------------------------------------------- where

function whereInsumos(
  filtros: Pick<FiltrosListadoInsumos, 'busqueda' | 'presentacion'>,
): Prisma.InsumoWhereInput {
  return {
    ...(filtros.presentacion !== undefined
      ? { presentacion: filtros.presentacion as $Enums.InsumoPresentacion }
      : {}),
    ...(filtros.busqueda !== undefined
      ? { nombre: { contains: filtros.busqueda, mode: 'insensitive' } }
      : {}),
  };
}

function whereStock(
  filtros: Omit<FiltrosListadoStock, 'page' | 'limit' | 'soloBajoMinimo'>,
): Prisma.InsumoSucursalWhereInput {
  return {
    sucursalId: filtros.sucursalId,
    ...(filtros.estado !== undefined
      ? { estado: filtros.estado as $Enums.InsumoSucursalEstado }
      : {}),
    ...(filtros.busqueda !== undefined
      ? { insumo: { nombre: { contains: filtros.busqueda, mode: 'insensitive' } } }
      : {}),
  };
}

/**
 * Version en SQL del filtro de stock, para el camino "bajo minimo".
 *
 * Solo cubre lo que ese camino necesita. La busqueda por nombre va con
 * `ILIKE` porque el filtro de Prisma usa `mode: 'insensitive'`, que es
 * justamente un `ILIKE`.
 */
function whereStockCrudo(
  filtros: Omit<FiltrosListadoStock, 'page' | 'limit' | 'soloBajoMinimo'>,
): Prisma.Sql {
  return Prisma.sql`
    s.sucursal_id = ${filtros.sucursalId}::uuid
    ${
      filtros.estado !== undefined
        ? Prisma.sql`AND s.estado = ${filtros.estado}::insumo_sucursal_estado`
        : Prisma.empty
    }
    ${
      filtros.busqueda !== undefined
        ? Prisma.sql`AND i.nombre ILIKE ${`%${filtros.busqueda}%`}`
        : Prisma.empty
    }
  `;
}

function whereMovimientos(
  filtros: Omit<FiltrosListadoMovimientos, 'page' | 'limit'>,
): Prisma.MovimientoInventarioWhereInput {
  return {
    // Siempre por sucursal: es el filtro de alcance, no una opcion.
    insumoSucursal: { sucursalId: filtros.sucursalId },
    ...(filtros.insumoSucursalId !== undefined
      ? { insumoSucursalId: filtros.insumoSucursalId }
      : {}),
    ...(filtros.tipo !== undefined
      ? { tipo: filtros.tipo as $Enums.MovimientoInventarioTipo }
      : {}),
    ...(filtros.desde !== undefined || filtros.hasta !== undefined
      ? {
          createdAt: {
            ...(filtros.desde !== undefined ? { gte: filtros.desde } : {}),
            ...(filtros.hasta !== undefined ? { lte: filtros.hasta } : {}),
          },
        }
      : {}),
  };
}

function whereRecuentos(
  filtros: Omit<FiltrosListadoRecuentos, 'page' | 'limit'>,
): Prisma.RecuentoInventarioWhereInput {
  return filtros.sucursalId !== undefined ? { sucursalId: filtros.sucursalId } : {};
}

function whereAlertas(
  filtros: Omit<FiltrosListadoAlertas, 'page' | 'limit'>,
): Prisma.AlertaStockWhereInput {
  return {
    ...(filtros.estado !== undefined
      ? { estado: filtros.estado as $Enums.AlertaStockEstado }
      : {}),
    ...(filtros.sucursalId !== undefined
      ? { insumoSucursal: { sucursalId: filtros.sucursalId } }
      : {}),
  };
}
