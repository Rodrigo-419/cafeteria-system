// Repositorio del reporte comparativo: agregados por sucursal.
//
// Los agregados se resuelven con SQL a mano (`$queryRaw` + `Prisma.sql`) y no
// con el API de filtros de Prisma: son varios `GROUP BY` sobre tablas distintas
// y el API no los expresa sin caer en N+1. Todas las consultas enlazan sus
// parametros; ni los ids ni el rango se concatenan en el texto.
//
// Convenciones de los agregados:
//
//   * Los ids de sucursal siempre van restringidos con `IN`: el caso de uso
//     decide si son todas las sucursales o solo una.
//   * Los `Decimal` se sacan con `::text` (via `COALESCE(...)::numeric(p,s)`)
//     para no perder precision al pasar por `number`.
//   * Los conteos se castean `::int` para que Prisma los devuelva como numero.
//   * Los rangos de fecha son `[desde, hasta)` sobre `created_at`, salvo las
//     justificaciones, que comparan la columna `date` con los dias del rango.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';

/** Sucursal reducida a su id y nombre para el reporte. */
export type SucursalResumen = {
  id: string;
  nombre: string;
};

/** Ventas completadas de una sucursal agrupadas por metodo de pago. */
export type VentaPorMetodo = {
  sucursalId: string;
  metodoPago: string;
  /** Suma de subtotales, en texto con dos decimales. */
  total: string;
  cantidad: number;
};

/** Conteo de filas por sucursal. */
export type ConteoPorSucursal = {
  sucursalId: string;
  cantidad: number;
};

/** Movimientos de una sucursal agrupados por tipo. */
export type MovimientoAgregado = {
  sucursalId: string;
  tipo: string;
  cantidad: number;
  /** Suma algebraica de la variacion, en texto con dos decimales. */
  cantidadNeta: string;
};

/** Registro de asistencia con su empleado, para derivar efectivos. */
export type RegistroAsistenciaReporte = {
  id: string;
  empleadoId: string;
  sucursalId: string;
  tipo: string;
  fechaHora: Date;
  esCorreccion: boolean;
  registroOriginalId: string | null;
};

/** Empleado reducido a lo que necesita el calculo de faltas. */
export type EmpleadoReporte = {
  id: string;
  nombre: string;
  sucursalId: string;
};

/** Asignacion con su turno, para el calculo de faltas. */
export type AsignacionReporte = {
  empleadoId: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  turno: { tipo: string; diasSemana: string | null };
};

/** Justificacion reducida a su empleado y su dia. */
export type JustificacionReporte = {
  empleadoId: string;
  fecha: Date;
};

