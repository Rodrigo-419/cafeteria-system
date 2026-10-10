// Caso de uso: generar el reporte comparativo entre sucursales.
//
// El reporte cruza ventas, inventario y asistencia de un periodo en una sola
// respuesta, con una fila por sucursal. Para no caer en N+1 se hacen agregados
// fijos (`GROUP BY` en SQL) y una sola carga de datos de asistencia, que se
// resuelve en memoria con las reglas puras compartidas con el modulo de
// asistencia.
//
// Ventas, movimientos y faltas son del periodo pedido (rango de dias del
// negocio, `[desde 00:00, hasta+1 00:00)` en America/Lima). Las alertas abiertas
// y las entradas sin cerrar son el estado en el momento de generar el reporte.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  derivarAsistencia,
} from '../../../attendance/domain/rules/registros-efectivos';
import { calcularFaltas } from '../../../attendance/domain/rules/calculo-faltas';
import { diaUtc } from '../../../employees/domain/fechas';
import { fechaLocalDe, rangoDelDiaLocal } from '../../../sales/domain/rules/fechas';
import {
  MAXIMO_DIAS_RANGO_COMPARATIVO,
  diasDelRango,
} from '../../domain/rules/rango';
import {
  centimosDeTexto,
  formatearCentimos,
  ticketPromedio,
} from '../../domain/rules/ventas';
import {
  ReportsRepository,
  type RegistroAsistenciaReporte,
} from '../../infrastructure/reports.repository';
import type {
  ReporteComparativo,
  ReporteSucursal,
} from '../reporte-comparativo';

export type EntradaReporteComparativo = {
  desde: string;
  hasta: string;
  sucursalId?: string;
};

type AcumuladoMetodo = { totalCentimos: number; cantidad: number };
type AcumuladoMovimiento = { cantidad: number; cantidadNeta: string };

const VACIO_METODO: AcumuladoMetodo = { totalCentimos: 0, cantidad: 0 };
const VACIO_MOVIMIENTO: AcumuladoMovimiento = {
  cantidad: 0,
  cantidadNeta: '0.00',
};

@Injectable()
export class GenerarReporteComparativoUseCase {
  constructor(private readonly repository: ReportsRepository) {}

  async ejecutar(
    entrada: EntradaReporteComparativo,
  ): Promise<ReporteComparativo> {
    if (entrada.hasta < entrada.desde) {
      throw new BadRequestException(
        'El filtro hasta no puede ser anterior a desde',
      );
    }

    if (
      diasDelRango(entrada.desde, entrada.hasta) >
      MAXIMO_DIAS_RANGO_COMPARATIVO
    ) {
      throw new BadRequestException(
        `El rango del reporte no puede superar ${MAXIMO_DIAS_RANGO_COMPARATIVO} dias`,
      );
    }

    const sucursales =
      entrada.sucursalId !== undefined
        ? await this.repository.listarSucursales([entrada.sucursalId])
        : await this.repository.listarSucursales();

    if (entrada.sucursalId !== undefined && sucursales.length === 0) {
      throw new NotFoundException('La sucursal no existe');
    }

    const generadoEn = new Date().toISOString();
    if (sucursales.length === 0) {
      return {
        desde: entrada.desde,
        hasta: entrada.hasta,
        generadoEn,
        sucursales: [],
      };
    }

    const sucursalIds = sucursales.map((sucursal) => sucursal.id);
    const { desde: inicio } = rangoDelDiaLocal(entrada.desde);
    const { hasta: finExclusivo } = rangoDelDiaLocal(entrada.hasta);

    const [ventas, anuladas, alertas, movimientos, empleados] =
      await Promise.all([
        this.repository.ventasPorMetodo(inicio, finExclusivo, sucursalIds),
        this.repository.ventasAnuladas(inicio, finExclusivo, sucursalIds),
        this.repository.alertasAbiertas(sucursalIds),
        this.repository.movimientosPorTipo(inicio, finExclusivo, sucursalIds),
        this.repository.listarEmpleadosDeSucursales(sucursalIds),
      ]);

    const empleadoIds = empleados.map((empleado) => empleado.id);
    const [registros, asignaciones, justificaciones] = await Promise.all([
      this.repository.listarRegistrosDeEmpleados(empleadoIds),
      this.repository.listarAsignacionesDeEmpleados(empleadoIds),
      this.repository.listarJustificacionesDeEmpleados(
        empleadoIds,
        diaUtc(entrada.desde),
        diaUtc(entrada.hasta),
      ),
    ]);

    const faltas = calcularFaltas({
      empleados,
      registros,
      justificaciones,
      asignaciones,
      desde: entrada.desde,
      hasta: entrada.hasta,
      hoy: fechaLocalDe(new Date()),
    });

    const ventasPorSucursal = this.agruparVentas(ventas);
    const anuladasPorSucursal = this.contar(anuladas);
    const alertasPorSucursal = this.contar(alertas);
    const movimientosPorSucursal = this.agruparMovimientos(movimientos);
    const faltasPorSucursal = this.contarPorSucursal(
      faltas.map((falta) => falta.sucursalId),
    );
    const sucursalDeEmpleado = new Map(
      empleados.map((empleado) => [empleado.id, empleado.sucursalId]),
    );
    const justificadasPorSucursal = this.contarPorSucursal(
      justificaciones
        .map((justificacion) =>
          sucursalDeEmpleado.get(justificacion.empleadoId),
        )
        .filter((sucursalId): sucursalId is string => sucursalId !== undefined),
    );
    const entradasAbiertasPorSucursal =
      this.contarEntradasAbiertas(registros);

    const resultado: ReporteSucursal[] = sucursales.map((sucursal) => {
      const porMetodo =
        ventasPorSucursal.get(sucursal.id) ??
        new Map<string, AcumuladoMetodo>();
      const efectivo = porMetodo.get('efectivo') ?? VACIO_METODO;
      const tarjeta = porMetodo.get('tarjeta') ?? VACIO_METODO;
      const totalCentimos = efectivo.totalCentimos + tarjeta.totalCentimos;
      const cantidadVentas = efectivo.cantidad + tarjeta.cantidad;

      const porTipo =
        movimientosPorSucursal.get(sucursal.id) ??
        new Map<string, AcumuladoMovimiento>();
      const entradasMovimiento = porTipo.get('entrada') ?? VACIO_MOVIMIENTO;
      const ajustesMovimiento = porTipo.get('ajuste') ?? VACIO_MOVIMIENTO;

      return {
        sucursalId: sucursal.id,
        sucursalNombre: sucursal.nombre,
        ventas: {
          total: formatearCentimos(totalCentimos),
          cantidad: cantidadVentas,
          ticketPromedio: ticketPromedio(totalCentimos, cantidadVentas),
          porMetodoPago: {
            efectivo: {
              total: formatearCentimos(efectivo.totalCentimos),
              cantidad: efectivo.cantidad,
            },
            tarjeta: {
              total: formatearCentimos(tarjeta.totalCentimos),
              cantidad: tarjeta.cantidad,
            },
          },
          anuladas: {
            cantidad: anuladasPorSucursal.get(sucursal.id) ?? 0,
          },
        },
        inventario: {
          movimientos: {
            total:
              entradasMovimiento.cantidad + ajustesMovimiento.cantidad,
            entradas: {
              cantidad: entradasMovimiento.cantidad,
              cantidadNeta: entradasMovimiento.cantidadNeta,
            },
            ajustes: {
              cantidad: ajustesMovimiento.cantidad,
              cantidadNeta: ajustesMovimiento.cantidadNeta,
            },
          },
        },
        asistencia: {
          faltas: faltasPorSucursal.get(sucursal.id) ?? 0,
          faltasJustificadas: justificadasPorSucursal.get(sucursal.id) ?? 0,
        },
        estadoActual: {
          insumosConAlertaAbierta: alertasPorSucursal.get(sucursal.id) ?? 0,
          entradasAbiertas: entradasAbiertasPorSucursal.get(sucursal.id) ?? 0,
        },
      };
    });

    return {
      desde: entrada.desde,
      hasta: entrada.hasta,
      generadoEn,
      sucursales: resultado,
    };
  }

