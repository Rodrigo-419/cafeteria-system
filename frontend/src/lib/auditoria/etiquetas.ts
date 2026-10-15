// Etiquetas en español de auditoría: el ÚNICO mapa del frontend.
//
// El backend envía claves crudas (`accion: 'usuario_rol_cambiado'`,
// `entidad: 'insumo_sucursal'`, `detalle.rol`) porque son códigos de dominio,
// no textos para mostrar. Aquí viven todas las traducciones agrupadas por área
// de negocio. Los mapas se leen con acceso por índice sobre `string` a propósito:
// el backend puede añadir valores nuevos sin que el frontend rompa, y en ese caso
// se muestra una etiqueta genérica en lugar de la clave técnica.
//
// También vive aquí el resumen legible del `detalle` (`{ antes?, despues? }`):
// "Rol: Empleado → Gerente", "Precio: S/ 10.00 → S/ 12.50", nunca JSON crudo.
import { aCentimos, formatearMoneda } from '@/lib/format/money'
import type { AccionAuditoria, DetalleAuditoriaApi } from '@/types/api'

// --------------------------------------------------------------- áreas

/** Claves de área de negocio usadas para agrupar entidades y acciones. */
export type AreaAuditoria =
  | 'personas'
  | 'permisos'
  | 'sucursales'
  | 'catalogo'
  | 'inventario'
  | 'turnos'
  | 'equipos'

export const ETIQUETA_AREA: Record<AreaAuditoria, string> = {
  personas: 'Personas',
  permisos: 'Permisos',
  sucursales: 'Sucursales',
  catalogo: 'Catálogo',
  inventario: 'Inventario',
  turnos: 'Turnos',
  equipos: 'Equipos',
}

/** Orden en que se presentan las áreas en los controles de filtro. */
export const AREAS_AUDITORIA: AreaAuditoria[] = [
  'personas',
  'permisos',
  'sucursales',
  'catalogo',
  'inventario',
  'turnos',
  'equipos',
]

// ------------------------------------------------------------- entidades

/** Orden de presentación de las entidades en el filtro. */
export const ENTIDADES_AUDITORIA = [
  'usuario',
  'empleado',
  'sucursal',
  'categoria',
  'variante',
  'producto',
  'oferta',
  'insumo',
  'insumo_sucursal',
  'turno',
  'asignacion',
  'equipo',
] as const

export const ETIQUETA_ENTIDAD: Record<string, string> = {
  usuario: 'Usuario',
  empleado: 'Empleado',
  sucursal: 'Sucursal',
  categoria: 'Categoría',
  variante: 'Variante',
  producto: 'Producto',
  oferta: 'Oferta',
  insumo: 'Insumo',
  insumo_sucursal: 'Insumo de sucursal',
  turno: 'Turno',
  asignacion: 'Asignación',
  equipo: 'Equipo',
}

export const AREA_ENTIDAD: Record<string, AreaAuditoria> = {
  usuario: 'personas',
  empleado: 'personas',
  sucursal: 'sucursales',
  categoria: 'catalogo',
  variante: 'catalogo',
  producto: 'catalogo',
  oferta: 'catalogo',
  insumo: 'inventario',
  insumo_sucursal: 'inventario',
  turno: 'turnos',
  asignacion: 'turnos',
  equipo: 'equipos',
}

// --------------------------------------------------------------- acciones

/**
 * Orden de presentación de las acciones en el filtro. Agrupadas por área para
 * que el desplegable sea navegable con 44 entradas.
 */
export const ACCIONES_POR_AREA: {
  area: AreaAuditoria
  acciones: readonly AccionAuditoria[]
}[] = [
  {
    area: 'personas',
    acciones: [
      'usuario_creado',
      'usuario_editado',
      'usuario_rol_cambiado',
      'usuario_sucursal_cambiada',
      'usuario_bloqueado',
      'usuario_activado',
      'usuario_password_restablecida',
      'usuario_password_cambiada',
      'empleado_creado',
      'empleado_editado',
      'empleado_cesado',
      'empleado_pin_regenerado',
    ],
  },
  {
    area: 'permisos',
    acciones: [
      'permiso_concedido',
      'permiso_revocado',
      'permiso_restablecido',
    ],
  },
  {
    area: 'sucursales',
    acciones: ['sucursal_creada', 'sucursal_editada'],
  },
  {
    area: 'catalogo',
    acciones: [
      'categoria_creada',
      'categoria_editada',
      'categoria_eliminada',
      'variante_creada',
      'variante_editada',
      'variante_eliminada',
      'producto_creado',
      'producto_editado',
      'producto_eliminado',
      'oferta_creada',
      'oferta_precio_fijado',
      'oferta_activada',
      'oferta_desactivada',
    ],
  },
  {
    area: 'inventario',
    acciones: [
      'insumo_creado',
      'insumo_editado',
      'insumo_eliminado',
      'insumo_sucursal_creado',
      'insumo_sucursal_stock_minimo_cambiado',
      'insumo_sucursal_activado',
      'insumo_sucursal_descontinuado',
    ],
  },
  {
    area: 'turnos',
    acciones: [
      'turno_creado',
      'turno_editado',
      'asignacion_creada',
      'asignacion_retirada',
    ],
  },
  {
    area: 'equipos',
    acciones: [
      'equipo_creado',
      'equipo_editado',
      'equipo_estado_cambiado',
    ],
  },
] as const