/** Lista de ids como `(uuid1, uuid2, ...)` para un `IN` enlazado. */
function listaUuids(ids: readonly string[]): Prisma.Sql {
  return Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));
}

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------- sucursales

  /** Sucursales por nombre; si se pasan ids, solo esas. */
  async listarSucursales(ids?: readonly string[]): Promise<SucursalResumen[]> {
    if (ids !== undefined && ids.length === 0) {
      return [];
    }

    return this.prisma.sucursal.findMany({
      where: ids !== undefined ? { id: { in: [...ids] } } : {},
      select: { id: true, nombre: true },
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    });
  }

  // ------------------------------------------------------------------ ventas

  /** Ventas completadas por sucursal y metodo de pago, en `[desde, hasta)`. */
  async ventasPorMetodo(
    desde: Date,
    hasta: Date,
    sucursalIds: readonly string[],
  ): Promise<VentaPorMetodo[]> {
    if (sucursalIds.length === 0) {
      return [];
    }

    return this.prisma.$queryRaw<VentaPorMetodo[]>(Prisma.sql`
      SELECT v.sucursal_id::text AS "sucursalId",
             v.metodo_pago::text AS "metodoPago",
             COALESCE(SUM(d.subtotal), 0)::numeric(10,2)::text AS "total",
             COUNT(DISTINCT v.id)::int AS "cantidad"
      FROM venta v
      LEFT JOIN venta_detalle d ON d.venta_id = v.id
      WHERE v.estado = 'completada'::venta_estado
        AND v.created_at >= ${desde}
        AND v.created_at < ${hasta}
        AND v.sucursal_id IN (${listaUuids(sucursalIds)})
      GROUP BY v.sucursal_id, v.metodo_pago
    `);
  }

  /** Ventas anuladas por sucursal, contadas por `created_at` en el rango. */
  async ventasAnuladas(
    desde: Date,
    hasta: Date,
    sucursalIds: readonly string[],
  ): Promise<ConteoPorSucursal[]> {
    if (sucursalIds.length === 0) {
      return [];
    }

    return this.prisma.$queryRaw<ConteoPorSucursal[]>(Prisma.sql`
      SELECT v.sucursal_id::text AS "sucursalId",
             COUNT(*)::int AS "cantidad"
      FROM venta v
      WHERE v.estado = 'anulada'::venta_estado
        AND v.created_at >= ${desde}
        AND v.created_at < ${hasta}
        AND v.sucursal_id IN (${listaUuids(sucursalIds)})
      GROUP BY v.sucursal_id
    `);
  }

  // --------------------------------------------------------------- inventario

  /** Insumos con alerta abierta por sucursal, al momento de generar. */
  async alertasAbiertas(
    sucursalIds: readonly string[],
  ): Promise<ConteoPorSucursal[]> {
    if (sucursalIds.length === 0) {
      return [];
    }

    return this.prisma.$queryRaw<ConteoPorSucursal[]>(Prisma.sql`
      SELECT s.sucursal_id::text AS "sucursalId",
             COUNT(*)::int AS "cantidad"
      FROM alerta_stock a
      INNER JOIN insumo_sucursal s ON s.id = a.insumo_sucursal_id
      WHERE a.estado = 'abierta'::alerta_stock_estado
        AND s.sucursal_id IN (${listaUuids(sucursalIds)})
      GROUP BY s.sucursal_id
    `);
  }

  /** Movimientos por sucursal y tipo en `[desde, hasta)`, con su variacion neta. */
  async movimientosPorTipo(
    desde: Date,
    hasta: Date,
    sucursalIds: readonly string[],
  ): Promise<MovimientoAgregado[]> {
    if (sucursalIds.length === 0) {
      return [];
    }

    return this.prisma.$queryRaw<MovimientoAgregado[]>(Prisma.sql`
      SELECT s.sucursal_id::text AS "sucursalId",
             m.tipo::text AS "tipo",
             COUNT(*)::int AS "cantidad",
             COALESCE(SUM(m.cantidad), 0)::numeric(12,2)::text AS "cantidadNeta"
      FROM movimiento_inventario m
      INNER JOIN insumo_sucursal s ON s.id = m.insumo_sucursal_id
      WHERE m.created_at >= ${desde}
        AND m.created_at < ${hasta}
        AND s.sucursal_id IN (${listaUuids(sucursalIds)})
      GROUP BY s.sucursal_id, m.tipo
    `);
  }

  // -------------------------------------------------------------- asistencia

  /** Empleados de las sucursales, sin filtrar por estado. */
  async listarEmpleadosDeSucursales(
    sucursalIds: readonly string[],
  ): Promise<EmpleadoReporte[]> {
    if (sucursalIds.length === 0) {
      return [];
    }

    const empleados = await this.prisma.empleado.findMany({
      where: { sucursalId: { in: [...sucursalIds] } },
      select: {
        id: true,
        sucursalId: true,
        usuario: { select: { nombre: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return empleados.map((empleado) => ({
      id: empleado.id,
      nombre: empleado.usuario.nombre,
      sucursalId: empleado.sucursalId,
    }));
  }

  /** Historial COMPLETO de registros de un conjunto de empleados. */
  async listarRegistrosDeEmpleados(
    empleadoIds: readonly string[],
  ): Promise<RegistroAsistenciaReporte[]> {
    if (empleadoIds.length === 0) {
      return [];
    }

    return this.prisma.registroAsistencia.findMany({
      where: { empleadoId: { in: [...empleadoIds] } },
      select: {
        id: true,
        empleadoId: true,
        sucursalId: true,
        tipo: true,
        fechaHora: true,
        esCorreccion: true,
        registroOriginalId: true,
      },
      orderBy: [{ fechaHora: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  /** Asignaciones con su turno, para el calculo de faltas. */
  async listarAsignacionesDeEmpleados(
    empleadoIds: readonly string[],
  ): Promise<AsignacionReporte[]> {
    if (empleadoIds.length === 0) {
      return [];
    }

    return this.prisma.asignacionTurno.findMany({
      where: { empleadoId: { in: [...empleadoIds] } },
      select: {
        empleadoId: true,
        fechaInicio: true,
        fechaFin: true,
        turno: { select: { tipo: true, diasSemana: true } },
      },
      orderBy: [{ fechaInicio: 'asc' }, { id: 'asc' }],
    });
  }

  /** Justificaciones de un conjunto de empleados en `[desde, hasta]` de dias. */
  async listarJustificacionesDeEmpleados(
    empleadoIds: readonly string[],
    desde: Date,
    hasta: Date,
  ): Promise<JustificacionReporte[]> {
    if (empleadoIds.length === 0) {
      return [];
    }

    return this.prisma.justificacionFalta.findMany({
      where: {
        empleadoId: { in: [...empleadoIds] },
        fecha: { gte: desde, lte: hasta },
      },
      select: { empleadoId: true, fecha: true },
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    });
  }
}
