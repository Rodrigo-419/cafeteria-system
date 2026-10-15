import { describe, expect, it } from 'vitest'
import { diasDeSemana, lunesDeSemana, sumarDias } from './semana'

describe('Aritmética de semanas', () => {
  it('suma y resta días sobre "AAAA-MM-DD"', () => {
    expect(sumarDias('2026-02-10', 5)).toBe('2026-02-15')
    expect(sumarDias('2026-02-10', -1)).toBe('2026-02-09')
    expect(sumarDias('2025-12-31', 1)).toBe('2026-01-01')
  })

  it('encuentra el lunes de la semana', () => {
    // 2026-01-01 es jueves: su lunes es 2025-12-29.
    expect(lunesDeSemana('2026-01-01')).toBe('2025-12-29')
    // Un lunes es su propio lunes.
    expect(lunesDeSemana('2025-12-29')).toBe('2025-12-29')
    // Un domingo pertenece a la semana que empezó el lunes anterior.
    expect(lunesDeSemana('2026-01-04')).toBe('2025-12-29')
  })

  it('devuelve los siete días de lunes a domingo', () => {
    const dias = diasDeSemana('2025-12-29')
    expect(dias).toHaveLength(7)
    expect(dias.map((dia) => dia.numero)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(dias.map((dia) => dia.corto)).toEqual([
      'Lun',
      'Mar',
      'Mié',
      'Jue',
      'Vie',
      'Sáb',
      'Dom',
    ])
    expect(dias[0]?.iso).toBe('2025-12-29')
    expect(dias[6]?.iso).toBe('2026-01-04')
  })
})
