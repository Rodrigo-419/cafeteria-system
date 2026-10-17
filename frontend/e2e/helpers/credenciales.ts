// Cuentas de verificación para las pruebas E2E.
//
// Las contraseñas NUNCA se escriben en el repositorio: se leen de variables de
// entorno definidas en la máquina de verificación
// (`VERIF_ADMIN_PASSWORD` para el Admin y `VERIF_DEMO_PASSWORD` para las
// cuentas demo). Si falta alguna, se falla con un mensaje claro en lugar de
// caer a un valor por defecto.
//
// Las cuentas demo se crean con `npm run db:seed:demo` en el backend. Sus
// nombres para mostrar se toman de la base de datos (ver docs/estrategia-de-pruebas.md).

export interface CuentaVerificacion {
  /** Nombre de usuario con el que se inicia sesión. */
  readonly usuario: string
  /** Nombre para mostrar tal como aparece en la UI. */
  readonly nombre: string
  /** Contraseña; se lee del entorno y no se registra nunca. */
  readonly clave: string
}

function requerida(nombreVariable: string): string {
  const valor = process.env[nombreVariable]
  if (valor === undefined || valor.length === 0) {
    throw new Error(
      `Falta la variable de entorno ${nombreVariable}. Define ` +
        'VERIF_ADMIN_PASSWORD y VERIF_DEMO_PASSWORD antes de ejecutar las ' +
        'pruebas E2E (variables de usuario en la máquina de verificación).',
    )
  }
  return valor
}

/** Contraseña del Admin (usuario `admin`). */
export function claveAdmin(): string {
  return requerida('VERIF_ADMIN_PASSWORD')
}

/** Contraseña compartida de las cuentas demo. */
export function claveDemo(): string {
  return requerida('VERIF_DEMO_PASSWORD')
}

export function cuentaAdmin(): CuentaVerificacion {
  return { usuario: 'admin', nombre: 'Administrador', clave: claveAdmin() }
}

export function cuentaGerenteCentro(): CuentaVerificacion {
  return {
    usuario: 'gerente.centro',
    nombre: 'Gerente Centro',
    clave: claveDemo(),
  }
}

export function cuentaEmpleadoCentro(): CuentaVerificacion {
  return {
    usuario: 'empleado.centro',
    nombre: 'Empleado Centro',
    clave: claveDemo(),
  }
}

export function cuentaGerenteNorte(): CuentaVerificacion {
  return {
    usuario: 'gerente.norte',
    nombre: 'Gerente Norte',
    clave: claveDemo(),
  }
}

export function cuentaEmpleadoNorte(): CuentaVerificacion {
  return {
    usuario: 'empleado.norte',
    nombre: 'Empleado Norte',
    clave: claveDemo(),
  }
}
