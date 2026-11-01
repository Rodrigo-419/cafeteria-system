// Validación y mensajes de la exportación.
//
// Las reglas de fechas replican las del backend: días de negocio en
// America/Lima, rango inclusivo, `hasta >= desde`, máximo 92 días y ninguna
// fecha futura. El máximo de días es una regla del servidor que la interfaz
// puede anticipar; los topes de filas NO se replican aquí.
import { ApiError, esErrorNoAutorizado } from '@/lib/api/errors'
import { esFechaLocalValida } from '@/lib/format/dates'
import { CONJUNTOS_EXPORTACION } from './catalogo'

/** Días máximos que acepta el backend para un rango de actividad. */
export const MAXIMO_DIAS_RANGO_EXPORTACION = 92

const MILISEGUNDOS_DIA = 86_400_000

export type CampoRango = 'desde' | 'hasta'

export interface ErrorRangoExportacion {
  mensaje: string
  campo: CampoRango
}

/** Días de calendario del rango `[desde, hasta]`, ambos incluidos. */
export function diasDelRango(desde: string, hasta: string): number {
  const inicio = Date.parse(`${desde}T00:00:00.000Z`)
  const fin = Date.parse(`${hasta}T00:00:00.000Z`)
  return Math.round((fin - inicio) / MILISEGUNDOS_DIA) + 1
}

/** Día `AAAA-MM-DD` desplazado `dias` (aritmética en UTC). */
export function desplazarDia(dia: string, dias: number): string {
  const fecha = new Date(`${dia}T00:00:00.000Z`)
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

/**
 * Valida el rango de un conjunto de actividad.
 *
 * `hoy` debe ser el día de negocio en America/Lima (`diaDeNegocioLima`).
 * Devuelve el mensaje y el campo que conviene enfocar, o `null` si es válido.
 */
export function validarRangoExportacion(
  desde: string,
  hasta: string,
  hoy: string,
): ErrorRangoExportacion | null {
  if (desde === '' && hasta === '') {
    return {
      mensaje: 'Selecciona la fecha de inicio y la fecha de fin.',
      campo: 'desde',
    }
  }
  if (desde === '') {
    return { mensaje: 'Selecciona la fecha de inicio.', campo: 'desde' }
  }
  if (hasta === '') {
    return { mensaje: 'Selecciona la fecha de fin.', campo: 'hasta' }
  }
  if (!esFechaLocalValida(desde)) {
    return { mensaje: 'Ingresa una fecha de inicio válida.', campo: 'desde' }
  }
  if (!esFechaLocalValida(hasta)) {
    return { mensaje: 'Ingresa una fecha de fin válida.', campo: 'hasta' }
  }
  if (desde > hoy) {
    return {
      mensaje: 'La fecha de inicio no puede ser futura.',
      campo: 'desde',
    }
  }
  if (hasta > hoy) {
    return { mensaje: 'La fecha de fin no puede ser futura.', campo: 'hasta' }
  }
  if (hasta < desde) {
    return {
      mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio.',
      campo: 'hasta',
    }
  }
  if (diasDelRango(desde, hasta) > MAXIMO_DIAS_RANGO_EXPORTACION) {
    return {
      mensaje: `El rango no puede superar ${MAXIMO_DIAS_RANGO_EXPORTACION} días.`,
      campo: 'desde',
    }
  }
  return null
}

/**
 * Sustituye las claves técnicas entre comillas de un mensaje del servidor por
 * su etiqueta en español (p. ej. `"ventas"` → `"Ventas"`). No altera cifras:
 * los topes siguen viniendo del servidor y no se escriben en la interfaz.
 */
export function humanizarMensajeExportacion(mensaje: string): string {
  let texto = mensaje
  for (const definicion of CONJUNTOS_EXPORTACION) {
    texto = texto.replaceAll(`"${definicion.clave}"`, `"${definicion.etiqueta}"`)
  }
  return texto
}

/**
 * Mensaje visible de un fallo de exportación.
 *
 * Un 401 no se muestra: el cliente ya cierra la sesión como en el resto de la
 * aplicación. Los 5xx y los fallos de red usan un texto neutro para no exponer
 * detalles técnicos. Los mensajes del servidor en español se conservan.
 */
export function mensajeExportacion(error: unknown): string | null {
  if (esErrorNoAutorizado(error)) {
    return null
  }

  if (error instanceof ApiError) {
    const mensaje = humanizarMensajeExportacion(
      error.mensajes.filter((texto) => texto.trim() !== '').join(' '),
    ).trim()

    if (error.status === 403) {
      return (
        mensaje ||
        'No tienes permiso para exportar este conjunto.'
      )
    }
    if (error.status === 404) {
      return mensaje || 'El conjunto solicitado no está disponible.'
    }
    if (error.status === 400 || error.status === 413 || error.status === 429) {
      if (mensaje !== '' && !/^Error \d{3}$/.test(mensaje)) {
        return mensaje
      }
    }
  }

  return 'No se pudo generar el archivo. Inténtalo de nuevo.'
}

/** `true` si la petición se canceló de forma intencional. */
export function esCancelacion(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'CanceledError')
  )
}
