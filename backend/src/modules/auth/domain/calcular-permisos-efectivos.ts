// Calculo de los permisos efectivos de un usuario: rol + conceded - revocado.

/** Tipo de una asignacion individual de permiso a un usuario. */
export type TipoPermisoIndividual = 'concedido' | 'revocado';

/** Permiso individual tal y como viene de la tabla usuario_permiso. */
export type PermisoIndividual = {
  codigo: string;
  tipo: TipoPermisoIndividual;
};

/**
 * Calcula los permisos efectivos de un usuario.
 *
 * Regla: permisos de su rol, mas los concedidos individualmente, menos los
 * revocados individualmente. Una revocacion siempre gana, incluso si el
 * permiso viene del rol.
 *
 * @param rolPermisos codigos de permiso del rol del usuario.
 * @param permisosIndividuales asignaciones de usuario_permiso.
 * @returns codigos de permiso efectivos, sin duplicados y ordenados, para que
 *          la respuesta sea estable y comparable.
 */
export function calcularPermisosEfectivos(
  rolPermisos: readonly string[],
  permisosIndividuales: readonly PermisoIndividual[],
): string[] {
  const efectivos = new Set<string>(rolPermisos);

  for (const permiso of permisosIndividuales) {
    if (permiso.tipo === 'concedido') {
      efectivos.add(permiso.codigo);
    } else {
      efectivos.delete(permiso.codigo);
    }
  }

  return [...efectivos].sort();
}