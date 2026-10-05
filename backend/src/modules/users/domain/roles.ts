// Nombres de rol tipados. Los valores coinciden con `rol.nombre` en la tabla
// `rol` y con lo que carga la estrategia JWT en `request.user.rol`.

export const ROL_ADMIN = 'Admin';
export const ROL_GERENTE = 'Gerente';
export const ROL_EMPLEADO = 'Empleado';

/** Todos los roles validos, en el orden jerarquico Admin > Gerente > Empleado. */
export const NOMBRES_ROL = [ROL_ADMIN, ROL_GERENTE, ROL_EMPLEADO] as const;

export type NombreRol = (typeof NOMBRES_ROL)[number];

export function esNombreRol(valor: string): valor is NombreRol {
  return (NOMBRES_ROL as readonly string[]).includes(valor);
}

export function esAdmin(rol: string | null | undefined): boolean {
  return rol === ROL_ADMIN;
}

export function esGerente(rol: string | null | undefined): boolean {
  return rol === ROL_GERENTE;
}

export function esEmpleado(rol: string | null | undefined): boolean {
  return rol === ROL_EMPLEADO;
}