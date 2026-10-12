// Traducción de errores de la API de equipos a mensajes en español.
//
// El backend responde con mensajes precisos (sucursal inexistente, fuera de
// alcance, equipo retirado, transición inválida). Se prioriza el mensaje del
// servidor cuando aporta detalle y, si no, se cae a un texto por código HTTP.
import { ApiError } from '@/lib/api/errors'

export type ContextoEquipo =
  | 'listar'
  | 'detalle'
  | 'historial'
  | 'crear'
  | 'editar'
  | 'estado'

const GENERICO = 'No se pudo conectar con el servidor. Inténtalo de nuevo.'

function textoDelServidor(error: ApiError): string | null {
  const mensaje = error.mensajes.join(' ').trim()
  return mensaje.length > 0 ? mensaje : null
}

/** Mensaje listo para mostrar según el contexto y el código HTTP. */
export function mensajeDeError(error: unknown, contexto: ContextoEquipo): string {
  if (!(error instanceof ApiError)) {
    return GENERICO
  }

  const delServidor = textoDelServidor(error)

  switch (error.status) {
    case 400:
      return delServidor ?? 'Los datos enviados no son válidos.'
    case 403:
      if (contexto === 'crear' || contexto === 'editar' || contexto === 'estado') {
        return delServidor ?? 'No tienes permiso para gestionar equipos.'
      }
      return delServidor ?? 'No tienes permiso para ver los equipos.'
    case 404:
      return delServidor ?? 'El equipo no existe o está fuera de tu alcance.'
    case 409:
      // Un equipo retirado es terminal: el servidor explica el conflicto.
      return delServidor ?? 'El equipo está retirado y no admite cambios.'
    default:
      return delServidor ?? `Error ${error.status}`
  }
}
