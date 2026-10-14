// Repositorio de auditoria.
//
// `registrar` es el UNICO punto de escritura: pasa siempre el detalle por el
// saneador antes de insertar. El resto son lecturas para el listado general y
// el historial por usuario.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  AuditoriaAccion,
  AuditoriaEntidad,
  Prisma,
} from '../../../generated/prisma/client';
import {
  AccionAuditoria,
  EntidadAuditoria,
  EventoAuditoria,
} from '../domain/evento-auditoria';
import { sanitizarDetalle } from '../domain/sanitizar-detalle';

/** Cliente con el que se puede trabajar fuera o dentro de una transaccion. */
export type ClienteAuditoria = PrismaService | Prisma.TransactionClient;

/**
 * Alcance de lectura. `global` es el Admin; `sucursal` es un Gerente, que solo
 * ve los eventos de personas de su sucursal y los operativos de esa sucursal.
 */
export type AlcanceAuditoria =
  | { tipo: 'global' }
  | { tipo: 'sucursal'; sucursalId: string };

export type FiltrosAuditoria = {
  page: number;
  limit: number;
  actorId?: string;
  entidad?: EntidadAuditoria;
  entidadId?: string;
  accion?: AccionAuditoria;
  sucursalId?: string;
  creadoDesde?: Date;
  creadoHastaExclusivo?: Date;
};

export type EventoAuditoriaRespuesta = {
  id: string;
  entidad: EntidadAuditoria;
  entidadId: string;
  accion: AccionAuditoria;
  actor: { id: string; nombre: string; nombreUsuario: string };
  usuarioAfectadoId: string | null;
  sucursalAfectadaId: string | null;
  detalle: unknown;
  fecha: Date;
};

export type PaginaAuditoria = {
  eventos: EventoAuditoriaRespuesta[];
  total: number;
  page: number;
  limit: number;
};

/** Datos de alcance actuales del usuario afectado por un evento. */
export type AlcanceUsuarioAuditoria = {
  rol: string;
  sucursalId: string | null;
};

/** Entidades de personas: se filtran por el usuario afectado. */
const ENTIDADES_DE_PERSONAS: AuditoriaEntidad[] = [
  AuditoriaEntidad.usuario,
  AuditoriaEntidad.empleado,
];

/** Entidades operativas: se filtran por la sucursal afectada. */
const ENTIDADES_OPERATIVAS: AuditoriaEntidad[] = [
  AuditoriaEntidad.oferta,
  AuditoriaEntidad.insumo_sucursal,
  AuditoriaEntidad.turno,
  AuditoriaEntidad.asignacion,
  AuditoriaEntidad.equipo,
];

const SELECT_EVENTO = {
  id: true,
  entidad: true,
  entidadId: true,
  accion: true,
  usuarioAfectadoId: true,
  sucursalAfectadaId: true,
  detalle: true,
  createdAt: true,
  actor: { select: { id: true, nombre: true, nombreUsuario: true } },
} satisfies Prisma.AuditoriaSelect;

