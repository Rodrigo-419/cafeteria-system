// Traducción de errores de la API de auditoría a mensajes en español.
//
// El backend responde con mensajes precisos (rango de fechas inválido o de más
// de 92 días, usuario fuera de alcance). Se prioriza el mensaje del servidor
// cuando aporta detalle y, si no, se cae a un texto por código HTTP.
import { ApiError } from '@/lib/api/errors'

export type ContextoAuditoria = 'listar' | 'historial'

const GENERICO = 'No se pudo conectar con el servidor. Inténtalo de nuevo.'

function textoDelServidor(error: ApiError): string | null {
  const mensaje = error.mensajes.join(' ').trim()
  return mensaje.length > 0 ? mensaje : null
}

/** `true` cuando el error es un 404 (historial fuera de alcance). */
export function esErrorNoEncontrado(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

/** Mensaje listo para mostrar según el contexto y el código HTTP. */
export function mensajeDeError(
  error: unknown,
  _contexto: ContextoAuditoria,
): string {
  if (!(error instanceof ApiError)) {
    return GENERICO
  }

  const delServidor = textoDelServidor(error)

  switch (error.status) {
    case 400:
      return delServidor ?? 'Los filtros no son válidos.'
    case 403:
      return (
        delServidor ?? 'No tienes permiso para consultar la auditoría.'
      )
    case 404:
      return (
        delServidor ?? 'El historial de este usuario no está disponible.'
      )
    default:
      return delServidor ?? `Error ${error.status}`
  }
}

/** Accesibilidad: mensaje alternativo cuando el historial no existe (404). */
export const SIN_HISTORIAL = 'El historial de este usuario no está disponible.'
