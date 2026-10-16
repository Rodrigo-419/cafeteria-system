// Traducción de errores de la API de sucursales a mensajes en español.

import { ApiError } from '@/lib/api/errors'

export type ContextoSucursales =
  | 'listar'
  | 'obtener'
  | 'crear'
  | 'editar'

const GENERICO = 'No se pudo conectar con el servidor. Inténtalo de nuevo.'

function textoDelServidor(error: ApiError): string | null {
  const mensaje = error.mensajes.join(' ').trim()
  return mensaje.length > 0 ? mensaje : null
}

export function mensajeDeError(
  error: unknown,
  _contexto: ContextoSucursales,
): string {
  if (!(error instanceof ApiError)) {
    return GENERICO
  }

  const delServidor = textoDelServidor(error)

  switch (error.status) {
    case 400:
      return delServidor ?? 'Los datos enviados no son válidos.'
    case 403:
      return delServidor ?? 'No tienes permiso para esta acción.'
    case 404:
      return delServidor ?? 'No se encontró la sucursal en tu alcance.'
    case 409:
      return delServidor ?? 'Ya existe una sucursal con ese nombre.'
    default:
      return delServidor ?? `Error ${error.status}`
  }
}

