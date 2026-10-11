// Reglas y etiquetas de presentación del catálogo de productos.
//
// Las validaciones replican (sin sustituir) las reglas del backend: el servidor
// sigue siendo la autoridad y responde 400/409 con su propio mensaje. Aquí solo
// se evita enviar peticiones que ya se sabe que van a fallar.
import { aCentimos } from '@/lib/format/money'
import type { EstadoOferta } from '@/types/api'

export const PRECIO_MINIMO = 0.01
export const PRECIO_MAXIMO = 100000

/** Nombre de la variante base del sistema: no se renombra ni se borra. */
export const NOMBRE_VARIANTE_BASE = 'Única'

export const LARGO_NOMBRE_CATEGORIA = { min: 2, max: 80 } as const
export const LARGO_NOMBRE_VARIANTE = { min: 2, max: 80 } as const
export const LARGO_NOMBRE_PRODUCTO = { min: 2, max: 100 } as const
export const LARGO_DESCRIPCION_PRODUCTO = 300

export const ETIQUETA_OFERTA: Record<EstadoOferta, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
}

/** Forma de comparar nombres de catálogo: sin espacios sobrantes ni mayúsculas. */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/gu, ' ').toLowerCase()
}

/** `true` si el nombre corresponde a la variante base "Única". */
export function esVarianteBase(nombre: string): boolean {
  return normalizarNombre(nombre) === normalizarNombre(NOMBRE_VARIANTE_BASE)
}

/** Mensaje de error del nombre, o `null` si es válido. */
export function mensajeNombre(
  nombre: string,
  limites: { min: number; max: number },
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

/** Precio decimal del backend ("12.50") a céntimos enteros (0 si es inválido). */
export function precioEnCentimos(precio: string): number {
  try {
    return aCentimos(precio)
  } catch {
    return 0
  }
}

export type ResultadoPrecio =
  | { valido: true; valor: number }
  | { valido: false; mensaje: string }

/**
 * Valida el formato de un precio escrito en el formulario y lo convierte a
 * número. Solo comprueba que sea un número positivo con hasta dos decimales:
 * el rango `[0.01, 100000]` lo impone el backend, cuya respuesta 400 se muestra
 * tal cual (es la autoridad y evita duplicar la regla en dos sitios).
 */
export function validarPrecio(texto: string): ResultadoPrecio {
  const limpio = texto.trim()

  if (limpio === '' || !/^\d+(\.\d{1,2})?$/.test(limpio)) {
    return {
      valido: false,
      mensaje: 'El precio debe ser un número con hasta 2 decimales.',
    }
  }

  const valor = Number(limpio)
  if (!Number.isFinite(valor)) {
    return {
      valido: false,
      mensaje: 'El precio debe ser un número con hasta 2 decimales.',
    }
  }

  return { valido: true, valor }
}
