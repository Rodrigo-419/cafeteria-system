// Repositorio de asistencia: acceso a `registro_asistencia`, `justificacion_falta`
// y lo minimo de `empleado`/`asignacion_turno`/`turno` que exigen las reglas.
//
// Decisiones que se repiten en cada metodo:
//
//   * `select` explicito en todas las consultas. Ninguna respuesta pide columnas
//     que no usa.
//   * Cliente variable (`db`): cada metodo acepta un cliente opcional para que
//     un caso de uso pueda meterlo en una transaccion. Sin cliente usa
//     `PrismaService`.
//   * Las lecturas que condicionan una escritura (bloqueo, registros, par de
//     correcciones) aceptan cliente para correr dentro de la transaccion.
//   * `registro_asistencia` e `justificacion_falta` son inmutables: este
//     repositorio solo inserta y lee.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { $Enums, Prisma } from '../../../generated/prisma/client';
import type { AlcanceAsistencia } from '../domain/rules/alcance';

/** Cliente con el que se puede trabajar fuera y dentro de una transaccion. */
export type ClienteAsistencia = PrismaService | Prisma.TransactionClient;

/** Fila de `registro_asistencia`, sin relaciones, tal como sale del select. */
export type RegistroRespuesta = {
  id: string;
  empleadoId: string;
  sucursalId: string;
  tipo: $Enums.RegistroAsistenciaTipo;
  fechaHora: Date;
  metodo: string;
  esCorreccion: boolean;
  registroOriginalId: string | null;
  motivo: string | null;
  usuarioCorrectorId: string | null;
  createdAt: Date;
};

/** Empleado tal y como lo necesita la marcacion. */
export type EmpleadoDeMarcacion = {
  id: string;
  sucursalId: string;
  estado: $Enums.EmpleadoEstado;
  pinHash: string | null;
  fechaContratacion: Date;
  usuarioId: string;
};

/** Empleado reducido a su nombre para nombres de respuesta. */
export type EmpleadoNombre = {
  id: string;
  nombre: string;
};

/** Registro con los datos del empleado para decidir el alcance y nombrarlo. */
export type RegistroConEmpleado = {
  registro: RegistroRespuesta;
  empleado: { sucursalId: string; usuarioId: string; nombre: string };
};

/** Fila de `justificacion_falta`. */
export type JustificacionRespuesta = {
  id: string;
  empleadoId: string;
  fecha: Date;
  motivo: string;
  usuarioJustificadorId: string;
  createdAt: Date;
};

/** Asignacion con su turno, para el calculo de faltas. */
export type AsignacionConTurno = {
  empleadoId: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  turno: { tipo: $Enums.TurnoTipo; diasSemana: string | null };
};

export type FiltroEmpleadosAsistencia = {
  empleadoId?: string;
  sucursalId?: string;
};

const SELECT_REGISTRO = {
  id: true,
  empleadoId: true,
  sucursalId: true,
  tipo: true,
  fechaHora: true,
  metodo: true,
  esCorreccion: true,
  registroOriginalId: true,
  motivo: true,
  usuarioCorrectorId: true,
  createdAt: true,
} satisfies Prisma.RegistroAsistenciaSelect;

