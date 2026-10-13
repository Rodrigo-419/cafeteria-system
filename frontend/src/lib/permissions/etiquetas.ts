// Etiquetas centrales de permisos para toda la interfaz.
//
// Viven aquí, y no repartidas por los componentes, para que cualquier pantalla
// use el mismo nombre legible. El código técnico (`ventas.ver`) nunca se muestra
// al usuario: las pantallas usan la descripción que envía la API y estas áreas.
import type { OrigenPermiso } from '@/types/api'

/** Nombre legible del origen de un permiso efectivo. */
export const ETIQUETA_ORIGEN_PERMISO: Record<OrigenPermiso, string> = {
  rol: 'Del rol',
  concedido: 'Concedido',
  revocado: 'Revocado',
}

/** Área legible de cada prefijo de permiso (`ventas.ver` → prefijo `ventas`). */
export const AREA_PERMISO: Record<string, string> = {
  sucursales: 'Sucursales',
  usuarios: 'Usuarios',
  permisos: 'Permisos',
  productos: 'Productos',
  insumos: 'Insumos',
  inventario: 'Inventario',
  alertas: 'Alertas',
  ventas: 'Ventas',
  reportes: 'Reportes',
  empleados: 'Empleados',
  turnos: 'Turnos',
  asistencia: 'Asistencia',
  equipo: 'Equipos',
}

/** Área legible de un código de permiso, con respaldo al propio prefijo. */
export function areaDePermiso(codigo: string): string {
  const prefijo = codigo.split('.')[0] ?? codigo
  return AREA_PERMISO[prefijo] ?? prefijo
}
