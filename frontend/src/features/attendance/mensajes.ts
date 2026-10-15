// Traducción de errores de la API de asistencia a mensajes en español.
//
// El backend responde con mensajes precisos (p. ej. "PIN incorrecto",
// "Demasiados intentos de PIN"), así que se prioriza su texto y solo se cae a un
// genérico por código HTTP cuando no aporta nada. El 429 de marcación puede
// traer `Retry-After`; si llega, se añade cuántos segundos conviene esperar.
import { ApiError } from '@/lib/api/errors'

export type ContextoAsistencia =
  | 'listar'
  | 'terminal'
  | 'marcar'
  | 'detalle'
  | 'corregir'
  | 'faltas'
  | 'justificar'

const GENERICO = 'No se pudo conectar con el servidor. Inténtalo de nuevo.'

function textoDelServidor(error: ApiError): string | null {
  const mensaje = error.mensajes.join(' ').trim()
  return mensaje.length > 0 ? mensaje : null
}

/** Mensaje listo para mostrar según el contexto y el código HTTP. */
export function mensajeDeError(
  error: unknown,
  contexto: ContextoAsistencia,
): string {
  if (!(error instanceof ApiError)) {
    return GENERICO
  }

  const delServidor = textoDelServidor(error)

  switch (error.status) {
    case 400:
      return delServidor ?? 'Los datos enviados no son válidos.'
    case 403:
      if (contexto === 'marcar') {
        return delServidor ?? 'No se pudo validar la marcación.'
      }
      if (contexto === 'terminal') {
        return (
          delServidor ??
          'Tu cuenta no tiene una sucursal asignada para marcar asistencia.'
        )
      }
      return delServidor ?? 'No tienes permiso para esta acción.'
    case 404:
      return delServidor ?? 'No se encontró el registro en tu alcance.'
    case 409:
      return delServidor ?? 'La operación entra en conflicto con el estado actual.'
    case 429:
      return (delServidor ?? 'Demasiados intentos.') + segundos(error)
    default:
      return textoDelServidor(error) ?? GENERICO
  }
}

/** Añade la espera sugerida del `Retry-After` si el servidor la envió. */
function segundos(error: ApiError): string {
  if (error.retryAfter === undefined) {
    return ''
  }
  return ` Espera ${error.retryAfter} segundos antes de intentarlo de nuevo.`
}
