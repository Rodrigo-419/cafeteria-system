// Regla de dominio: calculo de faltas de un rango.
//
// Reune en una funcion pura el trabajo que comparten la lectura de faltas de
// asistencia y el reporte comparativo: derivar que dias tienen entrada efectiva,
// que dias estan justificados y que dias exige presencia un turno fijo vigente.
// Recibir `hoy` por parametro (en vez de leer el reloj) mantiene la funcion pura
// y contrastable sin depender de la hora real.
//
// Limitacion conocida y deliberada: los turnos VARIABLES no generan faltas,
// porque no se puede saber que dia le tocaba al empleado sin una programacion
// explicita.
import { fechaIsoDe, fechaLocalDe } from '../fechas';
import {
  asignacionVigenteElDia,
  esFalta,
  turnoExigeDia,
  type TurnoDeAsignacion,
} from './falta';
import {
  derivarAsistencia,
  REGISTRO_ENTRADA,
  type RegistroAsistenciaFila,
} from './registros-efectivos';

/** Empleado reducido a lo que necesita el calculo de faltas. */
export type EmpleadoParaFaltas = {
  id: string;
  nombre: string;
  sucursalId: string;
};

/** Registro de asistencia con su empleado, para agrupar por persona. */
export type RegistroParaFaltas = RegistroAsistenciaFila & {
  empleadoId: string;
};

/** Justificacion de falta reducida a su empleado y su dia. */
export type JustificacionParaFaltas = {
  empleadoId: string;
  fecha: Date;
};

/** Asignacion de turno reducida a lo que decide si un dia exige presencia. */
export type AsignacionParaFaltas = {
  empleadoId: string;
  fechaInicio: Date;
  fechaFin: Date | null;
  turno: TurnoDeAsignacion;
};

/** Falta calculada, lista para la respuesta de cualquiera de los dos modulos. */
export type FaltaCalculada = {
  empleadoId: string;
  empleadoNombre: string;
  sucursalId: string;
  fecha: string;
  turno: TurnoDeAsignacion;
};

export type DatosCalculoFaltas = {
  empleados: readonly EmpleadoParaFaltas[];
  /** Historial COMPLETO de los empleados (originales y correcciones). */
  registros: readonly RegistroParaFaltas[];
  justificaciones: readonly JustificacionParaFaltas[];
  asignaciones: readonly AsignacionParaFaltas[];
  /** Primer dia local del rango, `YYYY-MM-DD`. */
  desde: string;
  /** Ultimo dia local pedido; se recorta a `hoy`. */
  hasta: string;
  /** Dia local de hoy, `YYYY-MM-DD`. */
  hoy: string;
};

/**
 * Faltas del rango `[desde, hasta]`, recortado a `hoy`, ordenadas por fecha y
 * nombre de empleado.
 *
 * Un dia es falta si un turno fijo vigente ese dia lo exige y el empleado no
 * tiene entrada efectiva ni justificacion. Los dias posteriores a `hoy` no
 * cuentan todavia: una falta solo se puede afirmar de un dia ya pasado.
 */
export function calcularFaltas(datos: DatosCalculoFaltas): FaltaCalculada[] {
  const hastaEfectiva = datos.hasta < datos.hoy ? datos.hasta : datos.hoy;
  if (datos.desde > hastaEfectiva) {
    return [];
  }

  const historialPorEmpleado = new Map<string, RegistroParaFaltas[]>();
  for (const registro of datos.registros) {
    const historial = historialPorEmpleado.get(registro.empleadoId) ?? [];
    historial.push(registro);
    historialPorEmpleado.set(registro.empleadoId, historial);
  }

  const entradasPorEmpleado = new Map<string, Set<string>>();
  for (const [empleadoId, historial] of historialPorEmpleado) {
    const entradas = new Set<string>();
    for (const derivado of derivarAsistencia(historial).registros) {
      if (derivado.tipo === REGISTRO_ENTRADA) {
        entradas.add(fechaLocalDe(derivado.fechaHora));
      }
    }
    entradasPorEmpleado.set(empleadoId, entradas);
  }

  const justificadasPorEmpleado = new Map<string, Set<string>>();
  for (const justificacion of datos.justificaciones) {
    const dias =
      justificadasPorEmpleado.get(justificacion.empleadoId) ?? new Set<string>();
    dias.add(fechaIsoDe(justificacion.fecha));
    justificadasPorEmpleado.set(justificacion.empleadoId, dias);
  }

  const asignacionesPorEmpleado = new Map<string, AsignacionParaFaltas[]>();
  for (const asignacion of datos.asignaciones) {
    const lista = asignacionesPorEmpleado.get(asignacion.empleadoId) ?? [];
    lista.push(asignacion);
    asignacionesPorEmpleado.set(asignacion.empleadoId, lista);
  }

  const faltas: FaltaCalculada[] = [];

  for (const empleado of datos.empleados) {
    const asignacionesDelEmpleado =
      asignacionesPorEmpleado.get(empleado.id) ?? [];
    const entradas = entradasPorEmpleado.get(empleado.id) ?? new Set<string>();
    const justificadas =
      justificadasPorEmpleado.get(empleado.id) ?? new Set<string>();

    for (
      let dia = datos.desde;
      dia <= hastaEfectiva;
      dia = diaSiguiente(dia)
    ) {
      const turnoQueExige = asignacionesDelEmpleado.find(
        (asignacion) =>
          asignacionVigenteElDia({
            fechaInicio: fechaIsoDe(asignacion.fechaInicio),
            fechaFin:
              asignacion.fechaFin === null
                ? null
                : fechaIsoDe(asignacion.fechaFin),
            fecha: dia,
          }) && turnoExigeDia(asignacion.turno, dia),
      );

      if (turnoQueExige === undefined) {
        continue;
      }

      if (
        esFalta({
          turno: turnoQueExige.turno,
          fecha: dia,
          tieneEntrada: entradas.has(dia),
          tieneJustificacion: justificadas.has(dia),
        })
      ) {
        faltas.push({
          empleadoId: empleado.id,
          empleadoNombre: empleado.nombre,
          sucursalId: empleado.sucursalId,
          fecha: dia,
          turno: turnoQueExige.turno,
        });
      }
    }
  }

  faltas.sort(
    (a, b) =>
      (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) ||
      (a.empleadoNombre < b.empleadoNombre ? -1 : 1),
  );

  return faltas;
}

/** Dia local siguiente a uno `YYYY-MM-DD`. */
export function diaSiguiente(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  return fechaIsoDe(new Date(Date.UTC(anio, mes - 1, dia + 1)));
}
