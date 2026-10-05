// Regla de dominio: combinacion valida de rol y sucursal, y proteccion del
// ultimo Admin activo.

import { esAdmin, esGerente, NombreRol, ROL_EMPLEADO } from '../roles';

/**
 * El Admin es central y no pertenece a una sucursal, asi que su `sucursalId`
 * debe ser null. Gerente y Empleado siempre pertenecen a una sucursal.
 *
 * @returns lista de problemas; vacia significa que la combinacion es valida.
 */
export function validarRolYSucursal(
  rol: NombreRol,
  sucursalId: string | null,
): string[] {
  if (esAdmin(rol)) {
    return sucursalId === null
      ? []
      : ['un Admin no pertenece a una sucursal: sucursalId debe ser null'];
  }

  return sucursalId === null
    ? [`un ${rol} debe pertenecer a una sucursal: sucursalId es obligatorio`]
    : [];
}

/**
 * Un Gerente solo puede crear usuarios con rol Empleado, y el empleado nace
 * siempre en la sucursal del Gerente (se ignora la que envie el cliente).
 *
 * @returns el rol y la sucursal que deben persistirse.
 */
export function forzarRolYSucursalAlCrear(
  actor: { rol: string | null; sucursalId: string | null },
  rolSolicitado: NombreRol,
  sucursalSolicitada: string | null,
): { rol: NombreRol; sucursalId: string | null } {
  if (esGerente(actor.rol)) {
    return { rol: ROL_EMPLEADO, sucursalId: actor.sucursalId };
  }

  return { rol: rolSolicitado, sucursalId: sucursalSolicitada };
}

/**
 * true si el cambio pedido dejaría al sistema sin ningun Admin activo.
 * El unico Admin activo no puede ser bloqueado ni dejar de ser Admin.
 */
export function dejaSinAdminActivo(params: {
  objetivoEsAdminActivo: boolean;
  adminsActivosTotales: number;
  cambiaEstadoABloqueado: boolean;
  dejaDeSerAdmin: boolean;
}): boolean {
  if (!params.objetivoEsAdminActivo) {
    return false;
  }

  if (!params.cambiaEstadoABloqueado && !params.dejaDeSerAdmin) {
    return false;
  }

  return params.adminsActivosTotales <= 1;
}

/** Nadie puede cambiar su propio rol, estado ni permisos individuales. */
export function puedeModificarSuPropioRol(actorId: string, objetivoId: string): boolean {
  return actorId !== objetivoId;
}

export function puedeModificarSuPropioEstado(
  actorId: string,
  objetivoId: string,
): boolean {
  return actorId !== objetivoId;
}

export function puedeModificarSusPropiosPermisos(
  actorId: string,
  objetivoId: string,
): boolean {
  return actorId !== objetivoId;
}