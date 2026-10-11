// Formato de fechas.
//
// El backend devuelve instantes en ISO/UTC, pero el negocio maneja el dia en
// America/Lima. Todo se formatea explicitamente en esa zona para no depender de
// la del navegador.
export const ZONA_HORARIA = 'America/Lima'

const LOCALE = 'es-PE'

/** Fecha y hora ("10 oct 2026, 14:30"). */
export function formatearFechaHora(iso: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: ZONA_HORARIA,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(aFecha(iso))
}

/** Solo la fecha ("10 oct 2026"). */
export function formatearFecha(iso: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: ZONA_HORARIA,
    dateStyle: 'medium',
  }).format(aFecha(iso))
}

/** Solo la hora ("14:30"). */
export function formatearHora(iso: string | Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: ZONA_HORARIA,
    timeStyle: 'short',
  }).format(aFecha(iso))
}

/** Dia de negocio en Lima como "AAAA-MM-DD". */
export function diaDeNegocioLima(iso: string | Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(aFecha(iso))
  return partes
}

function aFecha(iso: string | Date): Date {
  return iso instanceof Date ? iso : new Date(iso)
}
