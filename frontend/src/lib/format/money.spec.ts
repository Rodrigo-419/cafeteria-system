import { describe, expect, it } from 'vitest'
import { aCentimos, formatearMoneda } from './money'

describe('aCentimos', () => {
  it('convierte cadenas decimales con punto o coma', () => {
    expect(aCentimos('12.50')).toBe(1250)
    expect(aCentimos('12,50')).toBe(1250)
    expect(aCentimos('0.05')).toBe(5)
    expect(aCentimos('7')).toBe(700)
  })

  it('convierte numeros', () => {
    expect(aCentimos(12.5)).toBe(1250)
    expect(aCentimos(3)).toBe(300)
  })

  it('admite negativos', () => {
    expect(aCentimos('-4.20')).toBe(-420)
  })

  it('rechaza montos invalidos', () => {
    expect(() => aCentimos('abc')).toThrow()
    expect(() => aCentimos('1.2.3')).toThrow()
  })
})

describe('formatearMoneda', () => {
  it('formatea en soles peruanos', () => {
    const texto = formatearMoneda(1250)
    expect(texto).toContain('12.50')
    expect(texto).toMatch(/S\//)
  })

  it('redondea a dos decimales', () => {
    expect(formatearMoneda(5)).toContain('0.05')
  })
})
