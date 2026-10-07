// Reglas de dominio para el modulo de equipos.
//
// Estas reglas son funciones puras para poder probarlas sin Nest ni Prisma.

import { esAdmin, esEmpleado, esGerente } from '../../../users/domain/roles';

export type ActorEquipos = {
  id: string;
  rol: string | null;
  sucursalId: string | null;
};

export const ESTADOS_EQUIPO = [
  'funcionando',
  'danado',
  'en_mantenimiento',
  'retirado',
] as const;

export type EstadoEquipo = (typeof ESTADOS_EQUIPO)[number];

/**
 * Determina si el actor puede acceder a un equipo de la sucursal indicada.
 *
 * Admin puede acceder a cualquier sucursal. Gerente y Empleado solo a la suya.
 * En todos los casos, cuando no corresponde al alcance, la respuesta esperada
 * desde HTTP es 404 (no 403) para no revelar la existencia del recurso.
 */
export function puedeAccederEquipo(
  actor: ActorEquipos,
  sucursalId: string | null | undefined,
): boolean {
  if (esAdmin(actor.rol) || (actor.rol || '').toLowerCase() === 'admin') {
    return true;
  }

  if (!esGerente(actor.rol) && !esEmpleado(actor.rol)) {
    return false;
  }

  if (actor.sucursalId === null || actor.sucursalId === undefined) {
    return false;
  }

  return sucursalId !== null && sucursalId !== undefined && sucursalId === actor.sucursalId;
}

/**
 * Determina el alcance para el listado de equipos.
 * - Admin: sin filtro de sucursal (undefined).
 * - Gerente/Empleado: solo su sucursal. Si no tiene sucursal asignada, se usa
 *   un id imposible para no devolver resultados por accidente.
 */
export const SIN_ALCANCE_EQUIPO = '__sin_alcance_equipo__';

export function filtroEquiposVisibles(
  actor: ActorEquipos,
): { sucursalId: string } | undefined {
  if (esAdmin(actor.rol) || (actor.rol || '').toLowerCase() === 'admin') {
    return undefined;
  }

  if (!esGerente(actor.rol) && !esEmpleado(actor.rol)) {
    return { sucursalId: SIN_ALCANCE_EQUIPO };
  }

  if (actor.sucursalId === null || actor.sucursalId === undefined) {
    return { sucursalId: SIN_ALCANCE_EQUIPO };
  }

  return { sucursalId: actor.sucursalId };
}

/** Indica si un estado es terminal. Un equipo retirado no admite cambios de estado. */
export function esEstadoTerminal(estado: EstadoEquipo): boolean {
  return estado === 'retirado';
}

/** Indica si la transicion de estado es valida. */
export function esTransicionEstadoValida(
  estadoActual: EstadoEquipo,
  estadoNuevo: EstadoEquipo,
): boolean {
  if (estadoActual === estadoNuevo) {
    return true;
  }

  if (esEstadoTerminal(estadoActual)) {
    return false;
  }

  if (!ESTADOS_EQUIPO.includes(estadoNuevo)) {
    return false;
  }

  return true;
}

/** Normaliza el nombre recortando espacios. */
export function normalizarNombreEquipo(nombre: string): string {
  return nombre.trim().replace(/\s+/gu, ' ').toLowerCase();
}

/** Determina si hay cambios reales entre dos valores de nombre. */
export function hayCambioNombre(anterior: string, nuevo: string): boolean {
  return normalizarNombreEquipo(anterior) !== normalizarNombreEquipo(nuevo);
}

/** Determina si hay cambios reales entre dos valores de texto (tipo u observaciones). */
export function hayCambioTexto(anterior: string | null, nuevo: string | null): boolean {
  const a = anterior === null ? '' : anterior.trim();
  const b = nuevo === null ? '' : nuevo.trim();
  return a !== b;
}

/** Indica si el cambio requiere generar un registro de historial. */
export function requiereHistorial(
  estadoCambia: boolean,
  observacionesCambia: boolean,
): boolean {
  return estadoCambia || observacionesCambia;
}
