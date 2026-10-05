// Regla de dominio: permisos individuales.
//
// Quien asigna debe poseer el permiso que otorga. Para un objetivo Empleado
// solo se pueden CONCEDER cuatro permisos concretos; la REVOCACION puede
// aplicarse a cualquier permiso que el rol del objetivo tenga por defecto.

// Un Gerente solo asigna permisos a Empleados de su sucursal; para cualquier
// otro objetivo solo el Admin. Eso lo resuelve `puedeGestionarUsuario`.

import { ROL_EMPLEADO } from '../roles';

/** Unico conjunto de permisos que se pueden conceder a un Empleado. */
export const PERMISOS_CONCEDIBLES_A_EMPLEADO = [
  'insumos.ver',
  'inventario.registrar',
  'ventas.registrar',
  'equipo.ver',
] as const;

export type TipoPermisoIndividual = 'concedido' | 'revocado';

/**
 * @returns lista de problemas; vacia significa que la asignacion es valida.
 */
export function validarAsignacionPermiso(params: {
  /** Codigos que el actor posee de forma efectiva. */
  permisosDelActor: readonly string[];
  /** Codigo del permiso que se quiere asignar. */
  codigoPermiso: string;
  tipo: TipoPermisoIndividual;
  /** Rol del usuario objetivo. */
  rolObjetivo: string | null;
  /** Permisos que el rol del objetivo tiene por defecto. */
  permisosPorDefectoDelObjetivo: readonly string[];
}): string[] {
  const problemas: string[] = [];

  const poseeElPermiso =
    params.permisosDelActor.includes(params.codigoPermiso);
  if (!poseeElPermiso) {
    problemas.push(
      `no puedes asignar "${params.codigoPermiso}": no lo tienes entre tus permisos efectivos`,
    );
  }

  if (params.tipo === 'concedido') {
    if (
      params.rolObjetivo === ROL_EMPLEADO &&
      !(PERMISOS_CONCEDIBLES_A_EMPLEADO as readonly string[]).includes(
        params.codigoPermiso,
      )
    ) {
      problemas.push(
        `a un Empleado solo se les pueden conceder: ${PERMISOS_CONCEDIBLES_A_EMPLEADO.join(', ')}`,
      );
    }
  }

  if (params.tipo === 'revocado') {
    if (!params.permisosPorDefectoDelObjetivo.includes(params.codigoPermiso)) {
      problemas.push(
        `no puedes revocar "${params.codigoPermiso}": el rol del usuario no lo tiene por defecto`,
      );
    }
  }

  return problemas;
}