// Reglas y etiquetas del inventario de insumos.
//
// Las validaciones replican (sin sustituir) las reglas del backend: el servidor
// sigue siendo la autoridad y responde 400/404/409 con su propio mensaje. Aquí
// solo se evita enviar peticiones que ya se sabe que van a fallar.
//
// Las cantidades (stock y mínimo) llegan como texto decimal ("12.50"). NUNCA se
// opera con `number` en coma flotante: se convierten a céntimos enteros con
// `aCentimos` para comparar y para calcular el nivel visual.
import { aCentimos } from '@/lib/format/money'
import type { EstadoStockInsumo, PresentacionInsumo } from '@/types/api'

/** Lista cerrada que acepta el backend para `presentacion`, en su orden. */
export const PRESENTACIONES_INSUMO: readonly PresentacionInsumo[] = [
  'paquete',
  'bolsa',
  'caja',
  'unidad',
  'paquete_varias_unidades',
]

export const ETIQUETA_PRESENTACION: Record<PresentacionInsumo, string> = {
  paquete: 'Paquete',
  bolsa: 'Bolsa',
  caja: 'Caja',
  unidad: 'Unidad',
  paquete_varias_unidades: 'Paquete (varias unidades)',
}

export const ETIQUETA_ESTADO_STOCK: Record<EstadoStockInsumo, string> = {
  activo: 'Activo',
  descontinuado: 'Descontinuado',
}

export const LARGO_NOMBRE_INSUMO = { min: 2, max: 100 } as const
export const LARGO_MOTIVO_ENTRADA = 200

/** Cantidad máxima admitida por el backend (Decimal(12,2)). */
export const CANTIDAD_MAXIMA = 9999999999.99

/** Mensaje de error del nombre, o `null` si es válido. */
export function mensajeNombre(
  nombre: string,
  limites: { min: number; max: number } = LARGO_NOMBRE_INSUMO,
): string | null {
  const limpio = nombre.trim()
  if (limpio.length < limites.min) {
    return `El nombre debe tener al menos ${limites.min} caracteres.`
  }
  if (limpio.length > limites.max) {
    return `El nombre no puede exceder ${limites.max} caracteres.`
  }
  return null
}

export type ResultadoCantidad =
  | { valida: true; valor: number }
  | { valida: false; mensaje: string }

/**
 * Valida el formato de una cantidad escrita en el formulario (stock mínimo o
 * cantidad de una entrada). `estrictoPositivo` exige > 0 (entradas); en su
 * defecto admite 0 (stock mínimo). El rango y los decimales los impone el
 * backend, cuya respuesta 400 se muestra tal cual.
 */
export function validarCantidad(
  texto: string,
  { estrictoPositivo }: { estrictoPositivo: boolean },
): ResultadoCantidad {
  const limpio = texto.trim()

  if (limpio === '' || !/^\d+(\.\d{1,2})?$/.test(limpio)) {
    return {
      valida: false,
      mensaje: 'La cantidad debe ser un número con hasta 2 decimales.',
    }
  }

  const valor = Number(limpio)
  if (!Number.isFinite(valor)) {
    return {
      valida: false,
      mensaje: 'La cantidad debe ser un número con hasta 2 decimales.',
    }
  }
  if (estrictoPositivo && valor <= 0) {
    return { valida: false, mensaje: 'La cantidad debe ser mayor que 0.' }
  }
  if (valor > CANTIDAD_MAXIMA) {
    return {
      valida: false,
      mensaje: `La cantidad no puede exceder ${CANTIDAD_MAXIMA}.`,
    }
  }

  return { valida: true, valor }
}

/** Formatea una cantidad decimal ("12.00", "3.20") para mostrarla sin ceros. */
export function formatearCantidad(texto: string): string {
  const [entero, decimal] = texto.split('.')
  if (decimal === undefined) return entero
  const recortada = decimal.replace(/0+$/u, '')
  return recortada === '' ? entero : `${entero}.${recortada}`
}

export type EstadoNivel = 'descontinuado' | 'bajo' | 'normal'

/**
 * Clasifica el nivel de un insumo en la sucursal a partir del stock, el mínimo
 * y el estado. Debe coincidir EXACTAMENTE con la regla del backend
 * (`debeAvisar`): un insumo activo está "bajo mínimo" mientras
 * `stock <= mínimo` (el stock igual al mínimo mantiene la alerta abierta) y solo
 * pasa a "normal" cuando `stock > mínimo`.
 */
export function estadoNivel(
  stock: string,
  minimo: string,
  estado: EstadoStockInsumo,
): EstadoNivel {
  if (estado === 'descontinuado') return 'descontinuado'
  const stockC = aCentimos(stock)
  const minimoC = aCentimos(minimo)
  return stockC <= minimoC ? 'bajo' : 'normal'
}

export const ETIQUETA_NIVEL: Record<EstadoNivel, string> = {
  descontinuado: 'Descontinuado',
  bajo: 'Bajo mínimo',
  normal: 'Normal',
}

/**
 * Porcentaje 0..100 para la barra visual: stock sobre el mínimo, recortado a
 * 100%. Con mínimo 0 la barra es 100% si hay stock y 0% si está en cero.
 */
export function porcentajeNivel(stock: string, minimo: string): number {
  const stockC = aCentimos(stock)
  const minimoC = aCentimos(minimo)
  if (minimoC <= 0) return stockC > 0 ? 100 : 0
  const bruto = Math.round((stockC * 100) / minimoC)
  return Math.max(0, Math.min(100, bruto))
}
