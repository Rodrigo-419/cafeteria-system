// Límites de la exportación (constantes puras y lectura del entorno).
//
// El backend corre en el plan gratuito de Render, con 512 MB para todo el
// proceso. Los topes evitan que una exportación grande agote esa memoria
// mientras la lectura siga acumulando filas. Los valores se documentan en
// docs/referencia-api.md y docs/despliegue.md.
import { esFechaLocal } from '../../sales/domain/rules/fechas';

/**
 * Filas máximas por conjunto.
 *
 * Es el valor por defecto; se puede cambiar con
 * `EXPORT_MAX_FILAS_POR_CONJUNTO`.
 */
export const MAX_FILAS_POR_CONJUNTO = 10_000;
/**
 * Filas máximas en el libro completo.
 *
 * Es el valor por defecto; se puede cambiar con `EXPORT_MAX_FILAS_TOTALES`.
 */
export const MAX_FILAS_TOTALES = 20_000;
/** Días máximos de un rango de actividad (igual que la API). */
export const MAX_DIAS_RANGO = 92;
/**
 * Tiempo máximo para generar y enviar una exportación, en milisegundos.
 *
 * Es el valor por defecto; se puede cambiar con `EXPORT_TIMEOUT_MS`. Pasado ese
 * plazo la exportación se abandona, deja `exportacion_fallida` y libera su
 * ranura, aunque la lectura siga esperando.
 */
export const TIEMPO_MAXIMO_MS = 60_000;
/**
 * Filas por página previstas para la lectura por lotes de la Fase 2.
 *
 * Hoy ningún lector la usa: todos materializan el array completo antes de
 * escribir. Se mantiene declarada para que la Fase 2 tenga un valor único.
 */
export const FILAS_POR_LOTE = 1_000;

/** Límites que el servicio puede recibir inyectados (pruebas y despliegue). */
export type LimitesExport = {
  maxFilasPorConjunto: number;
  maxFilasTotales: number;
  maxDiasRango: number;
  maxConcurrentesPorUsuario: number;
  maxConcurrentesGlobales: number;
  maxPorMinuto: number;
  /** Milisegundos que puede durar una exportación antes de abandonarse. */
  tiempoMaximoMs: number;
};

/** Valores de producción. Las pruebas inyectan topes pequeños. */
export const LIMITES_EXPORT_POR_DEFECTO: LimitesExport = {
  maxFilasPorConjunto: MAX_FILAS_POR_CONJUNTO,
  maxFilasTotales: MAX_FILAS_TOTALES,
  maxDiasRango: MAX_DIAS_RANGO,
  maxConcurrentesPorUsuario: 1,
  maxConcurrentesGlobales: 1,
  maxPorMinuto: 10,
  tiempoMaximoMs: TIEMPO_MAXIMO_MS,
};

/** Lee un entero positivo de una variable; si falta, usa el valor por defecto. */
function enteroPositivoDeEntorno(
  valor: string | undefined,
  porDefecto: number,
  variable: string,
): number {
  if (valor === undefined || valor.trim() === '') {
    return porDefecto;
  }

  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error(`${variable} debe ser un entero positivo.`);
  }

  return numero;
}

/**
 * Límites efectivos: los valores por defecto, sobrescritos por las variables
 * de entorno de topes si están definidas.
 *
 * Se lee en el proveedor del módulo (no al importar el archivo) para que
 * `ConfigModule` ya haya cargado `backend/.env`.
 */
export function limitesDesdeEntorno(
  env: NodeJS.ProcessEnv = process.env,
): LimitesExport {
  return {
    ...LIMITES_EXPORT_POR_DEFECTO,
    maxFilasPorConjunto: enteroPositivoDeEntorno(
      env.EXPORT_MAX_FILAS_POR_CONJUNTO,
      MAX_FILAS_POR_CONJUNTO,
      'EXPORT_MAX_FILAS_POR_CONJUNTO',
    ),
    maxFilasTotales: enteroPositivoDeEntorno(
      env.EXPORT_MAX_FILAS_TOTALES,
      MAX_FILAS_TOTALES,
      'EXPORT_MAX_FILAS_TOTALES',
    ),
    tiempoMaximoMs: enteroPositivoDeEntorno(
      env.EXPORT_TIMEOUT_MS,
      TIEMPO_MAXIMO_MS,
      'EXPORT_TIMEOUT_MS',
    ),
  };
}

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
      `El rango no puede superar ${maxDias} días (se pidieron ${dias}). ` +
        'Acota el rango de fechas.',
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
