// Traducción de errores de la API de reportes a mensajes en español.

import { ApiError } from '@/lib/api/errors'

const GENERICO = 'No se pudo conectar con el servidor. Inténtalo de nuevo.'

function textoDelServidor(error: ApiError): string | null {
  const mensaje = error.mensajes.join(' ').trim()
  return mensaje.length > 0 ? mensaje : null
}

/**
 * Mensaje legible para el error del reporte. El backend responde 400 con el
 * detalle del rango (orden o tope de 92 días), 403 si el usuario no tiene
 * `reportes.comparativos.ver` y 404 si la sucursal filtrada no existe.
 */
export function mensajeDeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return GENERICO
  }

  const delServidor = textoDelServidor(error)

  switch (error.status) {
    case 400:
      return delServidor ?? 'El rango de fechas no es válido.'
    case 403:
      return delServidor ?? 'No tienes permiso para ver el reporte comparativo.'
    case 404:
      return delServidor ?? 'La sucursal seleccionada no existe.'
    default:
      return delServidor ?? `Error ${error.status}`
  }
}
