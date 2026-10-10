// Repositorio de empleados: todo el acceso a la tabla `empleado`.
//
// Decisiones que se repiten en cada metodo:
//
//   * `select` explicito en todas las consultas. Ningun listado pide columnas
//     que no usa, y `pin_hash` NO se incluye en ninguna respuesta.
//   * Cliente variable (`db`). Cada metodo acepta un cliente opcional para que
//     un caso de uso pueda meterlo en una transaccion y varias operaciones
//     committeen o fallen juntas. Sin cliente se usa `PrismaService`.
//   * Las lecturas de un solo registro que pueden caer dentro de una
//     transaccion (`buscarRespuestaPorId`, `crearEmpleado`, `marcarCese`) piden
//     la fila sin relaciones y resuelven `usuario` y su rol una detras de otra:
//     dentro de una transaccion todas las consultas van por la misma conexion y
//     el cliente de pg no admite solaparlas.
//
// OJO con los `import type` de esta clase: los tipos de fila SI se pueden
// importar con `import type`, pero `EmployeesRepository` NO. Los casos de uso la
// reciben por inyeccion y Nest necesita la clase en tiempo de ejecucion.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { $Enums, Prisma } from '../../../generated/prisma/client';

/**
 * Cliente con el que se puede trabajar tanto fuera como dentro de una
 * transaccion. `PrismaService` hereda de `PrismaClient`, asi que satisface el
 * mismo contrato que el cliente transaccional.
 */
export type ClienteEmpleados = PrismaService | Prisma.TransactionClient;

/** Empleado con su usuario vinculado, seguro para devolver en la API. */
export type EmpleadoRespuesta = {
  id: string;
  usuarioId: string;
  cargo: string;
  sucursalId: string;
  fechaContratacion: Date;
  fechaCese: Date | null;
  estado: $Enums.EmpleadoEstado;
  createdAt: Date;
  updatedAt: Date;
  usuario: { id: string; nombre: string; email: string; rol: string };
};

/** Lo minimo para decidir alcance, cese y reglas de negocio. */
export type EmpleadoAlcance = {
  id: string;
  usuarioId: string;
  sucursalId: string;
  estado: $Enums.EmpleadoEstado;
  fechaContratacion: Date;
};

/** Fila escalar de `empleado`, sin sus relaciones. */
type EmpleadoEscalares = {
  id: string;
  usuarioId: string;
  cargo: string;
  sucursalId: string;
  fechaContratacion: Date;
  fechaCese: Date | null;
  estado: $Enums.EmpleadoEstado;
  createdAt: Date;
  updatedAt: Date;
};

export type FiltrosListadoEmpleados = {
  page: number;
  limit: number;
  sucursalId?: string;
  estado?: string;
  busqueda?: string;
};

export type AlcanceEmpleadosFiltro = {
  sucursalId?: string;
  usuarioRol?: string;
};

const SELECT_EMPLEADO_RESPUESTA = {
  id: true,
  usuarioId: true,
  cargo: true,
  sucursalId: true,
  fechaContratacion: true,
  fechaCese: true,
  estado: true,
  createdAt: true,
  updatedAt: true,
  usuario: {
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: { select: { nombre: true } },
    },
  },
} satisfies Prisma.EmpleadoSelect;

