// Catálogo de conjuntos exportables.
//
// AUTORIDAD: `backend/src/modules/exports/application/catalogo.ts` (y su apoyo
// en `backend/src/modules/exports/domain/limites.ts`). Este módulo replica solo
// lo que la interfaz necesita para pintar nombres, agrupar por área, decidir si
// un conjunto exige rango y comprobar el permiso de lectura.
//
// Si en el backend cambia un conjunto, su etiqueta, su permiso de lectura o si
// pasa a exigir rango, hay que sincronizar este archivo. La interfaz nunca
// inventa conjuntos ni escribe topes de filas: esos valores son del servidor.
import type { CodigoPermiso } from '@/lib/permissions/permissions'

export type ClaveConjuntoExport =
  | 'ventas'
  | 'carta'
  | 'stock'
  | 'movimientos'
  | 'empleados'
  | 'turnos'
  | 'asignaciones'
  | 'asistencia'
  | 'faltas'
  | 'equipos'
  | 'usuarios'
  | 'sucursales'
  | 'reporte'
  | 'auditoria'

export type AreaExport =
  | 'ventas'
  | 'inventario'
  | 'personal'
  | 'asistencia'
  | 'sistema'

export interface DefinicionConjuntoExport {
  clave: ClaveConjuntoExport
  etiqueta: string
  descripcion: string
  /** Permiso de lectura que exige el conjunto (además de `usuarios.crear_editar`). */
  permisoLectura: CodigoPermiso
  /** `true` si el backend exige `filtros.desde` y `filtros.hasta`. */
  exigeRango: boolean
  area: AreaExport
}

export interface AreaExportacion {
  clave: AreaExport
  etiqueta: string
}

/** Orden de las áreas en la pantalla de exportaciones. */
export const AREAS_EXPORTACION: readonly AreaExportacion[] = [
  { clave: 'ventas', etiqueta: 'Ventas y precios' },
  { clave: 'inventario', etiqueta: 'Inventario' },
  { clave: 'personal', etiqueta: 'Personal y turnos' },
  { clave: 'asistencia', etiqueta: 'Asistencia' },
  { clave: 'sistema', etiqueta: 'Sistema y reportes' },
]

/**
 * Los 14 conjuntos, en el mismo orden que `CONJUNTOS` del backend.
 *
 * `exigeRango` replica `exigeRango()` de `domain/limites.ts`: solo ventas,
 * movimientos, asistencia, faltas y reporte. Los demás no admiten filtros.
 */
export const CONJUNTOS_EXPORTACION: readonly DefinicionConjuntoExport[] = [
  {
    clave: 'ventas',
    etiqueta: 'Ventas',
    descripcion: 'Ventas del rango con vendedor, método, estado y total.',
    permisoLectura: 'ventas.ver',
    exigeRango: true,
    area: 'ventas',
  },
  {
    clave: 'carta',
    etiqueta: 'Carta y precios',
    descripcion: 'Ofertas de la carta con producto, variante, precio y estado.',
    permisoLectura: 'productos.ver',
    exigeRango: false,
    area: 'ventas',
  },
  {
    clave: 'stock',
    etiqueta: 'Stock',
    descripcion: 'Stock actual y mínimo de cada insumo por sucursal.',
    permisoLectura: 'insumos.ver',
    exigeRango: false,
    area: 'inventario',
  },
  {
    clave: 'movimientos',
    etiqueta: 'Movimientos de inventario',
    descripcion: 'Entradas y ajustes de inventario del rango.',
    permisoLectura: 'inventario.registrar',
    exigeRango: true,
    area: 'inventario',
  },
  {
    clave: 'empleados',
    etiqueta: 'Empleados',
    descripcion: 'Personal con usuario, cargo, sucursal y estado.',
    permisoLectura: 'empleados.crear_editar',
    exigeRango: false,
    area: 'personal',
  },
  {
    clave: 'turnos',
    etiqueta: 'Turnos',
    descripcion: 'Turnos fijos y variables con horario y días.',
    permisoLectura: 'turnos.editar',
    exigeRango: false,
    area: 'personal',
  },
  {
    clave: 'asignaciones',
    etiqueta: 'Asignaciones de turnos',
    descripcion: 'Turnos asignados a cada colaborador y su vigencia.',
    permisoLectura: 'turnos.editar',
    exigeRango: false,
    area: 'personal',
  },
  {
    clave: 'asistencia',
    etiqueta: 'Asistencia',
    descripcion: 'Marcaciones del rango con tipo, estado y corrección.',
    permisoLectura: 'asistencia.ver',
    exigeRango: true,
    area: 'asistencia',
  },
  {
    clave: 'faltas',
    etiqueta: 'Faltas',
    descripcion: 'Faltas del rango con empleado, sucursal y días de turno.',
    permisoLectura: 'asistencia.ver',
    exigeRango: true,
    area: 'asistencia',
  },
  {
    clave: 'equipos',
    etiqueta: 'Equipos',
    descripcion: 'Equipos por sucursal con tipo, estado y observaciones.',
    permisoLectura: 'equipo.ver',
    exigeRango: false,
    area: 'sistema',
  },
  {
    clave: 'usuarios',
    etiqueta: 'Usuarios',
    descripcion: 'Cuentas con rol, sucursal y estado.',
    permisoLectura: 'usuarios.crear_editar',
    exigeRango: false,
    area: 'sistema',
  },
  {
    clave: 'sucursales',
    etiqueta: 'Sucursales',
    descripcion: 'Sucursales con dirección y teléfono.',
    permisoLectura: 'sucursales.ver',
    exigeRango: false,
    area: 'sistema',
  },
  {
    clave: 'reporte',
    etiqueta: 'Reporte comparativo',
    descripcion: 'Comparativo por sucursal del rango: ventas, inventario y faltas.',
    permisoLectura: 'reportes.comparativos.ver',
    exigeRango: true,
    area: 'sistema',
  },
  {
    clave: 'auditoria',
    etiqueta: 'Auditoría',
    descripcion: 'Eventos de auditoría con acción, entidad y autor.',
    permisoLectura: 'usuarios.crear_editar',
    exigeRango: false,
    area: 'sistema',
  },
]

/** `true` si el usuario puede exportar ese conjunto (acción + lectura). */
export function puedeExportarConjunto(
  permisos: readonly string[],
  definicion: DefinicionConjuntoExport,
): boolean {
  return (
    permisos.includes('usuarios.crear_editar') &&
    permisos.includes(definicion.permisoLectura)
  )
}

/** Conjuntos visibles para el usuario, en el orden del catálogo. */
export function conjuntosVisibles(
  permisos: readonly string[],
): DefinicionConjuntoExport[] {
  return CONJUNTOS_EXPORTACION.filter((definicion) =>
    puedeExportarConjunto(permisos, definicion),
  )
}

/** Conjuntos visibles agrupados por área (solo áreas con contenido). */
export function conjuntosPorArea(
  permisos: readonly string[],
): Array<{ area: AreaExportacion; conjuntos: DefinicionConjuntoExport[] }> {
  const visibles = conjuntosVisibles(permisos)
  return AREAS_EXPORTACION.map((area) => ({
    area,
    conjuntos: visibles.filter((definicion) => definicion.area === area.clave),
  })).filter((grupo) => grupo.conjuntos.length > 0)
}

/** Definición por clave; `null` si la clave no pertenece al catálogo. */
export function definicionDeConjunto(
  clave: string | null | undefined,
): DefinicionConjuntoExport | null {
  if (!clave) return null
  return (
    CONJUNTOS_EXPORTACION.find((definicion) => definicion.clave === clave) ??
    null
  )
}
