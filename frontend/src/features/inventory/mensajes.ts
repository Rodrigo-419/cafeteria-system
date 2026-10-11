// Traducción de errores de la API de inventario a mensajes en español.
//
// El backend responde con mensajes precisos (unicidad, borrado con stock,
// insumo no dado de alta o descontinuado, fuera de alcance). Se prioriza el
// mensaje del servidor cuando aporta detalle y, si no, se cae a un texto por
// código HTTP.
import { ApiError } from '@/lib/api/errors'

export type ContextoInventario =
  | 'insumos'
  | 'crear'
  | 'editar'
  | 'eliminar'
  | 'stock'
  | 'configurar'
  | 'entrada'
  | 'alertas'

const GENERICO = 'No se pudo conectar con el servidor. Inténtalo de nuevo.'

function textoDelServidor(error: ApiError): string | null {
  const mensaje = error.mensajes.join(' ').trim()
  return mensaje.length > 0 ? mensaje : null
}

/** Mensaje listo para mostrar según el contexto y el código HTTP. */
export function mensajeDeError(
  error: unknown,
  contexto: ContextoInventario,
): string {
  if (!(error instanceof ApiError)) {
    return GENERICO
  }

  const delServidor = textoDelServidor(error)

  switch (error.status) {
    case 400:
      return delServidor ?? 'Los datos enviados no son válidos.'
    case 403:
      if (contexto === 'crear' || contexto === 'editar' || contexto === 'eliminar') {
        return delServidor ?? 'No tienes permiso para editar el catálogo de insumos.'
      }
      return delServidor ?? 'No tienes permiso para gestionar el inventario.'
    case 404:
      if (
        contexto === 'stock' ||
        contexto === 'configurar' ||
        contexto === 'entrada'
      ) {
        return delServidor ?? 'La sucursal o el insumo no está dentro de tu alcance.'
      }
      return 'El recurso ya no existe o está fuera de tu alcance.'
    case 409:
      // Unicidad de nombres, borrado con stock o insumo descontinuado: el
      // servidor lo explica.
      return delServidor ?? 'La operación entra en conflicto con el estado actual.'
    default:
      return delServidor ?? `Error ${error.status}`
  }
}
