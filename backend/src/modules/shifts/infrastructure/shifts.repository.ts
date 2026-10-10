// Repositorio de turnos y asignaciones: todo el acceso a `turno` y
// `asignacion_turno`.
//
// Decisiones que se repiten en cada metodo:
//
//   * `select` explicito en todas las consultas.
//   * Cliente variable (`db`). Cada metodo acepta un cliente opcional para que
//     un caso de uso pueda meterlo en una transaccion.
//   * La franja horaria se escribe y se lee como "HH:mm": la traduccion al
//     `Date` de la columna `time` vive en `domain/horas`.
//   * Los create/update que resuelven relaciones anidadas las resuelven con
//     consultas secuenciales, no con un `select` anidado: dentro de una
//     transaccion el cliente de pg no admite varias consultas en vuelo sobre la
//     misma conexion.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { $Enums, Prisma } from '../../../generated/prisma/client';
import { fechaAHora, horaADate } from '../domain/horas';

/** Cliente con el que se puede trabajar fuera o dentro de una transaccion. */
export type ClienteTurnos = PrismaService | Prisma.TransactionClient;

/** Turno seguro para devolver en la API. */
export type TurnoRespuesta = {
  id: string;
  sucursalId: string;
  tipo: $Enums.TurnoTipo;
  horaInicio: string | null;
  horaFin: string | null;
  diasSemana: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Asignacion con su empleado y su turno, segura para devolver. */
export type AsignacionRespuesta = {
  id: string;
  empleadoId: string;
  turnoId: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  createdAt: Date;
  updatedAt: Date;
  empleado: {
    id: string;
    cargo: string;
    sucursalId: string;
    usuario: { id: string; nombre: string; email: string };
  };
  turno: TurnoRespuesta;
};

/** Asignacion con el horario de su turno, para la regla de solapamiento. */
export type AsignacionHorarioFila = {
  id: string;
  empleadoId: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  turno: {
    tipo: $Enums.TurnoTipo;
    horaInicio: string | null;
    horaFin: string | null;
    diasSemana: string | null;
  };
};

/** Asignacion minima para recorrer un turno al editarlo. */
export type AsignacionDeTurno = {
  id: string;
  empleadoId: string;
  fechaInicio: Date;
  fechaFin: Date | null;
};

/** Datos minimos de una asignacion para decidir alcance y edicion. */
export type AsignacionAlcance = {
  id: string;
  empleadoId: string;
  turnoId: string;
  fechaInicio: Date;
  fechaFin: Date | null;
};

export type FiltrosListadoTurnos = {
  page: number;
  limit: number;
  sucursalId?: string;
  tipo?: string;
};

export type FiltrosListadoAsignaciones = {
  page: number;
  limit: number;
  empleadoId?: string;
  turnoId?: string;
  /** Si es true, solo las vigentes hoy (`hoy` en el calendario del negocio). */
  vigente?: boolean;
  hoy: string;
};

export type AlcanceTurnosFiltro = {
  sucursalId?: string;
};

export type AlcanceEmpleadosFiltro = {
  sucursalId?: string;
  usuarioRol?: string;
};

type TurnoEscalares = {
  id: string;
  sucursalId: string;
  tipo: $Enums.TurnoTipo;
  horaInicio: Date | null;
  horaFin: Date | null;
  diasSemana: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AsignacionEscalares = {
  id: string;
  empleadoId: string;
  turnoId: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const SELECT_TURNO = {
  id: true,
  sucursalId: true,
  tipo: true,
  horaInicio: true,
  horaFin: true,
  diasSemana: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TurnoSelect;

const SELECT_ASIGNACION_DE_TURNO = {
  id: true,
  empleadoId: true,
  fechaInicio: true,
  fechaFin: true,
} satisfies Prisma.AsignacionTurnoSelect;

const SELECT_ASIGNACION_ALCANCE = {
  id: true,
  empleadoId: true,
  turnoId: true,
  fechaInicio: true,
  fechaFin: true,
} satisfies Prisma.AsignacionTurnoSelect;

const SELECT_ASIGNACION_RESPUESTA = {
  id: true,
  empleadoId: true,
  turnoId: true,
  fechaInicio: true,
  fechaFin: true,
  createdAt: true,
  updatedAt: true,
  empleado: {
    select: {
      id: true,
      cargo: true,
      sucursalId: true,
      usuario: { select: { id: true, nombre: true, email: true } },
    },
  },
  turno: { select: SELECT_TURNO },
} satisfies Prisma.AsignacionTurnoSelect;

@Injectable()
export class ShiftsRepository {
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

  // ------------------------------------------------------------------- turnos

  async existeSucursal(
    sucursalId: string,
    cliente?: ClienteTurnos,
  ): Promise<boolean> {
    const total = await this.db(cliente).sucursal.count({ where: { id: sucursalId } });
    return total > 0;
  }

  /** Turno dentro del alcance del actor, con horas y dias ya en texto. */
  async buscarTurnoEnAlcance(
    id: string,
    alcance: AlcanceTurnosFiltro | undefined,
    cliente?: ClienteTurnos,
  ): Promise<TurnoRespuesta | null> {
    const turno = await this.db(cliente).turno.findFirst({
      where: { id, ...this.whereAlcanceTurnos(alcance) },
      select: SELECT_TURNO,
    });

    return turno ? aTurnoRespuesta(turno) : null;
  }

  async listarTurnos(
    filtros: FiltrosListadoTurnos,
    alcance: AlcanceTurnosFiltro | undefined,
    cliente?: ClienteTurnos,
  ): Promise<TurnoRespuesta[]> {
    const turnos = await this.db(cliente).turno.findMany({
      where: this.construirWhereTurnos(filtros, alcance),
      select: SELECT_TURNO,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (filtros.page - 1) * filtros.limit,
      take: filtros.limit,
    });

    return turnos.map((turno) => aTurnoRespuesta(turno));
  }

  async contarTurnos(
    filtros: FiltrosListadoTurnos,
    alcance: AlcanceTurnosFiltro | undefined,
    cliente?: ClienteTurnos,
  ): Promise<number> {
    return this.db(cliente).turno.count({
      where: this.construirWhereTurnos(filtros, alcance),
    });
  }

  async crearTurno(
    datos: {
      sucursalId: string;
      tipo: $Enums.TurnoTipo;
      horaInicio: string | null;
      horaFin: string | null;
      diasSemana: string | null;
    },
    cliente?: ClienteTurnos,
  ): Promise<TurnoRespuesta> {
    const turno = await this.db(cliente).turno.create({
      data: {
        sucursalId: datos.sucursalId,
        tipo: datos.tipo,
        horaInicio: datos.horaInicio === null ? null : horaADate(datos.horaInicio),
        horaFin: datos.horaFin === null ? null : horaADate(datos.horaFin),
        diasSemana: datos.diasSemana,
      },
      select: SELECT_TURNO,
    });

    return aTurnoRespuesta(turno);
  }

  async actualizarTurno(
    id: string,
    datos: {
      horaInicio: string | null;
      horaFin: string | null;
      diasSemana: string | null;
    },
    cliente?: ClienteTurnos,
  ): Promise<TurnoRespuesta> {
    const turno = await this.db(cliente).turno.update({
      where: { id },
      data: {
        horaInicio: datos.horaInicio === null ? null : horaADate(datos.horaInicio),
        horaFin: datos.horaFin === null ? null : horaADate(datos.horaFin),
        diasSemana: datos.diasSemana,
      },
      select: SELECT_TURNO,
    });

    return aTurnoRespuesta(turno);
  }

  // ------------------------------------------------------------- asignaciones

  /**
   * Bloquea en exclusivo la fila del empleado hasta que termine la transaccion.
   *
   * Es el `SELECT ... FOR UPDATE` que convierte el par "leer asignaciones e
   * insertar" en una seccion critica: dos altas simultaneas para el mismo
   * empleado se serializan, la segunda espera a que la primera haga COMMIT y su
   * lectura ya ve la asignacion recien creada, con lo que responde 409 en vez de
   * crear un solapamiento. Debe ser la PRIMERA lectura de la transaccion.
   */
  async bloquearEmpleado(
    empleadoId: string,
    cliente: Prisma.TransactionClient,
  ): Promise<void> {
    await cliente.$queryRaw(
      Prisma.sql`SELECT id FROM empleado WHERE id = ${empleadoId}::uuid FOR UPDATE`,
    );
  }

  /** Asignacion dentro del alcance de empleados del actor. */
  async buscarAsignacionAlcance(
    id: string,
    alcance: AlcanceEmpleadosFiltro | undefined,
    cliente?: ClienteTurnos,
  ): Promise<AsignacionAlcance | null> {
    return this.db(cliente).asignacionTurno.findFirst({
      where: { id, ...this.whereAlcanceEmpleado(alcance) },
      select: SELECT_ASIGNACION_ALCANCE,
    });
  }

  async listarAsignaciones(
    filtros: FiltrosListadoAsignaciones,
    alcance: AlcanceEmpleadosFiltro | undefined,
    cliente?: ClienteTurnos,
  ): Promise<AsignacionRespuesta[]> {
    const asignaciones = await this.db(cliente).asignacionTurno.findMany({
      where: this.construirWhereAsignaciones(filtros, alcance),
      select: SELECT_ASIGNACION_RESPUESTA,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (filtros.page - 1) * filtros.limit,
      take: filtros.limit,
    });

    return asignaciones.map((asignacion) => aAsignacionRespuesta(asignacion));
  }

  async contarAsignaciones(
    filtros: FiltrosListadoAsignaciones,
    alcance: AlcanceEmpleadosFiltro | undefined,
    cliente?: ClienteTurnos,
  ): Promise<number> {
    return this.db(cliente).asignacionTurno.count({
      where: this.construirWhereAsignaciones(filtros, alcance),
    });
  }

  /**
   * Asignaciones de un empleado con el horario de su turno.
   *
   * `exceptoId` deja fuera una asignacion concreta: al editar un turno hay que
   * comparar la asignacion editada contra las OTRAS del mismo empleado, no
   * contra si misma.
   *
   * Se resuelve en dos consultas escalares encadenadas (las asignaciones y
   * luego sus turnos) en vez de con un `select` anidado: este metodo se llama
   * dentro de una transaccion y el cliente de pg no admite consultas en vuelo
   * sobre la misma conexion.
   */
  async listarAsignacionesPorEmpleado(
    empleadoId: string,
    exceptoId?: string,
    cliente?: ClienteTurnos,
  ): Promise<AsignacionHorarioFila[]> {
    const db = this.db(cliente);
    const filas = await db.asignacionTurno.findMany({
      where: {
        empleadoId,
        ...(exceptoId !== undefined ? { NOT: { id: exceptoId } } : {}),
      },
      select: {
        id: true,
        empleadoId: true,
        turnoId: true,
        fechaInicio: true,
        fechaFin: true,
      },
    });

    if (filas.length === 0) {
      return [];
    }

    const turnoIds = [...new Set(filas.map((fila) => fila.turnoId))];
    const turnos = await db.turno.findMany({
      where: { id: { in: turnoIds } },
      select: SELECT_TURNO,
    });
    const porId = new Map(turnos.map((turno) => [turno.id, aTurnoRespuesta(turno)]));

    return filas.map((fila) => {
      const turno = porId.get(fila.turnoId);
      if (turno === undefined) {
        throw new Error(
          `La asignacion ${fila.id} apunta a un turno que ya no existe`,
        );
      }

      return {
        id: fila.id,
        empleadoId: fila.empleadoId,
        fechaInicio: fila.fechaInicio,
        fechaFin: fila.fechaFin,
        turno: {
          tipo: turno.tipo,
          horaInicio: turno.horaInicio,
          horaFin: turno.horaFin,
          diasSemana: turno.diasSemana,
        },
      };
    });
  }

  /** Asignaciones de un turno, para comprobar el impacto de editarlo. */
  async listarAsignacionesDeTurno(
    turnoId: string,
    cliente?: ClienteTurnos,
  ): Promise<AsignacionDeTurno[]> {
    return this.db(cliente).asignacionTurno.findMany({
      where: { turnoId },
      select: SELECT_ASIGNACION_DE_TURNO,
    });
  }

  async crearAsignacion(
    datos: {
      empleadoId: string;
      turnoId: string;
      fechaInicio: Date;
      fechaFin: Date | null;
    },
    cliente?: ClienteTurnos,
  ): Promise<AsignacionRespuesta> {
    const db = this.db(cliente);
    const escalares = await db.asignacionTurno.create({
      data: datos,
      select: {
        id: true,
        empleadoId: true,
        turnoId: true,
        fechaInicio: true,
        fechaFin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return this.conRelacionesAsignacion(escalares, db);
  }

  async retirarAsignacion(
    id: string,
    fechaFin: Date,
    cliente?: ClienteTurnos,
  ): Promise<AsignacionRespuesta> {
    const db = this.db(cliente);
    const escalares = await db.asignacionTurno.update({
      where: { id },
      data: { fechaFin },
      select: {
        id: true,
        empleadoId: true,
        turnoId: true,
        fechaInicio: true,
        fechaFin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return this.conRelacionesAsignacion(escalares, db);
  }

  // ------------------------------------------------------------------ privado

  private db(cliente?: ClienteTurnos): ClienteTurnos {
    return cliente ?? this.prisma;
  }

  private whereAlcanceTurnos(
    alcance: AlcanceTurnosFiltro | undefined,
  ): Prisma.TurnoWhereInput {
    return alcance?.sucursalId !== undefined
      ? { sucursalId: alcance.sucursalId }
      : {};
  }

  private whereAlcanceEmpleado(
    alcance: AlcanceEmpleadosFiltro | undefined,
  ): Prisma.AsignacionTurnoWhereInput {
    if (alcance === undefined) {
      return {};
    }

    return {
      empleado: {
        ...(alcance.sucursalId !== undefined
          ? { sucursalId: alcance.sucursalId }
          : {}),
        ...(alcance.usuarioRol !== undefined
          ? { usuario: { rol: { nombre: alcance.usuarioRol } } }
          : {}),
      },
    };
  }

  /**
   * Combina el alcance con los filtros pedidos usando `AND`, para que un filtro
   * contrario al alcance no lo pueda ampliar.
   */
  private construirWhereTurnos(
    filtros: FiltrosListadoTurnos,
    alcance: AlcanceTurnosFiltro | undefined,
  ): Prisma.TurnoWhereInput {
    const filtrosWhere: Prisma.TurnoWhereInput = {
      ...(filtros.sucursalId !== undefined ? { sucursalId: filtros.sucursalId } : {}),
      ...(filtros.tipo !== undefined
        ? { tipo: filtros.tipo as $Enums.TurnoTipo }
        : {}),
    };

    return { AND: [this.whereAlcanceTurnos(alcance), filtrosWhere] };
  }

  private construirWhereAsignaciones(
    filtros: FiltrosListadoAsignaciones,
    alcance: AlcanceEmpleadosFiltro | undefined,
  ): Prisma.AsignacionTurnoWhereInput {
    const hoy = new Date(`${filtros.hoy}T00:00:00.000Z`);
    const filtrosWhere: Prisma.AsignacionTurnoWhereInput = {
      ...(filtros.empleadoId !== undefined ? { empleadoId: filtros.empleadoId } : {}),
      ...(filtros.turnoId !== undefined ? { turnoId: filtros.turnoId } : {}),
      ...(filtros.vigente === true
        ? {
            fechaInicio: { lte: hoy },
            OR: [{ fechaFin: null }, { fechaFin: { gte: hoy } }],
          }
        : {}),
    };

    return { AND: [this.whereAlcanceEmpleado(alcance), filtrosWhere] };
  }

  /**
   * Resuelve `empleado` (con su usuario) y `turno` de una asignacion, una
   * consulta detras de otra, para poder usarse dentro de una transaccion.
   */
  private async conRelacionesAsignacion(
    fila: AsignacionEscalares,
    db: ClienteTurnos,
  ): Promise<AsignacionRespuesta> {
    const empleado = await db.empleado.findUnique({
      where: { id: fila.empleadoId },
      select: { id: true, cargo: true, sucursalId: true, usuarioId: true },
    });

    if (empleado === null) {
      throw new Error(
        `La asignacion ${fila.id} apunta a un empleado que ya no existe`,
      );
    }

    const usuario = await db.usuario.findUnique({
      where: { id: empleado.usuarioId },
      select: { id: true, nombre: true, email: true },
    });

    if (usuario === null) {
      throw new Error(
        `El empleado ${empleado.id} apunta a un usuario que ya no existe`,
      );
    }

    const turno = await db.turno.findUnique({
      where: { id: fila.turnoId },
      select: SELECT_TURNO,
    });

    if (turno === null) {
      throw new Error(
        `La asignacion ${fila.id} apunta a un turno que ya no existe`,
      );
    }

    return {
      id: fila.id,
      empleadoId: fila.empleadoId,
      turnoId: fila.turnoId,
      fechaInicio: fila.fechaInicio,
      fechaFin: fila.fechaFin,
      createdAt: fila.createdAt,
      updatedAt: fila.updatedAt,
      empleado: {
        id: empleado.id,
        cargo: empleado.cargo,
        sucursalId: empleado.sucursalId,
        usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email },
      },
      turno: aTurnoRespuesta(turno),
    };
  }
}

function aTurnoRespuesta(fila: TurnoEscalares): TurnoRespuesta {
  return {
    id: fila.id,
    sucursalId: fila.sucursalId,
    tipo: fila.tipo,
    horaInicio: fechaAHora(fila.horaInicio),
    horaFin: fechaAHora(fila.horaFin),
    diasSemana: fila.diasSemana,
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
  };
}

function aAsignacionRespuesta(fila: {
  id: string;
  empleadoId: string;
  turnoId: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  createdAt: Date;
  updatedAt: Date;
  empleado: {
    id: string;
    cargo: string;
    sucursalId: string;
    usuario: { id: string; nombre: string; email: string };
  };
  turno: TurnoEscalares;
}): AsignacionRespuesta {
  return {
    id: fila.id,
    empleadoId: fila.empleadoId,
    turnoId: fila.turnoId,
    fechaInicio: fila.fechaInicio,
    fechaFin: fila.fechaFin,
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
    empleado: fila.empleado,
    turno: aTurnoRespuesta(fila.turno),
  };
}