@Injectable()
export class AuditoriaRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --------------------------------------------------------------- escritura

  /**
   * Escribe un evento de auditoria.
   *
   * `cliente` permite encadenarlo a la misma transaccion que la operacion
   * auditada: si el evento no se puede escribir, la operacion tampoco confirma.
   * El detalle pasa por el saneador, que lanza si detecta un secreto.
   */
  async registrar(
    evento: EventoAuditoria,
    cliente?: ClienteAuditoria,
  ): Promise<void> {
    const detalle = (sanitizarDetalle(evento.detalle ?? {}) ??
      {}) as Prisma.InputJsonValue;

    await this.db(cliente).auditoria.create({
      data: {
        entidad: evento.entidad,
        entidadId: evento.entidadId,
        accion: evento.accion,
        actorId: evento.actorId,
        usuarioAfectadoId: evento.usuarioAfectadoId ?? null,
        sucursalAfectadaId: evento.sucursalAfectadaId ?? null,
        detalle,
      },
      select: { id: true },
    });
  }

  // --------------------------------------------------------------- lecturas

  async listar(
    filtros: FiltrosAuditoria,
    alcance: AlcanceAuditoria,
  ): Promise<PaginaAuditoria> {
    const where = this.construirWhere(filtros, alcance);

    const [filas, total] = await this.prisma.$transaction([
      this.prisma.auditoria.findMany({
        where,
        select: SELECT_EVENTO,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filtros.page - 1) * filtros.limit,
        take: filtros.limit,
      }),
      this.prisma.auditoria.count({ where }),
    ]);

    return {
      eventos: filas.map(aEventoRespuesta),
      total,
      page: filtros.page,
      limit: filtros.limit,
    };
  }

  async historialDeUsuario(
    usuarioId: string,
    page: number,
    limit: number,
  ): Promise<PaginaAuditoria> {
    const where: Prisma.AuditoriaWhereInput = { usuarioAfectadoId: usuarioId };

    const [filas, total] = await this.prisma.$transaction([
      this.prisma.auditoria.findMany({
        where,
        select: SELECT_EVENTO,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditoria.count({ where }),
    ]);

    return {
      eventos: filas.map(aEventoRespuesta),
      total,
      page,
      limit,
    };
  }

  /** Rol y sucursal ACTUALES del usuario, para decidir el alcance del Gerente. */
  async buscarAlcanceUsuario(
    usuarioId: string,
  ): Promise<AlcanceUsuarioAuditoria | null> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { sucursalId: true, rol: { select: { nombre: true } } },
    });

    return usuario
      ? { rol: usuario.rol.nombre, sucursalId: usuario.sucursalId }
      : null;
  }

  // ------------------------------------------------------------------ privado

  private db(cliente?: ClienteAuditoria): ClienteAuditoria {
    return cliente ?? this.prisma;
  }

  private construirWhere(
    filtros: FiltrosAuditoria,
    alcance: AlcanceAuditoria,
  ): Prisma.AuditoriaWhereInput {
    const alcanceWhere: Prisma.AuditoriaWhereInput =
      alcance.tipo === 'global'
        ? {}
        : {
            OR: [
              {
                entidad: { in: ENTIDADES_DE_PERSONAS },
                usuarioAfectado: {
                  rol: { nombre: 'Empleado' },
                  sucursalId: alcance.sucursalId,
                },
              },
              {
                entidad: { in: ENTIDADES_OPERATIVAS },
                sucursalAfectadaId: alcance.sucursalId,
              },
            ],
          };

    const filtrosWhere: Prisma.AuditoriaWhereInput = {
      ...(filtros.actorId !== undefined ? { actorId: filtros.actorId } : {}),
      ...(filtros.entidad !== undefined ? { entidad: filtros.entidad } : {}),
      ...(filtros.entidadId !== undefined ? { entidadId: filtros.entidadId } : {}),
      ...(filtros.accion !== undefined ? { accion: filtros.accion } : {}),
      ...(filtros.sucursalId !== undefined
        ? { sucursalAfectadaId: filtros.sucursalId }
        : {}),
      ...(filtros.creadoDesde !== undefined ||
      filtros.creadoHastaExclusivo !== undefined
        ? {
            createdAt: {
              ...(filtros.creadoDesde !== undefined
                ? { gte: filtros.creadoDesde }
                : {}),
              ...(filtros.creadoHastaExclusivo !== undefined
                ? { lt: filtros.creadoHastaExclusivo }
                : {}),
            },
          }
        : {}),
    };

    return { AND: [alcanceWhere, filtrosWhere] };
  }
}

function aEventoRespuesta(fila: {
  id: string;
  entidad: AuditoriaEntidad;
  entidadId: string;
  accion: AuditoriaAccion;
  usuarioAfectadoId: string | null;
  sucursalAfectadaId: string | null;
  detalle: Prisma.JsonValue;
  createdAt: Date;
  actor: { id: string; nombre: string; nombreUsuario: string };
}): EventoAuditoriaRespuesta {
  return {
    id: fila.id,
    entidad: fila.entidad,
    entidadId: fila.entidadId,
    accion: fila.accion,
    actor: fila.actor,
    usuarioAfectadoId: fila.usuarioAfectadoId,
    sucursalAfectadaId: fila.sucursalAfectadaId,
    detalle: fila.detalle,
    fecha: fila.createdAt,
  };
}
