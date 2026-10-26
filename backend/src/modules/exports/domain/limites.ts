// Límites de la exportación (constantes puras).
//
// El backend corre en un plan gratuito de ~512 MB: los topes evitan que una
// exportación grande agote la memoria. Los valores se documentan en
// docs/referencia-api.md.
import { esFechaLocal } from '../../sales/domain/rules/fechas';

/** Filas máximas por conjunto. */
export const MAX_FILAS_POR_CONJUNTO = 20_000;
/** Filas máximas en el libro completo. */
export const MAX_FILAS_TOTALES = 50_000;
/** Días máximos de un rango de actividad (igual que la API). */
export const MAX_DIAS_RANGO = 92;
/** Filas por página al leer con cursor. */
export const FILAS_POR_LOTE = 1_000;

/** Límites que el servicio puede recibir inyectados (pruebas y despliegue). */
export type LimitesExport = {
  maxFilasPorConjunto: number;
  maxFilasTotales: number;
  maxDiasRango: number;
  maxConcurrentesPorUsuario: number;
  maxConcurrentesGlobales: number;
  maxPorMinuto: number;
};

/** Valores de producción. Las pruebas inyectan topes pequeños. */
export const LIMITES_EXPORT_POR_DEFECTO: LimitesExport = {
  maxFilasPorConjunto: MAX_FILAS_POR_CONJUNTO,
  maxFilasTotales: MAX_FILAS_TOTALES,
  maxDiasRango: MAX_DIAS_RANGO,
  maxConcurrentesPorUsuario: 1,
  maxConcurrentesGlobales: 2,
  maxPorMinuto: 10,
};

/** Motivo por el que un rango de fechas no sirve. */
export type MotivoRangoExport =
  | 'ausente'
  | 'invalido'
  | 'invertido'
  | 'excedido';

/**
 * Error de validación del rango.
 *
 * El servicio distingue `excedido` (413 y evento de fallo) de los errores de
 * entrada (400 sin evento). Sin esta distinción habría que comparar mensajes.
 */
export class ErrorRangoExport extends Error {
  constructor(
    readonly motivo: MotivoRangoExport,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorRangoExport';
  }
}

export const FORMATOS = ['xlsx', 'csv'] as const;
export type FormatoExport = (typeof FORMATOS)[number];

export const CONJUNTOS = [
  'ventas',
  'carta',
  'stock',
  'movimientos',
  'empleados',
  'turnos',
  'asignaciones',
  'asistencia',
  'faltas',
  'equipos',
  'usuarios',
  'sucursales',
  'reporte',
  'auditoria',
] as const;
export type ConjuntoExport = (typeof CONJUNTOS)[number];

/** `true` si el conjunto es de actividad y exige rango de fechas. */
export function exigeRango(conjunto: ConjuntoExport): boolean {
  return (
    conjunto === 'ventas' ||
    conjunto === 'movimientos' ||
    conjunto === 'asistencia' ||
    conjunto === 'faltas' ||
    conjunto === 'reporte'
  );
}

export interface RangoFechas {
  desde?: string;
  hasta?: string;
}

/**
 * Valida el rango de fechas de un conjunto de actividad.
 *
 * Lanza `Error` con mensaje claro si falta, está invertido o supera 92 días.
 */
export function validarRangoExport(
  conjunto: ConjuntoExport,
  rango: RangoFechas,
  maxDias: number = MAX_DIAS_RANGO,
): { desde: string; hasta: string } {
  if (!exigeRango(conjunto)) {
    return { desde: '', hasta: '' };
  }

  const { desde, hasta } = rango;
  if (!desde || !hasta) {
    throw new ErrorRangoExport(
      'ausente',
      `El conjunto "${conjunto}" exige el rango de fechas (desde y hasta).`,
    );
  }
  if (!esFechaLocal(desde) || !esFechaLocal(hasta)) {
    throw new ErrorRangoExport(
      'invalido',
      'Las fechas deben ser días válidos en formato YYYY-MM-DD.',
    );
  }
  if (desde > hasta) {
    throw new ErrorRangoExport(
      'invertido',
      'La fecha "desde" no puede ser posterior a "hasta".',
    );
  }
  const dias = diasEntre(desde, hasta);
  if (dias > maxDias) {
    throw new ErrorRangoExport(
      'excedido',
      `El rango no puede superar ${maxDias} días (se pidieron ${dias}).`,
    );
  }
  return { desde, hasta };
}

/** Número de días inclusivos entre dos días "AAAA-MM-DD". */
export function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  const inicio = Date.UTC(a1!, m1! - 1, d1!);
  const fin = Date.UTC(a2!, m2! - 1, d2!);
  return Math.round((fin - inicio) / 86_400_000) + 1;
}