/** Las 44 acciones del enum `auditoria_accion`, en el orden de su área. */
export const ACCIONES_AUDITORIA: AccionAuditoria[] = ACCIONES_POR_AREA.flatMap(
  (grupo) => [...grupo.acciones],
)

export const ETIQUETA_ACCION: Record<string, string> = {
  usuario_creado: 'Usuario creado',
  usuario_editado: 'Usuario editado',
  usuario_rol_cambiado: 'Rol de usuario cambiado',
  usuario_sucursal_cambiada: 'Sucursal de usuario cambiada',
  usuario_bloqueado: 'Usuario bloqueado',
  usuario_activado: 'Usuario activado',
  usuario_password_restablecida: 'Contraseña de usuario restablecida',
  usuario_password_cambiada: 'Contraseña de usuario cambiada',
  permiso_concedido: 'Permiso concedido',
  permiso_revocado: 'Permiso revocado',
  permiso_restablecido: 'Permiso restablecido',
  empleado_creado: 'Empleado creado',
  empleado_editado: 'Empleado editado',
  empleado_cesado: 'Empleado cesado',
  empleado_pin_regenerado: 'PIN de empleado regenerado',
  sucursal_creada: 'Sucursal creada',
  sucursal_editada: 'Sucursal editada',
  categoria_creada: 'Categoría creada',
  categoria_editada: 'Categoría editada',
  categoria_eliminada: 'Categoría eliminada',
  variante_creada: 'Variante creada',
  variante_editada: 'Variante editada',
  variante_eliminada: 'Variante eliminada',
  producto_creado: 'Producto creado',
  producto_editado: 'Producto editado',
  producto_eliminado: 'Producto eliminado',
  oferta_creada: 'Oferta creada',
  oferta_precio_fijado: 'Precio de oferta fijado',
  oferta_activada: 'Oferta activada',
  oferta_desactivada: 'Oferta desactivada',
  insumo_creado: 'Insumo creado',
  insumo_editado: 'Insumo editado',
  insumo_eliminado: 'Insumo eliminado',
  insumo_sucursal_creado: 'Insumo de sucursal dado de alta',
  insumo_sucursal_stock_minimo_cambiado: 'Stock mínimo cambiado',
  insumo_sucursal_activado: 'Insumo de sucursal activado',
  insumo_sucursal_descontinuado: 'Insumo de sucursal descontinuado',
  turno_creado: 'Turno creado',
  turno_editado: 'Turno editado',
  asignacion_creada: 'Asignación creada',
  asignacion_retirada: 'Asignación retirada',
  equipo_creado: 'Equipo creado',
  equipo_editado: 'Equipo editado',
  equipo_estado_cambiado: 'Estado de equipo cambiado',
}

// ------------------------------------------------------------ etiquetas

/** Entidad legible; clave desconocida → etiqueta genérica. */
export function etiquetaEntidad(entidad: string): string {
  return ETIQUETA_ENTIDAD[entidad] ?? 'Entidad'
}

/** Área de una entidad; desconocida → `personas` como valor neutral. */
export function areaDeEntidad(entidad: string): AreaAuditoria {
  return AREA_ENTIDAD[entidad] ?? 'personas'
}

/** Acción legible; clave desconocida → etiqueta genérica. */
export function etiquetaAccion(accion: string): string {
  return ETIQUETA_ACCION[accion] ?? 'Acción'
}

/** Área de una acción; desconocida → `personas` como valor neutral. */
export function areaDeAccion(accion: string): AreaAuditoria {
  for (const grupo of ACCIONES_POR_AREA) {
    if ((grupo.acciones as readonly string[]).includes(accion)) {
      return grupo.area
    }
  }
  return 'personas'
}

// -------------------------------------------------- detalle antes/después

