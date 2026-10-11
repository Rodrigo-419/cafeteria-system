import { describe, expect, it } from 'vitest'
import { PERMISOS, tieneAlguno, tienePermiso, tieneTodos } from './permissions'

describe('catalogo de permisos', () => {
  it('define exactamente los 24 permisos, sin repetidos', () => {
    expect(PERMISOS).toHaveLength(24)
    expect(new Set(PERMISOS).size).toBe(24)
  })
})

describe('consultas de permisos', () => {
  it('tienePermiso', () => {
    expect(tienePermiso(['ventas.ver'], 'ventas.ver')).toBe(true)
    expect(tienePermiso([], 'ventas.ver')).toBe(false)
  })

  it('tieneTodos exige todos', () => {
    expect(
      tieneTodos(
        ['ventas.ver', 'ventas.registrar'],
        ['ventas.ver', 'ventas.registrar'],
      ),
    ).toBe(true)
    expect(tieneTodos(['ventas.ver'], ['ventas.ver', 'ventas.registrar'])).toBe(
      false,
    )
  })

  it('tieneAlguno basta con uno', () => {
    expect(tieneAlguno(['ventas.ver'], ['ventas.ver', 'ventas.anular'])).toBe(
      true,
    )
    expect(
      tieneAlguno(['productos.ver'], ['ventas.ver', 'ventas.anular']),
    ).toBe(false)
  })
})
