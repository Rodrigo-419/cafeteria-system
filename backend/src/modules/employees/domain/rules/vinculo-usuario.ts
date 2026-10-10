// Regla de dominio: vinculo entre un empleado y su usuario.
//
// Un empleado no es un usuario suelto: siempre se apoya en una cuenta. Para que
// el vinculo sea valido:
//   - el usuario debe tener rol Empleado o Gerente; un Admin es central y no
//     puede ser empleado de una sucursal;
//   - el usuario debe tener una sucursal asignada, porque el empleado hereda esa
//     sucursal y no puede existir sin ella;
//   - si el alta indica una sucursal, tiene que coincidir con la del usuario.
import {
  esAdmin,
  esEmpleado,
  esGerente,
  ROL_EMPLEADO,
  ROL_GERENTE,
} from '../../../users/domain/roles';

/** Roles de usuario que pueden sostenerse en un empleado. */
export const ROLES_VINCULABLES = [ROL_GERENTE, ROL_EMPLEADO] as const;

export type DatosVinculoEmpleado = {
  rolUsuario: string | null;
  sucursalUsuario: string | null;
  /** Sucursal pedida en el alta; si falta, se hereda la del usuario. */
  sucursalEmpleado?: string | null;
};

/**
 * Devuelve la lista de problemas del vinculo. Vacia significa que es valido.
 *
 * Es una funcion pura: no conoce HTTP. El caso de uso traduce la lista no vacia
 * a un 400 con sus mensajes.
 */
export function problemasVinculoEmpleado(
  datos: DatosVinculoEmpleado,
): string[] {
  const problemas: string[] = [];

  if (esAdmin(datos.rolUsuario)) {
    problemas.push('Un usuario con rol Admin no puede ser empleado');
  } else if (!esGerente(datos.rolUsuario) && !esEmpleado(datos.rolUsuario)) {
    problemas.push('El usuario debe tener rol Empleado o Gerente');
  }

  if (datos.sucursalUsuario === null || datos.sucursalUsuario === '') {
    problemas.push('El usuario debe tener una sucursal asignada');
  }

  if (
    datos.sucursalEmpleado !== undefined &&
    datos.sucursalEmpleado !== null &&
    datos.sucursalEmpleado !== datos.sucursalUsuario
  ) {
    problemas.push(
      'La sucursal del empleado debe coincidir con la del usuario',
    );
  }

  return problemas;
}