/** Etiquetas en español de las claves que el backend escribe en `detalle`. */
export const ETIQUETA_CAMPO_DETALLE: Record<string, string> = {
  nombre: 'Nombre',
  nombreUsuario: 'Nombre de usuario',
  rol: 'Rol',
  sucursalId: 'Sucursal',
  estado: 'Estado',
  fechaCese: 'Fecha de cese',
  cargo: 'Cargo',
  direccion: 'Dirección',
  telefono: 'Teléfono',
  categoriaId: 'Categoría',
  presentacion: 'Presentación',
  descripcion: 'Descripción',
  stockMinimo: 'Stock mínimo',
  precio: 'Precio',
  permiso: 'Permiso',
  tipo: 'Tipo',
  valorAnterior: 'Valor anterior',
  empleadoId: 'Empleado',
  turnoId: 'Turno',
  productoId: 'Producto',
  varianteId: 'Variante',
  fechaInicio: 'Fecha de inicio',
  fechaFin: 'Fecha de fin',
  fechaContratacion: 'Fecha de contratación',
  horaInicio: 'Hora de inicio',
  horaFin: 'Hora de fin',
  diasSemana: 'Días de la semana',
  observaciones: 'Observaciones',
}

/** Una fila del resumen "antes → después" de un evento. */
export interface CampoDetalleAuditoria {
  /** Clave cruda del backend (para depurar). */
  campo: string
  /** Etiqueta en español; genérica si el campo es desconocido. */
  etiqueta: string
  /** Valor anterior formateado, o `null` si no había. */
  antes: string | null
  /** Valor nuevo formateado, o `null` si no se registró. */
  despues: string | null
}

/** Claves que el backend envía como dinero decimal. */
const CAMPOS_MONEDA = new Set(['precio'])

/** Claves que el backend envía como día local "AAAA-MM-DD". */
const CAMPOS_FECHA_LOCAL = new Set([
  'fechaCese',
  'fechaInicio',
  'fechaFin',
  'fechaContratacion',
])

/** Marca de "sin valor" para los campos ausentes o no representables. */
const SIN_VALOR = '—'

/**
 * Formatea un valor del `detalle` para mostrarlo.
 *
 * Devuelve `null` cuando no hay valor o no es representable (un objeto anidado,
 * por ejemplo) para que el llamador muestre "—": el JSON crudo nunca llega a la
 * pantalla.
 */
export function formatearValorDetalle(
  campo: string,
  valor: unknown,
): string | null {
  if (valor === null || valor === undefined) {
    return null
  }

  if (CAMPOS_MONEDA.has(campo)) {
    try {
      return formatearMoneda(aCentimos(valor as string | number))
    } catch {
      return String(valor)
    }
  }

  if (CAMPOS_FECHA_LOCAL.has(campo) && typeof valor === 'string') {
    return formatearFechaLocal(valor)
  }

  if (typeof valor === 'boolean') {
    return valor ? 'Sí' : 'No'
  }

  if (Array.isArray(valor)) {
    const partes = valor.map((item) => formatearValorDetalle(campo, item))
    const presentes = partes.filter((parte): parte is string => parte !== null)
    return presentes.length > 0 ? presentes.join(', ') : null
  }

  if (typeof valor === 'object') {
    return null
  }

  return String(valor)
}

/**
 * Formatea un día local "AAAA-MM-DD" sin conversión de zona horaria.
 *
 * `formatearFecha` interpretaría la cadena como medianoche UTC y la desplazaría
 * a Lima, mostrando el día anterior. Aquí se leen las partes directamente.
 */
function formatearFechaLocal(texto: string): string {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto)
  if (coincidencia === null) {
    return texto
  }
  const [, anio, mes, dia] = coincidencia
  const MESES = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'set',
    'oct',
    'nov',
    'dic',
  ]
  const indice = Number(mes) - 1
  const etiquetaMes = MESES[indice] ?? mes
  return `${dia} ${etiquetaMes} ${anio}`
}

/**
 * Resumen legible del `detalle` de un evento: una fila por campo, con el valor
 * anterior y el nuevo. Nunca devuelve JSON crudo.
 */
export function resumenDetalle(
  detalle: DetalleAuditoriaApi | null | undefined,
): CampoDetalleAuditoria[] {
  const antes = (detalle?.antes ?? {}) as Record<string, unknown>
  const despues = (detalle?.despues ?? {}) as Record<string, unknown>

  const campos = [...Object.keys(antes), ...Object.keys(despues)]
  const unicos = [...new Set(campos)]

  return unicos.map((campo) => ({
    campo,
    etiqueta: ETIQUETA_CAMPO_DETALLE[campo] ?? 'Campo',
    antes: formatearValorDetalle(campo, antes[campo]),
    despues: formatearValorDetalle(campo, despues[campo]),
  }))
}

/** Valor de "sin valor" para exponer al presentador. */
export const ETIQUETA_SIN_VALOR = SIN_VALOR
