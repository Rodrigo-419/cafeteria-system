// Regla de dominio: alcance de gestion sobre empleados.
//
// Un Admin gestiona a todos los empleados. Un Gerente solo gestiona los
// empleados cuyo usuario vinculado tiene rol Empleado y que pertenecen a su
// propia sucursal. Un empleado vinculado a un usuario con rol Gerente queda
// fuera del alcance de cualquier Gerente: solo lo alcanza un Admin.
//
// Cuando el objetivo queda fuera del alcance la API responde 404 y no 403, para
// no revelar que el empleado existe.
import { esAdmin, esGerente, ROL_EMPLEADO } from '../../../users/domain/roles';

/** Id centinela que no casa con ninguna sucursal real. */
export const SIN_ALCANCE_EMPLEADOS = '__sin_alcance_empleados__';

/**
 * Recorte minimo del actor. Incluye `permisosEfectivos` para que este actor sea
 * estructuralmente compatible con el `Actor` de users y se pueda reutilizar
 * `filtroAlcanceListado` al resolver el usuario vinculado.
 */
export type ActorEmpleados = {
  id: string;
  rol: string | null;
  sucursalId: string | null;
  permisosEfectivos: readonly string[];
};

/** Datos minimos del empleado objetivo necesarios para decidir el alcance. */
export type EmpleadoObjetivo = {
  sucursalId: string;
  usuarioRol: string | null;
};

/**
 * true si el actor puede ver y gestionar al empleado objetivo.
 *
 * Un Gerente nunca alcanza a un empleado vinculado a un usuario Gerente, aunque
 * compartan sucursal: el enunciado solo le da alcance sobre los Empleados.
 */
export function puedeGestionarEmpleado(
  actor: ActorEmpleados,
  objetivo: EmpleadoObjetivo,
): boolean {
  if (esAdmin(actor.rol)) {
    return true;
  }

  if (esGerente(actor.rol)) {
    return (
      objetivo.usuarioRol === ROL_EMPLEADO &&
      actor.sucursalId !== null &&
      objetivo.sucursalId === actor.sucursalId
    );
  }

  // Empleados (y cualquier rol no reconocido) no gestionan empleados.
  return false;
}

/** Filtro de alcance que se combina con los filtros del listado. */
export type AlcanceEmpleados = {
  sucursalId?: string;
  usuarioRol?: string;
};

/**
 * Filtro de alcance para listados: el Admin no filtra, el Gerente queda
 * limitado a los empleados con usuario Empleado de su sucursal. Un rol no
 * reconocido recibe un filtro imposible para que un listado sin filtro nunca le
 * entregue el padron entero.
 */
export function filtroAlcanceEmpleados(
  actor: ActorEmpleados,
): AlcanceEmpleados | undefined {
  if (esAdmin(actor.rol)) {
    return undefined;
  }

  if (esGerente(actor.rol) && actor.sucursalId !== null) {
    return { sucursalId: actor.sucursalId, usuarioRol: ROL_EMPLEADO };
  }

  return { sucursalId: SIN_ALCANCE_EMPLEADOS, usuarioRol: SIN_ALCANCE_EMPLEADOS };
}
