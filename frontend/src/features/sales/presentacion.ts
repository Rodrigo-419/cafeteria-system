// Etiquetas y utilidades de presentación del módulo de ventas.
import { aCentimos } from '@/lib/format/money'
import type { EstadoVenta, MetodoPagoVenta } from '@/types/api'

export const ETIQUETA_ESTADO: Record<EstadoVenta, string> = {
  completada: 'Completada',
  anulada: 'Anulada',
}

export const ETIQUETA_METODO: Record<MetodoPagoVenta, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
}

/** Precio decimal del backend ("12.50") a céntimos enteros, o `null` si es inválido. */
export function precioEnCentimos(precio: string): number | null {
  try {
    return aCentimos(precio)
  } catch {
    return null
  }
}
