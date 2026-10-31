import type { CodigoPermiso } from '@/lib/permissions/permissions'

/**
 * Una subpágina de una entrada del menú. Se muestra en la subnavegación de la
 * cabecera de las pantallas del grupo (pestañas con enlace a una ruta real).
 */
export interface MenuSubItemConfig {
  label: string
  /** Ruta real. Puede llevar query string (p. ej. `/products?vista=carta`). */
  to: string
  permisos?: readonly CodigoPermiso[]
  modo?: 'all' | 'any'
  /**
   * `true` si la subpágina solo se muestra a usuarios con sucursal (Gerente y
   * Empleado). No es un permiso: es una condición de la cuenta.
   */
  requiereSucursal?: boolean
}

export interface MenuItemConfig {
  label: string
  /** Destino estático; si hay subpáginas se resuelve a la primera accesible. */
  to: string
  permisos?: readonly CodigoPermiso[]
  modo?: 'all' | 'any'
  /**
   * `true` si la entrada solo se muestra a usuarios con sucursal (Gerente y
   * Empleado). El Admin no la ve. No es un permiso: es una condición de la
   * cuenta. Se usa para rutas personales como "Mi horario".
   */
  requiereSucursal?: boolean
  /** Subpáginas que comparten una misma entrada de primer nivel. */
  subpaginas?: readonly MenuSubItemConfig[]
}

export interface MenuGrupoConfig {
  /** Sin título = entrada suelta (Inicio). */
  titulo?: string
  items: readonly MenuItemConfig[]
}

/** Entrada ya filtrada por permisos y con el destino resuelto. */
export interface MenuItemVisible extends MenuItemConfig {
  subpaginasVisibles: readonly MenuSubItemConfig[]
}

export interface MenuGrupoVisible {
  titulo?: string
  items: MenuItemVisible[]
}

const PERMISOS_PRODUCTOS = [
  'productos.ver',
  'productos.catalogo.editar',
  'productos.precio.editar',
] as const satisfies readonly CodigoPermiso[]

const PERMISOS_INVENTARIO_STOCK = [
  'inventario.registrar',
  'inventario.minimo.editar',
  'inventario.recuento',
  'insumos.ver',
] as const satisfies readonly CodigoPermiso[]

/**
 * Definición del menú lateral agrupado. Cada entrada declara los permisos que
 * la hacen visible; el menú se filtra siempre con los PERMISOS EFECTIVOS del
 * usuario (nunca con el rol). Un grupo sin entradas visibles no se muestra.
 *
 * Las entradas con `subpaginas` apuntan a la primera subpágina accesible y se
 * marcan como activas en cualquiera de ellas. Las subpáginas se muestran en la
 * subnavegación de la cabecera (solo las permitidas y solo si hay más de una).
 */
export const MENU_GRUPOS: readonly MenuGrupoConfig[] = [
  {
    items: [{ label: 'Inicio', to: '/' }],
  },
  {
    titulo: 'OPERACIÓN',
    items: [
      {
        label: 'Ventas',
        to: '/sales',
        modo: 'any',
        permisos: ['ventas.ver', 'ventas.registrar'],
      },
      {
        label: 'Inventario',
        to: '/inventory',
        subpaginas: [
          {
            label: 'Stock',
            to: '/inventory',
            modo: 'any',
            permisos: PERMISOS_INVENTARIO_STOCK,
          },
          {
            label: 'Insumos',
            to: '/supplies',
            modo: 'any',
            permisos: ['insumos.ver', 'insumos.catalogo.editar'],
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
          {
            label: 'Alertas',
            to: '/alerts',
            permisos: ['alertas.ver_resolver'],
          },
        ],
      },
      {
        label: 'Productos',
        to: '/products',
        subpaginas: [
          {
            label: 'Catálogo',
            to: '/products',
            modo: 'any',
            permisos: PERMISOS_PRODUCTOS,
          },
          {
            label: 'Carta por sucursal',
            to: '/products?vista=carta',
            modo: 'any',
            permisos: PERMISOS_PRODUCTOS,
          },
        ],
      },
      {
        label: 'Equipos',
        to: '/equipment',
        modo: 'any',
        permisos: ['equipo.ver', 'equipo.registrar_editar'],
      },
    ],
  },
  {
    titulo: 'PERSONAL',
    items: [
      {
        label: 'Empleados',
        to: '/employees',
        permisos: ['empleados.crear_editar'],
      },
      {
        label: 'Turnos',
        to: '/shifts',
        subpaginas: [
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
        ],
      },
      {
        label: 'Asistencia',
        to: '/attendance',
        modo: 'any',
        permisos: [
          'asistencia.ver',
          'asistencia.marcar',
          'asistencia.corregir',
        ],
      },
      {
        label: 'Mi horario',
        to: '/my/schedule',
        requiereSucursal: true,
      },
    ],
  },
  {
    titulo: 'ADMINISTRACIÓN',
    items: [
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
        label: 'Reportes',
        to: '/reports',
        permisos: ['reportes.comparativos.ver'],
      },
      {
        label: 'Auditoría',
        to: '/auditoria',
        permisos: ['usuarios.crear_editar'],
      },
    ],
  },
]

/**
 * Entradas de primer nivel (sin aplanar subpáginas). Se mantiene para el mapa
 * genérico de rutas de `App.tsx` y como fuente única de la estructura.
 */
export const MENU_ITEMS: readonly MenuItemConfig[] = MENU_GRUPOS.flatMap(
  (grupo) => grupo.items,
)

type EntradaMenu = MenuItemConfig | MenuSubItemConfig

/**
 * `true` si el usuario (por sus permisos efectivos y su sucursal) puede ver la
 * entrada. Una entrada con subpáginas es visible si al menos una subpágina lo
 * es; así no aparece un grupo vacío.
 */
