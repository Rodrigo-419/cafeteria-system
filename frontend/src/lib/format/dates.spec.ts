import { describe, expect, it } from 'vitest'
import {
  diaDeNegocioLima,
  formatearFecha,
  formatearFechaHora,
  formatearHora,
} from './dates'

describe('formatos de fecha en America/Lima', () => {
  it('calcula el dia de negocio en la zona de Lima, no en UTC', () => {
    // 2026-01-01T02:00:00Z son las 21:00 del 2025-12-31 en Lima (UTC-5).
    expect(diaDeNegocioLima('2026-01-01T02:00:00.000Z')).toBe('2025-12-31')
  })

  it('formatea fecha, hora y ambas', () => {
    const iso = '2026-10-10T18:30:00.000Z'
    expect(formatearFecha(iso)).toMatch(/2026/)
    expect(formatearHora(iso)).toMatch(/\d{1,2}:\d{2}/)
    expect(formatearFechaHora(iso)).toMatch(/2026/)
  })
})
