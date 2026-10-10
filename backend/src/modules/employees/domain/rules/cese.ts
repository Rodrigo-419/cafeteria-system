// Regla de dominio: cese de un empleado.
//
// Cesas es dar de baja, no borrar: el empleado conserva todo su historico y
// deja de poder marcar. La cuenta de usuario vinculada se bloquea en la misma
// operacion.
//
// Son funciones puras: reciben fechas ya resueltas y no dependen del reloj del
// sistema.

/** true si el empleado ya esta de baja. */
export function empleadoYaCesado(estado: string): boolean {
  return estado === 'inactivo';
}

/**
 * Comprueba que la fecha de cese no sea anterior a la de contratacion.
 *
 * La base tambien lo garantiza con `chk_empleado_cese_posterior_a_contratacion`,
 * pero validarlo antes permite responder 400 con un mensaje util en lugar de
 * dejar subir un error de integridad.
 */
export function problemasFechaCese(
  fechaContratacion: Date,
  fechaCese: Date,
): string[] {
  if (fechaCese.getTime() < fechaContratacion.getTime()) {
    return ['La fecha de cese no puede ser anterior a la de contratacion'];
  }

  return [];
}
