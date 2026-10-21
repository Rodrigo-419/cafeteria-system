import type { CodigoPermiso } from '@/lib/permissions/permissions'

export interface MenuItemConfig {
  label: string
  to: string
  permisos?: readonly CodigoPermiso[]
  modo?: 'all' | 'any'
  /**
   * `true` si la entrada solo se muestra a usuarios con sucursal (Gerente y
   * Empleado). El Admin no la ve. No es un permiso: es una condición de la
   * cuenta. Se usa para rutas personales como "Mi horario".
   */
  requiereSucursal?: boolean
}

/**
 * Definicion del menu lateral. Cada entrada declara los permisos que la hacen
 * visible; el menu se filtra siempre con los PERMISOS EFECTIVOS del usuario
 * (nunca con el rol). `modo: 'any'` muestra la entrada si se cumple al menos
 * uno de los permisos listados.
 */
export const MENU_ITEMS: readonly MenuItemConfig[] = [
  { label: 'Inicio', to: '/' },
  {
    label: 'Sucursales',
    to: '/branches',
    modo: 'any',
    permisos: ['sucursales.ver', 'sucursales.crear_editar'],
  },
  {
    label: 'Usuarios',
    to: '/users',
    modo: 'any',
    permisos: ['usuarios.crear_editar', 'permisos.asignar'],
  },
  {
    label: 'Auditoría',
    to: '/auditoria',
    permisos: ['usuarios.crear_editar'],
  },
  {
    label: 'Productos',
    to: '/products',
    modo: 'any',
    permisos: [
      'productos.ver',
      'productos.catalogo.editar',
      'productos.precio.editar',
    ],
  },
  {
    label: 'Insumos',
    to: '/supplies',
    modo: 'any',
    permisos: ['insumos.ver', 'insumos.catalogo.editar'],
  },
  {
    label: 'Inventario',
    to: '/inventory',
    modo: 'any',
    permisos: [
      'inventario.registrar',
      'inventario.minimo.editar',
      'inventario.recuento',
      'insumos.ver',
    ],
  },
  {
    label: 'Recuentos',
    to: '/inventory/recuentos',
    permisos: ['inventario.recuento'],
  },
  {
    label: 'Movimientos',
    to: '/inventory/movimientos',
    permisos: ['inventario.registrar'],
  },
  { label: 'Alertas', to: '/alerts', permisos: ['alertas.ver_resolver'] },
  {
    label: 'Ventas',
    to: '/sales',
    modo: 'any',
    permisos: ['ventas.ver', 'ventas.registrar'],
  },
  {
    label: 'Reportes',
    to: '/reports',
    permisos: ['reportes.comparativos.ver'],
  },
  {
    label: 'Empleados',
    to: '/employees',
    permisos: ['empleados.crear_editar'],
  },
  { label: 'Turnos', to: '/shifts', permisos: ['turnos.editar'] },
  {
    label: 'Asignaciones',
    to: '/shifts/asignaciones',
    permisos: ['turnos.editar'],
  },
  {
    label: 'Calendario de turnos',
    to: '/shifts/calendario',
    permisos: ['turnos.editar'],
  },
  {
    label: 'Calendario por horas',
    to: '/shifts/calendario-horas',
    permisos: ['turnos.editar'],
  },
  {
    label: 'Asistencia',
    to: '/attendance',
    modo: 'any',
    permisos: ['asistencia.ver', 'asistencia.marcar', 'asistencia.corregir'],
  },
  {
    label: 'Equipos',
    to: '/equipment',
    modo: 'any',
    permisos: ['equipo.ver', 'equipo.registrar_editar'],
  },
  {
    label: 'Mi horario',
    to: '/my/schedule',
    requiereSucursal: true,
  },
]

/**
 * `true` si el usuario (por sus permisos efectivos y su sucursal) puede ver la
 * entrada. Una entrada con `requiereSucursal` solo se muestra a usuarios con
 * sucursal (Gerente/Empleado); el Admin no la ve.
 */
export function puedeVerItem(
  item: MenuItemConfig,
  permisos: readonly string[],
  sucursalId?: string | null,
): boolean {
  if (item.requiereSucursal && !sucursalId) {
    return false
  }
  if (!item.permisos || item.permisos.length === 0) {
    return true
  }
  if (item.modo === 'any') {
    return item.permisos.some((p) => permisos.includes(p))
  }
  return item.permisos.every((p) => permisos.includes(p))
}

/** Filtra el menu segun los permisos efectivos y la sucursal del usuario. */
export function filtrarMenu(
  permisos: readonly string[],
  sucursalId?: string | null,
): MenuItemConfig[] {
  return MENU_ITEMS.filter((item) => puedeVerItem(item, permisos, sucursalId))
}

/**
 * `true` si el usuario (por sus PERMISOS EFECTIVOS y su sucursal) puede abrir
 * `ruta`. Se apoya en la misma definición del menú lateral para no duplicar
 * reglas; el panel (`/`) siempre está permitido para cualquier usuario
 * autenticado y una ruta desconocida (fuera del menú) se considera no permitida.
 */
export function puedeAccederRuta(
  permisos: readonly string[],
  ruta: string | null | undefined,
  sucursalId?: string | null,
): boolean {
  if (!ruta || ruta === '/') return true
  // Varias entradas pueden casar por prefijo (p. ej. `/inventory` y
  // `/inventory/recuentos`); se toma la más específica (el `to` más largo) para
  // no denegar una sub-ruta por quedarse con la entrada padre.
  const coincidencias = MENU_ITEMS.filter(
    (config) =>
      config.to !== '/' &&
      (ruta === config.to || ruta.startsWith(`${config.to}/`)),
  )
  if (coincidencias.length === 0) return false
  const item = coincidencias.reduce((a, b) => (b.to.length > a.to.length ? b : a))
  return puedeVerItem(item, permisos, sucursalId)
}

/**
 * Ruta de inicio derivada de los PERMISOS EFECTIVOS (nunca del rol). Si el
 * usuario pidió una ruta concreta (`solicitada`, p. ej. al ser redirigido a
 * iniciar sesión) y puede verla, se respeta; en cualquier otro caso se devuelve
 * el panel (`/`), que es la ruta de inicio por defecto.
 *
 * NOTA: "Mi horario" no es una ruta de inicio — el aterrizaje sigue siendo el
 * dashboard (`/`). Esta función solo decide a dónde ir tras iniciar sesión.
 */
export function rutaInicio(
  permisos: readonly string[],
  solicitada?: string | null,
  sucursalId?: string | null,
): string {
  if (solicitada && puedeAccederRuta(permisos, solicitada, sucursalId)) {
    return solicitada
  }
  return '/'
}
