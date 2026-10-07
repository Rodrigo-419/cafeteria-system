// Repositorio de acceso a datos de equipos.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import type {
  EstadoEquipo,
} from './domain/rules/equipment.rules';

export type ClienteEquipo = PrismaService | Prisma.TransactionClient;

export type EquipoFila = {
  id: string;
  sucursalId: string;
  nombre: string;
  tipo: string;
  estado: EstadoEquipo;
  observaciones: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type HistorialEquipoFila = {
  id: string;
  equipoId: string;
  estadoAnterior: EstadoEquipo;
  estadoNuevo: EstadoEquipo;
  observacionesAnterior: string | null;
  observacionesNuevas: string | null;
  usuarioId: string;
  createdAt: Date;
  usuario: { id: string; nombre: string } | null;
};

export type FiltrosEquiposRepo = {
  sucursalId?: string;
  estado?: EstadoEquipo;
  busqueda?: string;
  page: number;
  limit: number;
};

export type FiltrosHistorialRepo = {
  equipoId: string;
  page: number;
  limit: number;
};

const SELECT_EQUIPO = {
  id: true,
  sucursalId: true,
  nombre: true,
  tipo: true,
  estado: true,
  observaciones: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EquipoSelect;

const SELECT_HISTORIAL = {
  id: true,
  equipoId: true,
  estadoAnterior: true,
  estadoNuevo: true,
  observacionesAnterior: true,
  observacionesNuevas: true,
  usuarioId: true,
  createdAt: true,
  usuario: { select: { id: true, nombre: true } },
} satisfies Prisma.HistorialEquipoSelect;

@Injectable()
export class EquipmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(cliente?: ClienteEquipo): ClienteEquipo {
    return cliente ?? this.prisma;
  }

  async enTransaccion<T>(
    operacion: (cliente: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(operacion);
  }

  async existeSucursal(id: string, cliente?: ClienteEquipo): Promise<boolean> {
    const total = await this.db(cliente).sucursal.count({ where: { id } });
    return total > 0;
  }

  async crearEquipo(
    datos: {
      sucursalId: string;
      nombre: string;
      tipo: string;
      observaciones?: string | null;
    },
    cliente?: ClienteEquipo,
  ): Promise<EquipoFila> {
    const fila = await this.db(cliente).equipo.create({
      data: {
        ...datos,
        observaciones: datos.observaciones ?? null,
      },
      select: SELECT_EQUIPO,
    });
    return fila as EquipoFila;
  }

  async buscarEquipoPorId(
    id: string,
    cliente?: ClienteEquipo,
  ): Promise<EquipoFila | null> {
    const fila = await this.db(cliente).equipo.findUnique({
      where: { id },
      select: SELECT_EQUIPO,
    });
    return fila as EquipoFila | null;
  }

  async obtenerEquipoConBloqueo(
    id: string,
    cliente: Prisma.TransactionClient,
  ): Promise<EquipoFila | null> {
    const filas = await cliente.$queryRaw<
      Array<{
        id: string;
        sucursal_id: string;
        nombre: string;
        tipo: string;
        estado: EstadoEquipo;
        observaciones: string | null;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT id, sucursal_id, nombre, tipo, estado, observaciones, created_at, updated_at
      FROM equipo
      WHERE id = ${id}
      FOR UPDATE
    `;
    if (filas.length === 0) {
      return null;
    }
    const f = filas[0];
    return {
      id: f.id,
      sucursalId: f.sucursal_id,
      nombre: f.nombre,
      tipo: f.tipo,
      estado: f.estado,
      observaciones: f.observaciones,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    } satisfies EquipoFila;
  }

  async actualizarEquipo(
    id: string,
    datos: Partial<{
      nombre: string;
      tipo: string;
      estado: EstadoEquipo;
      observaciones: string | null;
    }>,
    cliente?: ClienteEquipo,
  ): Promise<EquipoFila> {
    const fila = await this.db(cliente).equipo.update({
      where: { id },
      data: datos,
      select: SELECT_EQUIPO,
    });
    return fila as EquipoFila;
  }

  async listarEquipos(filtros: FiltrosEquiposRepo): Promise<EquipoFila[]> {
    const where: Prisma.EquipoWhereInput = {
      ...(filtros.sucursalId !== undefined ? { sucursalId: filtros.sucursalId } : {}),
      ...(filtros.estado !== undefined ? { estado: filtros.estado } : {}),
      ...(filtros.busqueda !== undefined && filtros.busqueda !== ''
        ? {
            OR: [
              { nombre: { contains: filtros.busqueda.trim(), mode: 'insensitive' } },
              { tipo: { contains: filtros.busqueda.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const filas = await this.prisma.equipo.findMany({
      where,
      select: SELECT_EQUIPO,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (filtros.page - 1) * filtros.limit,
      take: filtros.limit,
    });
    return filas as EquipoFila[];
  }

  async contarEquipos(filtros: Omit<FiltrosEquiposRepo, 'page' | 'limit'>): Promise<number> {
    const where: Prisma.EquipoWhereInput = {
      ...(filtros.sucursalId !== undefined ? { sucursalId: filtros.sucursalId } : {}),
      ...(filtros.estado !== undefined ? { estado: filtros.estado } : {}),
      ...(filtros.busqueda !== undefined && filtros.busqueda !== ''
        ? {
            OR: [
              { nombre: { contains: filtros.busqueda.trim(), mode: 'insensitive' } },
              { tipo: { contains: filtros.busqueda.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.equipo.count({ where });
  }

  async crearHistorial(
    datos: {
      equipoId: string;
      estadoAnterior: EstadoEquipo;
      estadoNuevo: EstadoEquipo;
      observacionesAnterior: string | null;
      observacionesNuevas: string | null;
      usuarioId: string;
    },
    cliente?: ClienteEquipo,
  ): Promise<HistorialEquipoFila> {
    const fila = await this.db(cliente).historialEquipo.create({
      data: datos,
      select: SELECT_HISTORIAL,
    });
    return fila as HistorialEquipoFila;
  }

  async listarHistorial(filtros: FiltrosHistorialRepo): Promise<HistorialEquipoFila[]> {
    const filas = await this.prisma.historialEquipo.findMany({
      where: { equipoId: filtros.equipoId },
      select: SELECT_HISTORIAL,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (filtros.page - 1) * filtros.limit,
      take: filtros.limit,
    });
    return filas as HistorialEquipoFila[];
  }

  async contarHistorial(equipoId: string): Promise<number> {
    return this.prisma.historialEquipo.count({ where: { equipoId } });
  }
}
