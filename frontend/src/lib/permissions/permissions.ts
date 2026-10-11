// Codigos de permiso del sistema (los 24 definidos en el seed del backend).
//
// El frontend decide que mostrar a partir de los PERMISOS EFECTIVOS que envia
// la API (`user.permisos`), nunca a partir del rol: el rol es solo una etiqueta
// y los permisos pueden concederse o revocarse de forma individual.
export const PERMISOS = [
  'sucursales.crear_editar',
  'sucursales.ver',
  'usuarios.crear_editar',
  'permisos.asignar',
  'productos.catalogo.editar',
  'productos.precio.editar',
  'productos.ver',
  'insumos.catalogo.editar',
  'insumos.ver',
  'inventario.registrar',
  'inventario.minimo.editar',
  'inventario.recuento',
  'alertas.ver_resolver',
  'ventas.registrar',
  'ventas.anular',
  'ventas.ver',
  'reportes.comparativos.ver',
  'empleados.crear_editar',
  'turnos.editar',
  'asistencia.marcar',
  'asistencia.corregir',
  'asistencia.ver',
  'equipo.registrar_editar',
  'equipo.ver',
] as const

export type CodigoPermiso = (typeof PERMISOS)[number]

/** `true` si el usuario tiene el permiso indicado. */
export function tienePermiso(
  permisos: readonly string[],
  codigo: CodigoPermiso,
): boolean {
  return permisos.includes(codigo)
}

/** `true` si el usuario tiene TODOS los permisos indicados. */
export function tieneTodos(
  permisos: readonly string[],
  codigos: readonly CodigoPermiso[],
): boolean {
  return codigos.every((codigo) => permisos.includes(codigo))
}

/** `true` si el usuario tiene AL MENOS UNO de los permisos indicados. */
export function tieneAlguno(
  permisos: readonly string[],
  codigos: readonly CodigoPermiso[],
): boolean {
  return codigos.some((codigo) => permisos.includes(codigo))
}
