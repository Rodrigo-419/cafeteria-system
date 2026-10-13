import { describe, expect, it } from 'vitest'
import {
  LARGO_CONTRASENA_GENERADA,
  generarPassword,
} from './generador-password'

const JUEGO_SEGURO = /^[A-Za-z0-9!@#$%&*\-_+.]+$/

describe('generador-password', () => {
  it('genera contraseñas de al menos 16 caracteres', () => {
    const generada = generarPassword()
    expect(generada.length).toBeGreaterThanOrEqual(16)
    expect(generada.length).toBe(LARGO_CONTRASENA_GENERADA)
  })

  it('usa solo el alfabeto seguro (sin caracteres ambiguos)', () => {
    expect(generarPassword()).toMatch(JUEGO_SEGURO)
  })

  it('genera valores distintos entre llamadas', () => {
    expect(generarPassword()).not.toBe(generarPassword())
  })
})