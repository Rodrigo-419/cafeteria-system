// Etiquetas y reglas de presentación del módulo de usuarios.
//
// Las validaciones replican (sin sustituir) las del backend: el servidor es la
// autoridad y responde 400/409 con su propio mensaje. El nombre de usuario se
// normaliza como en el backend (minúsculas y sin espacios) y la contraseña
// respeta la política real de 12 caracteres de mínimo (72 bytes máximos por
// el límite de bcrypt).
import type { TonoStatusPill } from '@/components/shared/StatusPill'
import type { EstadoUsuario, OrigenPermiso } from '@/types/api'

/** Roles gestionables, con las etiquetas literales que usa el backend. */
export const ROLES_USUARIO = ['Admin', 'Gerente', 'Empleado'] as const

/** Estados posibles de un usuario. */
export const ESTADOS_USUARIO: readonly EstadoUsuario[] = ['activo', 'bloqueado']

export const ETIQUETA_ESTADO_USUARIO: Record<EstadoUsuario, string> = {
  activo: 'Activo',
  bloqueado: 'Bloqueado',
}

/** Color semántico de cada estado de usuario. */
export const TONO_ESTADO_USUARIO: Record<EstadoUsuario, TonoStatusPill> = {
  activo: 'success',
  bloqueado: 'error',
}

/** Etiquetas del rol y del origen de cada permiso efectivo. */
export const ETIQUETA_ORIGEN_PERMISO: Record<OrigenPermiso, string> = {
  rol: 'Del rol',
  concedido: 'Concesión',
  revocado: 'Revocado',
}

export const LARGO_NOMBRE = { min: 3, max: 120 } as const
export const LARGO_NOMBRE_USUARIO = { min: 3, max: 30 } as const

/** Mismo patrón que el backend (`nombre-usuario.ts`). */
export const PATRON_NOMBRE_USUARIO = /^[a-z0-9][a-z0-9._-]{2,29}$/

export const LONGITUD_MINIMA_PASSWORD = 12
export const LONGITUD_MAXIMA_BYTES_PASSWORD = 72

/**
 * Permisos que la matriz de seguridad permite conceder a un Empleado
 * (`insumos.ver`, `inventario.registrar`, `ventas.registrar` y `equipo.ver`).
 * El backend valida esto también; la interfaz lo usa para habilitar la acción.
 */
export const PERMISOS_CONCEDIBLES_A_EMPLEADO = [
  'insumos.ver',
  'inventario.registrar',
  'ventas.registrar',
  'equipo.ver',
] as const

/** Normaliza el nombre de usuario igual que el backend (trim + minúsculas). */
export function normalizarNombreUsuario(valor: string): string {
  return valor.trim().toLowerCase()
}

/** Mensaje de error del nombre de usuario, o `null` si es válido. */
export function mensajeNombreUsuario(valor: string): string | null {
  const normalizado = normalizarNombreUsuario(valor)
  if (normalizado.length < LARGO_NOMBRE_USUARIO.min) {
    return `El nombre de usuario debe tener al menos ${LARGO_NOMBRE_USUARIO.min} caracteres.`
  }
  if (normalizado.length > LARGO_NOMBRE_USUARIO.max) {
    return `El nombre de usuario no puede exceder ${LARGO_NOMBRE_USUARIO.max} caracteres.`
  }
  if (!PATRON_NOMBRE_USUARIO.test(normalizado)) {
    return 'Debe empezar por letra o número y usar solo minúsculas, números, puntos, guiones o guiones bajos.'
  }
  return null
}

/** Mensaje de error del nombre completo, o `null` si es válido. */
export function mensajeNombre(valor: string): string | null {
  const limpio = valor.trim()
  if (limpio.length < LARGO_NOMBRE.min) {
    return `El nombre debe tener al menos ${LARGO_NOMBRE.min} caracteres.`
  }
  if (limpio.length > LARGO_NOMBRE.max) {
    return `El nombre no puede exceder ${LARGO_NOMBRE.max} caracteres.`
  }
  return null
}

/** Mensaje de error de la contraseña, o `null` si es válida. */
export function mensajePassword(valor: string): string | null {
  if (valor.length < LONGITUD_MINIMA_PASSWORD) {
    return `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres.`
  }
  const bytes = new TextEncoder().encode(valor).length
  if (bytes > LONGITUD_MAXIMA_BYTES_PASSWORD) {
    return `La contraseña no puede exceder ${LONGITUD_MAXIMA_BYTES_PASSWORD} bytes (límite de bcrypt).`
  }
  return null
}