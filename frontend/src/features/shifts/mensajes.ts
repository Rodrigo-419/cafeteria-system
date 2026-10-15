// Traducción de errores de la API de turnos y asignaciones a mensajes en español.
//
// El backend responde con mensajes precisos y, en los conflictos de negocio
// (400/409), añade un arreglo `problemas` con el detalle de cada regla. Se
// prioriza el texto del servidor cuando aporta detalle y, si no, se cae a un
// texto por código HTTP.
import { ApiError } from '@/lib/api/errors'

export type ContextoTurnos = 'listar' | 'crear' | 'editar' | 'asignar' | 'retirar'

const GENERICO = 'No se pudo conectar con el servidor. Inténtalo de nuevo.'

function textoDelServidor(error: ApiError): string | null {
  const mensaje = error.mensajes.join(' ').trim()
  return mensaje.length > 0 ? mensaje : null
}

/** Detalle de reglas de negocio que Nest adjunta en `problemas`. */
function problemasDelServidor(error: ApiError): string[] {
  const cuerpo = error.cuerpo
  if (cuerpo && typeof cuerpo === 'object') {
    const problemas = (cuerpo as { problemas?: unknown }).problemas
    if (Array.isArray(problemas)) {
      return problemas.map(String).filter((texto) => texto.trim() !== '')
    }
  }
  return []
}

function conDetalle(mensaje: string, problemas: string[]): string {
  return problemas.length === 0 ? mensaje : `${mensaje} ${problemas.join(' ')}`
}

/** Mensaje listo para mostrar según el contexto y el código HTTP. */
export function mensajeDeError(error: unknown, contexto: ContextoTurnos): string {
  if (!(error instanceof ApiError)) {
    return GENERICO
  }

  const delServidor = textoDelServidor(error)
  const problemas = problemasDelServidor(error)

  switch (error.status) {
    case 400:
      return conDetalle(
        delServidor ?? 'Los datos enviados no son válidos.',
        problemas,
      )
    case 403:
      if (contexto === 'listar') {
        return delServidor ?? 'No tienes permiso para ver los turnos.'
      }
      return delServidor ?? 'No tienes permiso para gestionar turnos.'
    case 404:
      return (
        delServidor ??
        'El turno, el empleado o la asignación no existe o está fuera de tu alcance.'
      )
    case 409:
      return (
        delServidor ??
        'La operación entra en conflicto con las asignaciones vigentes.'
      )
    default:
      return delServidor ?? `Error ${error.status}`
  }
}
