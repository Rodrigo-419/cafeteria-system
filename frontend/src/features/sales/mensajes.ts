// Traducción de errores de la API de ventas a mensajes en español.
//
// El backend responde con mensajes precisos (sin acentos y con el léxico del
// dominio). Aquí se prioriza el mensaje del servidor cuando aporta detalle y, si
// no, se cae a un texto por código HTTP pensado para el mostrador.
import { ApiError } from '@/lib/api/errors'

export type ContextoVentas = 'carta' | 'registrar' | 'listar' | 'anular'

const GENERICO = 'No se pudo conectar con el servidor. Inténtalo de nuevo.'

function textoDelServidor(error: ApiError): string | null {
  const mensaje = error.mensajes.join(' ').trim()
  return mensaje.length > 0 ? mensaje : null
}

/** Mensaje listo para mostrar según el contexto y el código HTTP. */
export function mensajeDeError(
  error: unknown,
  contexto: ContextoVentas,
): string {
  if (!(error instanceof ApiError)) {
    return GENERICO
  }

  const delServidor = textoDelServidor(error)

  switch (error.status) {
    case 400:
      if (contexto === 'anular') {
        return delServidor ?? 'El motivo de la anulación no es válido.'
      }
      if (contexto === 'registrar') {
        return delServidor ?? 'La venta no cumple las reglas del sistema.'
      }
      return delServidor ?? 'La solicitud no es válida.'
    case 403:
      if (contexto === 'registrar') {
        return (
          delServidor ??
          'No puedes registrar ventas: no tienes una sucursal asignada.'
        )
      }
      if (contexto === 'anular') {
        return delServidor ?? 'No puedes anular esta venta.'
      }
      if (contexto === 'carta') {
        return delServidor ?? 'No tienes permiso para ver la carta.'
      }
      return delServidor ?? 'No tienes permiso para ver las ventas.'
    case 404:
      if (contexto === 'registrar') {
        return 'Una de las ofertas ya no está en la carta de tu sucursal.'
      }
      if (contexto === 'carta') {
        return 'No se encontró la carta de la sucursal.'
      }
      return 'La venta no existe o no está dentro de tu alcance.'
    case 409:
      if (contexto === 'registrar') {
        return 'Una de las ofertas está inactiva. Quítala del carrito e inténtalo de nuevo.'
      }
      if (/mismo d[ií]a/i.test(delServidor ?? '')) {
        return 'Solo se pueden anular ventas del mismo día.'
      }
      return delServidor ?? 'La venta ya fue anulada.'
    default:
      return delServidor ?? `Error ${error.status}`
  }
}
