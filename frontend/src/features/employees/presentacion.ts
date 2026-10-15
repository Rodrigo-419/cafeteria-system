// Etiquetas y reglas de presentación del módulo de personal.
//
// Las validaciones replican (sin sustituir) las del backend: el servidor es la
// autoridad y responde 400/409 con su propio mensaje. Los estados usan los
// nombres reales del contrato (`activo`/`inactivo`); la interfaz los muestra
// como "Activo" y "Cesado".
import { esFechaLocalValida } from '@/lib/format/dates'
import type { TonoStatusPill } from '@/components/shared/StatusPill'
import type { EstadoEmpleado } from '@/types/api'

/** Estados posibles de un empleado. */
export const ESTADOS_EMPLEADO: readonly EstadoEmpleado[] = ['activo', 'inactivo']

export const ETIQUETA_ESTADO_EMPLEADO: Record<EstadoEmpleado, string> = {
  activo: 'Activo',
  inactivo: 'Cesado',
}

/** Color semántico de cada estado de empleado. */
export const TONO_ESTADO_EMPLEADO: Record<EstadoEmpleado, TonoStatusPill> = {
  activo: 'success',
  inactivo: 'neutral',
}

/**
 * Roles de usuario que pueden ser empleados (mismos que valida el backend). Un
 * Admin es central y no puede vincularse a un empleado.
 */
export const ROLES_VINCULABLES = ['Empleado', 'Gerente'] as const

/** `cargo` es el único campo editable; el backend exige entre 1 y 100. */
export const LARGO_CARGO = { min: 1, max: 100 } as const

/** Mensaje de error del cargo, o `null` si es válido. */
export function mensajeCargo(valor: string): string | null {
  const limpio = valor.trim()
  if (limpio.length < LARGO_CARGO.min) {
    return 'El cargo no puede estar vacío.'
  }
  if (limpio.length > LARGO_CARGO.max) {
    return `El cargo no puede exceder ${LARGO_CARGO.max} caracteres.`
  }
  return null
}

/** Mensaje de error de la fecha de contratación (obligatoria), o `null`. */
export function mensajeFechaContratacion(valor: string): string | null {
  if (valor === '') return 'La fecha de contratación es obligatoria.'
  if (!esFechaLocalValida(valor)) {
    return 'La fecha de contratación debe ser un día válido.'
  }
  return null
}

/**
 * Mensaje de error de la fecha de cese (opcional), o `null`. No puede ser
 * anterior a la fecha de contratación. `fechaContratacion` es un instante ISO.
 */
export function mensajeFechaCese(
  fechaContratacion: string,
  valor: string,
): string | null {
  if (valor === '') return null
  if (!esFechaLocalValida(valor)) {
    return 'La fecha de cese debe ser un día válido.'
  }
  if (valor < fechaContratacion.slice(0, 10)) {
    return 'La fecha de cese no puede ser anterior a la fecha de contratación.'
  }
  return null
}