const SELECT_EMPLEADO_ESCALARES = {
  id: true,
  usuarioId: true,
  cargo: true,
  sucursalId: true,
  fechaContratacion: true,
  fechaCese: true,
  estado: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EmpleadoSelect;

const SELECT_EMPLEADO_ALCANCE = {
  id: true,
  usuarioId: true,
  sucursalId: true,
  estado: true,
  fechaContratacion: true,
} satisfies Prisma.EmpleadoSelect;

@Injectable()
export class EmployeesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta `operacion` dentro de una transaccion y le pasa el cliente.
   *
   * Todas las consultas del caso de uso tienen que usar ese cliente, incluidas
   * las lecturas que condicionan una escritura.
   */
  async enTransaccion<T>(
    operacion: (cliente: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(operacion);
  }

  // ---------------------------------------------------------------- lecturas

  /** Empleado completo dentro del alcance del actor. */
  async buscarRespuestaEnAlcance(
    id: string,
    alcance: AlcanceEmpleadosFiltro | undefined,
    cliente?: ClienteEmpleados,
  ): Promise<EmpleadoRespuesta | null> {
    const empleado = await this.db(cliente).empleado.findFirst({
      where: {
        id,
        ...this.whereAlcance(alcance),
      },
      select: SELECT_EMPLEADO_RESPUESTA,
    });

    return empleado ? aEmpleadoRespuesta(empleado) : null;
  }

  /** Empleado completo por id, sin filtrar por alcance. */
  async buscarRespuestaPorId(
    id: string,
    cliente?: ClienteEmpleados,
  ): Promise<EmpleadoRespuesta | null> {
    const db = this.db(cliente);
    const escalares = await db.empleado.findUnique({
      where: { id },
      select: SELECT_EMPLEADO_ESCALARES,
    });

    return escalares ? this.conRelaciones(escalares, db) : null;
  }

  /**
   * Datos minimos de un empleado dentro del alcance, para el cese. Si el
   * empleado no esta en el alcance del actor devuelve null, para que la capa de
   * presentacion lo traduzca a 404.
   */
  async buscarAlcanceEnAlcance(
    id: string,
    alcance: AlcanceEmpleadosFiltro | undefined,
    cliente?: ClienteEmpleados,
  ): Promise<EmpleadoAlcance | null> {
    return this.db(cliente).empleado.findFirst({
      where: {
        id,
        ...this.whereAlcance(alcance),
      },
      select: SELECT_EMPLEADO_ALCANCE,
    });
  }

  async listar(
    filtros: FiltrosListadoEmpleados,
    alcance: AlcanceEmpleadosFiltro | undefined,
    cliente?: ClienteEmpleados,
  ): Promise<EmpleadoRespuesta[]> {
    const empleados = await this.db(cliente).empleado.findMany({
      where: this.construirWhere(filtros, alcance),
      select: SELECT_EMPLEADO_RESPUESTA,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (filtros.page - 1) * filtros.limit,
      take: filtros.limit,
    });

    return empleados.map((empleado) => aEmpleadoRespuesta(empleado));
  }

  async contar(
    filtros: FiltrosListadoEmpleados,
    alcance: AlcanceEmpleadosFiltro | undefined,
    cliente?: ClienteEmpleados,
  ): Promise<number> {
    return this.db(cliente).empleado.count({
      where: this.construirWhere(filtros, alcance),
    });
  }

  /** true si el usuario ya esta vinculado a un empleado. */
  async usuarioYaEsEmpleado(
    usuarioId: string,
    exceptoEmpleadoId?: string,
  ): Promise<boolean> {
    const empleado = await this.prisma.empleado.findUnique({
      where: { usuarioId },
      select: { id: true },
    });

    return empleado !== null && empleado.id !== exceptoEmpleadoId;
  }

  // --------------------------------------------------------------- escrituras

  async crearEmpleado(
    datos: {
      usuarioId: string;
      cargo: string;
      sucursalId: string;
      fechaContratacion: Date;
    },
    cliente?: ClienteEmpleados,
  ): Promise<EmpleadoRespuesta> {
    const db = this.db(cliente);
    const escalares = await db.empleado.create({
      data: datos,
      select: SELECT_EMPLEADO_ESCALARES,
    });

    return this.conRelaciones(escalares, db);
  }

  async actualizarCargo(
    id: string,
    cargo: string,
    cliente?: ClienteEmpleados,
  ): Promise<EmpleadoRespuesta> {
    const db = this.db(cliente);
    const escalares = await db.empleado.update({
      where: { id },
      data: { cargo },
      select: SELECT_EMPLEADO_ESCALARES,
    });

    return this.conRelaciones(escalares, db);
  }

  /**
   * Marca el cese y devuelve el empleado actualizado, o null si ya no estaba
   * activo. El `where` lleva el estado `activo` para que dos ceses simultaneos
   * no puedan ganar los dos: el segundo recibe `count = 0`.
   */
  async marcarCese(
    id: string,
    fechaCese: Date,
    cliente?: ClienteEmpleados,
  ): Promise<EmpleadoRespuesta | null> {
    const db = this.db(cliente);

    const { count } = await db.empleado.updateMany({
      where: { id, estado: 'activo' },
      data: { estado: 'inactivo', fechaCese },
    });

    if (count === 0) {
      return null;
    }

    const escalares = await db.empleado.findUnique({
      where: { id },
      select: SELECT_EMPLEADO_ESCALARES,
    });

    return escalares ? this.conRelaciones(escalares, db) : null;
  }

  async guardarPinHash(
    id: string,
    pinHash: string,
    cliente?: ClienteEmpleados,
  ): Promise<void> {
    await this.db(cliente).empleado.update({
      where: { id },
      data: { pinHash },
      select: { id: true },
    });
  }

  // ------------------------------------------------------------------ privado

  private db(cliente?: ClienteEmpleados): ClienteEmpleados {
    return cliente ?? this.prisma;
  }

  private whereAlcance(
    alcance: AlcanceEmpleadosFiltro | undefined,
  ): Prisma.EmpleadoWhereInput {
    return {
      ...(alcance?.sucursalId !== undefined
        ? { sucursalId: alcance.sucursalId }
        : {}),
      ...(alcance?.usuarioRol !== undefined
        ? { usuario: { rol: { nombre: alcance.usuarioRol } } }
        : {}),
    };
  }

  /**
   * Combina el alcance del actor con los filtros solicitados usando `AND`.
   *
   * No se fusionan con "spread" sobre un mismo objeto porque el ultimo en
   * escribirse gana: un Gerente podria ampliar su alcance pidiendo
   * `?sucursalId=<otra>`. Con `AND` ambos filtros se exigen a la vez.
   */
  private construirWhere(
    filtros: FiltrosListadoEmpleados,
    alcance: AlcanceEmpleadosFiltro | undefined,
  ): Prisma.EmpleadoWhereInput {
    const filtrosWhere: Prisma.EmpleadoWhereInput = {
      ...(filtros.sucursalId !== undefined
        ? { sucursalId: filtros.sucursalId }
        : {}),
      ...(filtros.estado !== undefined
        ? { estado: filtros.estado as $Enums.EmpleadoEstado }
        : {}),
      ...(filtros.busqueda !== undefined
        ? {
            OR: [
              { cargo: { contains: filtros.busqueda, mode: 'insensitive' } },
              {
                usuario: {
                  nombre: { contains: filtros.busqueda, mode: 'insensitive' },
                },
              },
              {
                usuario: {
                  email: { contains: filtros.busqueda, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    return { AND: [this.whereAlcance(alcance), filtrosWhere] };
  }

  /**
   * Resuelve `usuario` (y su rol) de un empleado, una consulta detras de otra.
   *
   * Es lo que Prisma haria solo al recibir un `select` con relaciones, pero
   * esperando a cada consulta antes de lanzar la siguiente: asi ninguna llega a
   * la conexion mientras otra sigue en vuelo, que es lo que el cliente de pg no
   * admite dentro de una transaccion.
   */
  private async conRelaciones(
    fila: EmpleadoEscalares,
    db: ClienteEmpleados,
  ): Promise<EmpleadoRespuesta> {
    const usuario = await db.usuario.findUnique({
      where: { id: fila.usuarioId },
      select: { id: true, nombre: true, email: true, rolId: true },
    });

    if (usuario === null) {
      // La clave ajena esta garantizada por el esquema: llegar aqui solo
      // podria pasar con datos rotos a mano.
      throw new Error(
        `El empleado ${fila.id} apunta a un usuario que ya no existe`,
      );
    }

    const rol = await db.rol.findUnique({
      where: { id: usuario.rolId },
      select: { nombre: true },
    });

    return {
      ...fila,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: rol?.nombre ?? '',
      },
    };
  }
}

function aEmpleadoRespuesta(fila: {
  id: string;
  usuarioId: string;
  cargo: string;
  sucursalId: string;
  fechaContratacion: Date;
  fechaCese: Date | null;
  estado: $Enums.EmpleadoEstado;
  createdAt: Date;
  updatedAt: Date;
  usuario: { id: string; nombre: string; email: string; rol: { nombre: string } };
}): EmpleadoRespuesta {
  return {
    id: fila.id,
    usuarioId: fila.usuarioId,
    cargo: fila.cargo,
    sucursalId: fila.sucursalId,
    fechaContratacion: fila.fechaContratacion,
    fechaCese: fila.fechaCese,
    estado: fila.estado,
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
    usuario: {
      id: fila.usuario.id,
      nombre: fila.usuario.nombre,
      email: fila.usuario.email,
      rol: fila.usuario.rol.nombre,
    },
  };
}