export function puedeVerItem(
  item: EntradaMenu,
  permisos: readonly string[],
  sucursalId?: string | null,
): boolean {
  if ('subpaginas' in item && item.subpaginas && item.subpaginas.length > 0) {
    return item.subpaginas.some((subpagina) =>
      puedeVerItem(subpagina, permisos, sucursalId),
    )
  }
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

/** Subpáginas visibles de una entrada, en el orden definido. */
export function subpaginasVisibles(
  item: MenuItemConfig,
  permisos: readonly string[],
  sucursalId?: string | null,
): MenuSubItemConfig[] {
  return (item.subpaginas ?? []).filter((subpagina) =>
    puedeVerItem(subpagina, permisos, sucursalId),
  )
}

/**
 * Destino de una entrada: la primera subpágina accesible o, si no tiene
 * subpáginas, su propia ruta.
 */
export function resolverDestino(
  item: MenuItemConfig,
  permisos: readonly string[],
  sucursalId?: string | null,
): string {
  const visibles = subpaginasVisibles(item, permisos, sucursalId)
  return visibles[0]?.to ?? item.to
}

function resolverItem(
  item: MenuItemConfig,
  permisos: readonly string[],
  sucursalId?: string | null,
): MenuItemVisible {
  const visibles = subpaginasVisibles(item, permisos, sucursalId)
  return {
    ...item,
    to: visibles[0]?.to ?? item.to,
    subpaginasVisibles: visibles,
  }
}

/** Filtra las entradas de primer nivel visibles (destino ya resuelto). */
export function filtrarMenu(
  permisos: readonly string[],
  sucursalId?: string | null,
): MenuItemVisible[] {
  return MENU_ITEMS.filter((item) =>
    puedeVerItem(item, permisos, sucursalId),
  ).map((item) => resolverItem(item, permisos, sucursalId))
}

/**
 * Menú agrupado y filtrado por permisos. Los grupos sin ninguna entrada
 * visible se omiten (nunca se pinta un título vacío).
 */
export function filtrarMenuAgrupado(
  permisos: readonly string[],
  sucursalId?: string | null,
): MenuGrupoVisible[] {
  return MENU_GRUPOS.map((grupo) => ({
    titulo: grupo.titulo,
    items: grupo.items
      .filter((item) => puedeVerItem(item, permisos, sucursalId))
      .map((item) => resolverItem(item, permisos, sucursalId)),
  })).filter((grupo) => grupo.items.length > 0)
}

/** Ruta sin query string, para comparar con `location.pathname`. */
export function rutaBase(ruta: string): string {
  return ruta.split('?')[0] ?? ruta
}

/** `true` si `ruta` (con o sin query) corresponde a la ruta actual. */
export function subpaginaEstaActiva(
  subpagina: MenuSubItemConfig,
  pathname: string,
  search = '',
): boolean {
  const base = rutaBase(subpagina.to)
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return false
  const query = subpagina.to.split('?')[1]
  if (!query) return true
  const esperado = new URLSearchParams(query)
  const actual = new URLSearchParams(search)
  return [...esperado].every(([clave, valor]) => actual.get(clave) === valor)
}

/** `true` si la entrada (o cualquiera de sus subpáginas) está activa. */
export function itemEstaActivo(
  item: MenuItemVisible,
  pathname: string,
): boolean {
  const rutas =
    item.subpaginasVisibles.length > 0
      ? item.subpaginasVisibles.map((subpagina) => subpagina.to)
      : [item.to]
  return rutas.some((ruta) => {
    const base = rutaBase(ruta)
    return pathname === base || pathname.startsWith(`${base}/`)
  })
}

/**
 * Grupo y entrada a los que pertenece la ruta actual. Se usa para pintar la
 * subnavegación de la cabecera sin duplicar la definición del menú.
 */
export function grupoDeRuta(
  permisos: readonly string[],
  pathname: string,
  sucursalId?: string | null,
): { grupo: MenuGrupoVisible; item: MenuItemVisible } | null {
  for (const grupo of filtrarMenuAgrupado(permisos, sucursalId)) {
    for (const item of grupo.items) {
      if (item.subpaginasVisibles.length > 0 && itemEstaActivo(item, pathname)) {
        return { grupo, item }
      }
    }
  }
  return null
}

/**
 * Todas las rutas que el menú puede representar (subpáginas incluidas). Se usa
 * para resolver `puedeAccederRuta` sin duplicar reglas de permisos.
 */
const RUTAS_MENU: readonly MenuSubItemConfig[] = MENU_ITEMS.flatMap((item) =>
  item.subpaginas && item.subpaginas.length > 0 ? [...item.subpaginas] : [item],
)

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
  const pathname = rutaBase(ruta)
  // Varias entradas pueden casar por prefijo (p. ej. `/inventory` y
  // `/inventory/recuentos`); se toma la más específica (el `to` más largo) para
  // no denegar una sub-ruta por quedarse con la entrada padre.
  const coincidencias = RUTAS_MENU.filter((config) => {
    const base = rutaBase(config.to)
    return pathname === base || pathname.startsWith(`${base}/`)
  })
  if (coincidencias.length === 0) return false
  const item = coincidencias.reduce((a, b) =>
    rutaBase(b.to).length > rutaBase(a.to).length ? b : a,
  )
  return puedeVerItem(item, permisos, sucursalId)
}

/**
 * Ruta de inicio derivada de los PERMISOS EFECTIVOS (nunca del rol). Si el
 * usuario pidió una ruta concreta (`solicitada`, p. ej. al ser redirigido a
 * iniciar sesión) y puede verla, se respeta; en cualquier otro caso se devuelve
 * el panel (`/`), que es la ruta de inicio por defecto.
 *
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
