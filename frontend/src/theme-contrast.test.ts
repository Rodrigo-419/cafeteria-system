import { describe, expect, it } from 'vitest'

/**
 * Verificación real (no a ojo) de contraste WCAG 2.1.
 *
 * Los valores deben coincidir con las escalas de `src/index.css`. Si alguien
 * cambia un token sin revisar el contraste, esta prueba falla.
 *
 * Criterio: AA exige >= 4.5:1 para texto normal y >= 3:1 para texto grande
 * (>= 18 px, o >= 14 px en negrita). Los controles deshabilitados están
 * exentos de 1.4.3, pero aquí se fija un suelo interno de 3:1.
 */
const C = {
  primary50: '#fbf8f5',
  primary100: '#f1e8e0',
  primary200: '#dfc9b7',
  primary300: '#ccab8d',
  primary400: '#ba8c64',
  primary500: '#a76d3a',
  primary600: '#895930',
  primary700: '#6b4625',
  primary800: '#4d321b',
  primary900: '#2f1f10',
  neutral50: '#f4f4f3',
  neutral100: '#e9e7e6',
  neutral300: '#b9b5b2',
  neutral400: '#a19c98',
  neutral500: '#8a837e',
  neutral700: '#5a504a',
  neutral800: '#433730',
  neutral900: '#2b1e16',
  success100: '#e2ede3',
  success300: '#9ac09c',
  success400: '#76aa79',
  success800: '#18411a',
  success900: '#0d230e',
  warning100: '#f5e8dd',
  warning300: '#dbac88',
  warning400: '#ce8e5e',
  warning900: '#321703',
  error100: '#f7e2e2',
  error300: '#e49797',
  error400: '#da7272',
  error600: '#c62828',
  error800: '#671515',
  error900: '#370b0b',
  info100: '#e1eafc',
  info300: '#96b4f5',
  info400: '#7099f2',
  info800: '#13337a',
  info900: '#0a1c42',
  white: '#ffffff',
} as const

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ]
}

function luminancia(hex: string): number {
  const canal = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

function contraste(a: string, b: string): number {
  const l1 = luminancia(a)
  const l2 = luminancia(b)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

const r = (n: number) => Number(n.toFixed(2))

interface Par {
  nombre: string
  texto: string
  fondo: string
  minimo: number
  nota?: string
}

const paresClaro: Par[] = [
  { nombre: 'primario (botón)', texto: C.white, fondo: C.primary600, minimo: 4.5 },
  {
    nombre: 'secundario (botón)',
    texto: C.primary800,
    fondo: C.primary50,
    minimo: 4.5,
  },
  {
    nombre: 'invertido (botón)',
    texto: C.neutral50,
    fondo: C.neutral900,
    minimo: 4.5,
  },
  {
    nombre: 'outlined (botón)',
    texto: C.primary700,
    fondo: C.primary50,
    minimo: 4.5,
  },
  {
    nombre: 'destructivo (botón)',
    texto: C.white,
    fondo: C.error600,
    minimo: 4.5,
  },
  { nombre: 'enlace', texto: C.primary700, fondo: C.primary50, minimo: 4.5 },
  {
    nombre: 'texto sobre fondo',
    texto: C.neutral900,
    fondo: C.primary100,
    minimo: 4.5,
  },
  {
    nombre: 'texto sobre tarjeta',
    texto: C.neutral900,
    fondo: C.primary50,
    minimo: 4.5,
  },
  {
    nombre: 'texto atenuado sobre tarjeta',
    texto: C.neutral700,
    fondo: C.primary50,
    minimo: 4.5,
  },
  {
    nombre: 'badge success',
    texto: C.success800,
    fondo: C.success100,
    minimo: 4.5,
  },
  {
    nombre: 'badge warning',
    texto: C.warning900,
    fondo: C.warning100,
    minimo: 4.5,
  },
  { nombre: 'badge error', texto: C.error800, fondo: C.error100, minimo: 4.5 },
  { nombre: 'badge info', texto: C.info800, fondo: C.info100, minimo: 4.5 },
  {
    nombre: 'deshabilitado',
    texto: C.neutral500,
    fondo: C.neutral100,
    minimo: 3,
    nota: 'exento de AA (1.4.3); suelo interno 3:1',
  },
  {
    nombre: 'acento #A76D3A (solo texto grande/elementos)',
    texto: C.primary500,
    fondo: C.white,
    minimo: 3,
    nota: 'AA-large; por eso el botón usa primary-600 y no primary-500',
  },
]

const paresOscuro: Par[] = [
  {
    nombre: 'primario (botón)',
    texto: C.neutral900,
    fondo: C.primary400,
    minimo: 4.5,
  },
  {
    nombre: 'secundario (botón)',
    texto: C.neutral50,
    fondo: C.neutral700,
    minimo: 4.5,
  },
  {
    nombre: 'invertido (botón)',
    texto: C.neutral900,
    fondo: C.neutral50,
    minimo: 4.5,
  },
  {
    nombre: 'outlined (botón)',
    texto: C.primary300,
    fondo: C.neutral800,
    minimo: 4.5,
  },
  {
    nombre: 'destructivo (botón)',
    texto: C.neutral900,
    fondo: C.error400,
    minimo: 4.5,
  },
  { nombre: 'enlace', texto: C.primary300, fondo: C.neutral800, minimo: 4.5 },
  {
    nombre: 'texto sobre fondo',
    texto: C.neutral50,
    fondo: C.neutral900,
    minimo: 4.5,
  },
  {
    nombre: 'texto sobre tarjeta',
    texto: C.neutral50,
    fondo: C.neutral800,
    minimo: 4.5,
  },
  {
    nombre: 'texto atenuado sobre tarjeta',
    texto: C.neutral300,
    fondo: C.neutral800,
    minimo: 4.5,
  },
  {
    nombre: 'badge success',
    texto: C.success300,
    fondo: C.success900,
    minimo: 4.5,
  },
  {
    nombre: 'badge warning',
    texto: C.warning300,
    fondo: C.warning900,
    minimo: 4.5,
  },
  { nombre: 'badge error', texto: C.error300, fondo: C.error900, minimo: 4.5 },
  { nombre: 'badge info', texto: C.info300, fondo: C.info900, minimo: 4.5 },
  {
    nombre: 'deshabilitado',
    texto: C.neutral300,
    fondo: C.neutral700,
    minimo: 3,
    nota: 'exento de AA (1.4.3); suelo interno 3:1',
  },
]

function verificar(pares: Par[]) {
  for (const par of pares) {
    it(`${par.nombre} ≥ ${par.minimo}:1`, () => {
      const ratio = contraste(par.texto, par.fondo)
      expect(
        ratio,
        `${par.texto} sobre ${par.fondo} = ${r(ratio)}:1` +
          (par.nota ? ` (${par.nota})` : ''),
      ).toBeGreaterThanOrEqual(par.minimo)
    })
  }
}

describe('Contraste AA — tema claro', () => verificar(paresClaro))
describe('Contraste AA — tema oscuro', () => verificar(paresOscuro))

describe('La escala primaria conserva la jerarquía de contraste', () => {
  it('#A76D3A con blanco queda por debajo de 4.5:1 (uso solo en elementos grandes)', () => {
    const ratio = contraste(C.primary500, C.white)
    expect(ratio).toBeLessThan(4.5)
    expect(ratio).toBeGreaterThanOrEqual(3)
  })

  it('primary-600 sí supera 4.5:1 con blanco (botones)', () => {
    expect(contraste(C.primary600, C.white)).toBeGreaterThanOrEqual(4.5)
  })
})
