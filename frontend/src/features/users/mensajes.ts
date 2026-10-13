// Traducción de errores de la API de usuarios a mensajes en español.
//
// El backend responde con mensajes precisos (usuario fuera de alcance, rol o
// sucursal inválidos, último administrador activo, nombre de usuario repetido,
// reglas de concesión/revocación de permisos). Se prioriza el mensaje del
// servidor cuando aporta detalle y, si no, se cae a un texto por código HTTP.
import { ApiError } from '@/lib/api/errors'

export type ContextoUsuarios =
  | 'listar'
  | 'detalle'
  | 'crear'
  | 'editar'
  | 'estado'
  | 'permisos'

const GENERICO = 'No se pudo conectar con el servidor. Inténtalo de nuevo.'

function textoDelServidor(error: ApiError): string | null {
  const mensaje = error.mensajes.join(' ').trim()
  return mensaje.length > 0 ? mensaje : null
}

/** Mensaje listo para mostrar según el contexto y el código HTTP. */
export function mensajeDeError(
  error: unknown,
  _contexto: ContextoUsuarios,
): string {
  if (!(error instanceof ApiError)) {
    return GENERICO
  }

  const delServidor = textoDelServidor(error)

  switch (error.status) {
    case 400:
      return delServidor ?? 'Los datos enviados no son válidos.'
    case 403:
      return (
        delServidor ??
        'No tienes permiso para gestionar usuarios o cambiar roles y sucursales.'
      )
    case 404:
      return delServidor ?? 'El usuario no existe o está fuera de tu alcance.'
    case 409:
      return (
        delServidor ??
        'La solicitud entra en conflicto con el estado actual (p. ej. el último administrador activo).'
      )
    default:
      return delServidor ?? `Error ${error.status}`
  }
}

/**
 * `true` cuando el error de la API de usuarios se muestra tal cual en la
 * pantalla (no se reemplaza por un texto genérico).
 */
export function esMensajeDelServidor(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return error.mensajes.some((mensaje) => mensaje.trim().length > 0)
}