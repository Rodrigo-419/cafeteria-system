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

/**
 * Formatea un dia de negocio que llega como "AAAA-MM-DD" o como un ISO cuya
 * fecha ya representa el dia (p. ej. columnas `date` guardadas a medianoche UTC,
 * como la contratacion o el cese de un empleado). A diferencia de
 * `formatearFecha`, NO convierte a America/Lima: hacerlo mostraria el dia
 * anterior.
 */
export function formatearDiaLocal(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    dateStyle: 'medium',
  }).format(new Date(`${iso.slice(0, 10)}T12:00:00.000Z`))
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

/**
 * `true` si el texto es un dia calendario real en formato "AAAA-MM-DD".
 *
 * El backend usa la misma regla: un `2026-02-30` con formato correcto no es un
 * dia valido y responde 400.
 */
export function esFechaLocalValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const [anio, mes, dia] = valor.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio!, mes! - 1, dia!))
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes! - 1 &&
    fecha.getUTCDate() === dia
  )
}

/**
 * Convierte un instante a un valor para `<input type="datetime-local">`
 * ("AAAA-MM-DDTHH:mm") en la zona del navegador. Es la operación inversa de
 * `new Date(valor)` al enviar el formulario.
 */
export function aInputDatetimeLocal(iso: string | Date): string {
  const fecha = aFecha(iso)
  const dosDigitos = (valor: number) => String(valor).padStart(2, '0')
  return (
    `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-` +
    `${dosDigitos(fecha.getDate())}T${dosDigitos(fecha.getHours())}:` +
    `${dosDigitos(fecha.getMinutes())}`
  )
}

function aFecha(iso: string | Date): Date {
  return iso instanceof Date ? iso : new Date(iso)
}
