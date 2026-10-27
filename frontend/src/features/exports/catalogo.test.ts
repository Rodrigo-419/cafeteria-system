// Contrato del catálogo de exportaciones: los mismos conjuntos, permisos y
// áreas que replica el backend. Si el backend cambia, estas pruebas obligan a
// revisar `catalogo.ts`.
import { describe, expect, it } from 'vitest'
import {
  AREAS_EXPORTACION,
  CONJUNTOS_EXPORTACION,
  conjuntosPorArea,
  conjuntosVisibles,
  definicionDeConjunto,
  puedeExportarConjunto,
} from './catalogo'
import {
  PERMISOS_ADMIN,
  PERMISOS_EMPLEADO,
  PERMISOS_GERENTE,
} from '@/test/handlers'

const CON_RANGO = [
  'ventas',
  'movimientos',
  'asistencia',
  'faltas',
  'reporte',
]

describe('catálogo de exportaciones', () => {
  it('expone los 14 conjuntos en las cinco áreas', () => {
    expect(CONJUNTOS_EXPORTACION).toHaveLength(14)
    expect(new Set(CONJUNTOS_EXPORTACION.map((c) => c.clave)).size).toBe(14)
    expect(AREAS_EXPORTACION.map((a) => a.etiqueta)).toEqual([
      'Ventas y precios',
      'Inventario',
      'Personal y turnos',
      'Asistencia',
      'Sistema y reportes',
    ])
  })

  it('marca como rango obligatorio solo los cinco conjuntos de actividad', () => {
    const conRango = CONJUNTOS_EXPORTACION.filter((c) => c.exigeRango).map(
      (c) => c.clave,
    )
    expect(conRango.sort()).toEqual([...CON_RANGO].sort())
  })

  it('un Admin ve todos, un Gerente no ve el reporte comparativo y un Empleado ninguno', () => {
    expect(conjuntosVisibles(PERMISOS_ADMIN)).toHaveLength(14)
    expect(conjuntosVisibles(PERMISOS_GERENTE)).toHaveLength(13)
    expect(
      conjuntosVisibles(PERMISOS_GERENTE).some((c) => c.clave === 'reporte'),
    ).toBe(false)
    expect(conjuntosVisibles(PERMISOS_EMPLEADO)).toEqual([])
  })

  it('sin usuarios.crear_editar no hay ningún conjunto exportable', () => {
    const ventas = definicionDeConjunto('ventas')
    expect(ventas).not.toBeNull()
    expect(puedeExportarConjunto(['ventas.ver'], ventas!)).toBe(false)
    expect(
      puedeExportarConjunto(['usuarios.crear_editar', 'ventas.ver'], ventas!),
    ).toBe(true)
  })

  it('con solo usuarios.crear_editar quedan Usuarios y Auditoría', () => {
    expect(
      conjuntosVisibles(['usuarios.crear_editar']).map((c) => c.clave),
    ).toEqual(['usuarios', 'auditoria'])
  })

  it('agrupa por área en el orden del catálogo y omite áreas vacías', () => {
    const grupos = conjuntosPorArea(PERMISOS_GERENTE)
    expect(grupos.map((g) => g.area.clave)).toEqual([
      'ventas',
      'inventario',
      'personal',
      'asistencia',
      'sistema',
    ])
    expect(grupos[0]?.conjuntos.map((c) => c.clave)).toEqual([
      'ventas',
      'carta',
    ])
    expect(conjuntosPorArea([])).toEqual([])
  })

  it('devuelve null para una clave desconocida', () => {
    expect(definicionDeConjunto('no-existe')).toBeNull()
    expect(definicionDeConjunto(null)).toBeNull()
  })
})
