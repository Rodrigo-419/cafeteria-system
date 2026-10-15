// Traducción de errores de la API de personal a mensajes en español.
//
// El backend responde con mensajes precisos (usuario fuera de alcance o de otra
// sucursal, usuario ya registrado como empleado, empleado ya cesado, fecha de
// cese inválida). Se prioriza el mensaje del servidor cuando aporta detalle y,
// si no, se cae a un texto por código HTTP.
import { ApiError } from '@/lib/api/errors'

export type ContextoEmpleados =
  | 'listar'
  | 'detalle'
  | 'crear'
  | 'editar'
  | 'cesar'
  | 'pin'

const GENERICO = 'No se pudo conectar con el servidor. Inténtalo de nuevo.'

function textoDelServidor(error: ApiError): string | null {
  const mensaje = error.mensajes.join(' ').trim()
  return mensaje.length > 0 ? mensaje : null
}

/** Mensaje listo para mostrar según el contexto y el código HTTP. */
export function mensajeDeError(
  error: unknown,
  contexto: ContextoEmpleados,
): string {
  if (!(error instanceof ApiError)) {
    return GENERICO
  }

  const delServidor = textoDelServidor(error)

  switch (error.status) {
    case 400:
      return delServidor ?? 'Los datos enviados no son válidos.'
    case 403:
      if (contexto === 'listar' || contexto === 'detalle') {
        return delServidor ?? 'No tienes permiso para ver los empleados.'
      }
      return delServidor ?? 'No tienes permiso para gestionar empleados.'
    case 404:
      return delServidor ?? 'El empleado no existe o está fuera de tu alcance.'
    case 409:
      return (
        delServidor ??
        'La operación entra en conflicto con el estado actual del empleado.'
      )
    default:
      return delServidor ?? `Error ${error.status}`
  }
}