@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Ejecuta `operacion` dentro de una transaccion y le pasa el cliente. */
  async enTransaccion<T>(
    operacion: (cliente: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(operacion);
  }

  // --------------------------------------------------------------- marcacion

  /** Empleado de una sucursal con lo que necesita la marcacion. */
  async buscarEmpleadoDeSucursal(
    empleadoId: string,
    sucursalId: string,
    cliente?: ClienteAsistencia,
  ): Promise<EmpleadoDeMarcacion | null> {
    return this.db(cliente).empleado.findFirst({
      where: { id: empleadoId, sucursalId },
      select: {
        id: true,
        sucursalId: true,
        estado: true,
        pinHash: true,
        fechaContratacion: true,
        usuarioId: true,
      },
    });
  }

  /**
   * Bloquea en exclusivo la fila del empleado hasta que termine la transaccion.
   *
   * Es el `SELECT ... FOR UPDATE` que convierte el par "leer marcaciones e
   * insertar" en una seccion critica: dos marcaciones simultaneas del mismo
   * empleado se serializan y la segunda ve el registro recien creado, con lo que
   * responde 409 en vez de crear un doble marcaje. Debe ser la PRIMERA lectura
   * de la transaccion.
   */
  async bloquearEmpleado(
    empleadoId: string,
    cliente: Prisma.TransactionClient,
  ): Promise<void> {
    await cliente.$queryRaw(
      Prisma.sql`SELECT id FROM empleado WHERE id = ${empleadoId}::uuid FOR UPDATE`,
    );
  }

  /** Empleados ACTIVOS de una sucursal, para la pantalla de marcacion. */
  async listarEmpleadosActivosDeSucursal(
    sucursalId: string,
    cliente?: ClienteAsistencia,
  ): Promise<EmpleadoNombre[]> {
    const empleados = await this.db(cliente).empleado.findMany({
      where: { sucursalId, estado: 'activo' },
      select: {
        id: true,
        usuario: { select: { nombre: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return empleados.map((empleado) => ({
      id: empleado.id,
      nombre: empleado.usuario.nombre,
    }));
  }

  /** Registro nuevo (marcaje o correccion). */
  async crearRegistro(
    datos: {
      empleadoId: string;
      sucursalId: string;
      tipo: $Enums.RegistroAsistenciaTipo;
      fechaHora: Date;
      metodo: string;
      esCorreccion: boolean;
      registroOriginalId?: string;
      motivo?: string;
      usuarioCorrectorId?: string;
    },
    cliente?: ClienteAsistencia,
  ): Promise<RegistroRespuesta> {
    return this.db(cliente).registroAsistencia.create({
      data: {
        empleadoId: datos.empleadoId,
        sucursalId: datos.sucursalId,
        tipo: datos.tipo,
        fechaHora: datos.fechaHora,
        metodo: datos.metodo,
        esCorreccion: datos.esCorreccion,
        registroOriginalId: datos.registroOriginalId,
        motivo: datos.motivo,
        usuarioCorrectorId: datos.usuarioCorrectorId,
      },
      select: SELECT_REGISTRO,
    });
  }

  /** Historial COMPLETO de registros de un empleado (originales y correcciones). */
  async listarRegistrosDeEmpleado(
    empleadoId: string,
    cliente?: ClienteAsistencia,
  ): Promise<RegistroRespuesta[]> {
    return this.db(cliente).registroAsistencia.findMany({
      where: { empleadoId },
      select: SELECT_REGISTRO,
      orderBy: [{ fechaHora: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  // ------------------------------------------------------------- correcciones

  /** Registro por id, con su empleado para decidir el alcance. */
  async buscarRegistroEnAlcance(
    id: string,
    alcance: AlcanceAsistencia,
    cliente?: ClienteAsistencia,
  ): Promise<RegistroConEmpleado | null> {
    const fila = await this.db(cliente).registroAsistencia.findFirst({
      where: { id, empleado: { ...this.whereAlcance(alcance) } },
      select: {
        ...SELECT_REGISTRO,
        empleado: {
          select: {
            sucursalId: true,
            usuarioId: true,
            usuario: { select: { nombre: true } },
          },
        },
      },
    });

    if (fila === null) {
      return null;
    }

    const { empleado, ...registro } = fila;
    return {
      registro,
      empleado: {
        sucursalId: empleado.sucursalId,
        usuarioId: empleado.usuarioId,
        nombre: empleado.usuario.nombre,
      },
    };
  }

  /** Correcciones que apuntan a un registro original, por hora ascendente. */
  async listarCorreccionesDe(
    registroOriginalId: string,
    cliente?: ClienteAsistencia,
  ): Promise<RegistroRespuesta[]> {
    return this.db(cliente).registroAsistencia.findMany({
      where: { registroOriginalId },
      select: SELECT_REGISTRO,
      orderBy: [{ fechaHora: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  /** true si ya existe una correccion del par (original, tipo). */
  async existeParCorreccion(
    registroOriginalId: string,
    tipo: $Enums.RegistroAsistenciaTipo,
    cliente?: ClienteAsistencia,
  ): Promise<boolean> {
    const total = await this.db(cliente).registroAsistencia.count({
      where: { registroOriginalId, tipo, esCorreccion: true },
    });
    return total > 0;
  }

  // ------------------------------------------------------------------ lecturas

  /**
   * Empleados que alcanza el actor, combinados con los filtros del listado.
   *
   * Los nombres sirven para la respuesta de registros; la fecha de contratacion
   * para validar justificaciones; ambos y la sucursal para el calculo de faltas.
   */
  async listarEmpleadosDeAlcance(
    alcance: AlcanceAsistencia,
    filtro: FiltroEmpleadosAsistencia,
    cliente?: ClienteAsistencia,
  ): Promise<(EmpleadoNombre & { sucursalId: string; fechaContratacion: Date })[]> {
    const where: Prisma.EmpleadoWhereInput = {
      AND: [
        this.whereAlcance(alcance),
        ...(filtro.empleadoId !== undefined ? [{ id: filtro.empleadoId }] : []),
        ...(filtro.sucursalId !== undefined
          ? [{ sucursalId: filtro.sucursalId }]
          : []),
      ],
    };

    const empleados = await this.db(cliente).empleado.findMany({
      where,
      select: {
        id: true,
        sucursalId: true,
        fechaContratacion: true,
        usuario: { select: { nombre: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return empleados.map((empleado) => ({
      id: empleado.id,
      nombre: empleado.usuario.nombre,
      sucursalId: empleado.sucursalId,
      fechaContratacion: empleado.fechaContratacion,
    }));
  }

  /** Todo el historial de un conjunto de empleados, para derivar efectivos. */
  async listarRegistrosDeEmpleados(
    empleadoIds: string[],
    cliente?: ClienteAsistencia,
  ): Promise<RegistroRespuesta[]> {
    if (empleadoIds.length === 0) {
      return [];
    }

    return this.db(cliente).registroAsistencia.findMany({
      where: { empleadoId: { in: empleadoIds } },
      select: SELECT_REGISTRO,
      orderBy: [{ fechaHora: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  // ------------------------------------------------------------------- faltas

  /** Asignaciones de un conjunto de empleados con el turno que les corresponde. */
  async listarAsignacionesDeEmpleados(
    empleadoIds: string[],
    cliente?: ClienteAsistencia,
  ): Promise<AsignacionConTurno[]> {
    if (empleadoIds.length === 0) {
      return [];
    }

    const asignaciones = await this.db(cliente).asignacionTurno.findMany({
      where: { empleadoId: { in: empleadoIds } },
      select: {
        empleadoId: true,
        fechaInicio: true,
        fechaFin: true,
        turno: { select: { tipo: true, diasSemana: true } },
      },
      orderBy: [{ fechaInicio: 'asc' }, { id: 'asc' }],
    });

    return asignaciones.map((asignacion) => ({
      empleadoId: asignacion.empleadoId,
      fechaInicio: asignacion.fechaInicio,
      fechaFin: asignacion.fechaFin,
      turno: asignacion.turno,
    }));
  }

  // ------------------------------------------------------------ justificaciones

  /** Crea una justificacion. Devuelve null si ya existia (P2002). */
  async crearJustificacion(
    datos: {
      empleadoId: string;
      fecha: Date;
      motivo: string;
      usuarioJustificadorId: string;
    },
    cliente?: ClienteAsistencia,
  ): Promise<JustificacionRespuesta | null> {
    try {
      return await this.db(cliente).justificacionFalta.create({
        data: {
          empleadoId: datos.empleadoId,
          fecha: datos.fecha,
          motivo: datos.motivo,
          usuarioJustificadorId: datos.usuarioJustificadorId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  /** true si el empleado ya tiene justificacion ese dia. */
  async existeJustificacion(
    empleadoId: string,
    fecha: Date,
    cliente?: ClienteAsistencia,
  ): Promise<boolean> {
    const total = await this.db(cliente).justificacionFalta.count({
      where: { empleadoId, fecha },
    });
    return total > 0;
  }

  /** Justificaciones de un conjunto de empleados, para el calculo de faltas. */
  async listarJustificacionesDeEmpleados(
    empleadoIds: string[],
    desde: Date,
    hasta: Date,
    cliente?: ClienteAsistencia,
  ): Promise<JustificacionRespuesta[]> {
    if (empleadoIds.length === 0) {
      return [];
    }

    return this.db(cliente).justificacionFalta.findMany({
      where: { empleadoId: { in: empleadoIds }, fecha: { gte: desde, lte: hasta } },
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    });
  }

  private db(cliente?: ClienteAsistencia): ClienteAsistencia {
    return cliente ?? this.prisma;
  }

  private whereAlcance(alcance: AlcanceAsistencia): Prisma.EmpleadoWhereInput {
    return {
      ...(alcance.sucursalId !== undefined
        ? { sucursalId: alcance.sucursalId }
        : {}),
      ...(alcance.empleadoUsuarioId !== undefined
        ? { usuarioId: alcance.empleadoUsuarioId }
        : {}),
    };
  }
}