  private agruparVentas(
    filas: Awaited<ReturnType<ReportsRepository['ventasPorMetodo']>>,
  ): Map<string, Map<string, AcumuladoMetodo>> {
    const porSucursal = new Map<string, Map<string, AcumuladoMetodo>>();

    for (const fila of filas) {
      const porMetodo =
        porSucursal.get(fila.sucursalId) ?? new Map<string, AcumuladoMetodo>();
      porMetodo.set(fila.metodoPago, {
        totalCentimos: centimosDeTexto(fila.total),
        cantidad: fila.cantidad,
      });
      porSucursal.set(fila.sucursalId, porMetodo);
    }

    return porSucursal;
  }

  private agruparMovimientos(
    filas: Awaited<ReturnType<ReportsRepository['movimientosPorTipo']>>,
  ): Map<string, Map<string, AcumuladoMovimiento>> {
    const porSucursal = new Map<string, Map<string, AcumuladoMovimiento>>();

    for (const fila of filas) {
      const porTipo =
        porSucursal.get(fila.sucursalId) ??
        new Map<string, AcumuladoMovimiento>();
      porTipo.set(fila.tipo, {
        cantidad: fila.cantidad,
        cantidadNeta: fila.cantidadNeta,
      });
      porSucursal.set(fila.sucursalId, porTipo);
    }

    return porSucursal;
  }

  private contar(
    filas: readonly { sucursalId: string; cantidad: number }[],
  ): Map<string, number> {
    return new Map(filas.map((fila) => [fila.sucursalId, fila.cantidad]));
  }

  private contarPorSucursal(sucursalIds: readonly string[]): Map<string, number> {
    const conteo = new Map<string, number>();
    for (const sucursalId of sucursalIds) {
      conteo.set(sucursalId, (conteo.get(sucursalId) ?? 0) + 1);
    }
    return conteo;
  }

  /**
   * Entradas efectivas sin cerrar por sucursal, al momento de generar.
   *
   * Incluye a los empleados cesados: la firma del suceso es la de `listar
   * empleados`, que no filtra por estado.
   */
  private contarEntradasAbiertas(
    registros: readonly RegistroAsistenciaReporte[],
  ): Map<string, number> {
    const sucursalDeRegistro = new Map(
      registros.map((registro) => [registro.id, registro.sucursalId]),
    );

    const historialPorEmpleado = new Map<
      string,
      RegistroAsistenciaReporte[]
    >();
    for (const registro of registros) {
      const historial = historialPorEmpleado.get(registro.empleadoId) ?? [];
      historial.push(registro);
      historialPorEmpleado.set(registro.empleadoId, historial);
    }

    const conteo = new Map<string, number>();
    for (const historial of historialPorEmpleado.values()) {
      for (const evento of derivarAsistencia(historial).entradasAbiertas) {
        const sucursalId = sucursalDeRegistro.get(evento.originalId);
        if (sucursalId !== undefined) {
          conteo.set(sucursalId, (conteo.get(sucursalId) ?? 0) + 1);
        }
      }
    }

    return conteo;
  }
}
