import { describe, expect, it } from 'vitest'

import { formatearValorDetalle, resumenDetalle } from './etiquetas'

describe('formatearValorDetalle', () => {
  it('traduce el código del permiso a su descripción', () => {
    expect(formatearValorDetalle('permiso', 'insumos.ver')).toBe('Ver insumos')
    expect(formatearValorDetalle('permiso', 'asistencia.marcar')).toBe(
      'Marcar entradas y salidas',
    )
  })

  it('oculta un permiso desconocido en lugar de exponer su código', () => {
    expect(formatearValorDetalle('permiso', 'futuro.no.existe')).toBeNull()
  })

  it('traduce los valores de enumeración a texto en español', () => {
    expect(formatearValorDetalle('estado', 'activo')).toBe('Activo')
    expect(formatearValorDetalle('estado', 'bloqueado')).toBe('Bloqueado')
    expect(formatearValorDetalle('tipo', 'concedido')).toBe('Concedido')
    expect(formatearValorDetalle('valorAnterior', 'rol')).toBe('Del rol')
    expect(formatearValorDetalle('presentacion', 'unidad')).toBe('Unidad')
    expect(formatearValorDetalle('presentacion', 'paquete_varias_unidades')).toBe(
      'Paquete (varias unidades)',
    )
  })

  it('no muestra identificadores ni JSON crudo', () => {
    expect(formatearValorDetalle('sucursalId', '01a10950-c688-7358-b8b6-1c4fe33ae377')).toBeNull()
    expect(formatearValorDetalle('estado', { oculto: true })).toBeNull()
    expect(formatearValorDetalle('estado', undefined)).toBeNull()
  })

  it('formatea dinero y fechas locales', () => {
    expect(formatearValorDetalle('precio', '5.00')).toMatch(/^S\/\s*5\.00$/)
    expect(formatearValorDetalle('fechaCese', '2026-10-15')).toBe('15 oct 2026')
  })

  it('traduce las etiquetas del resumen antes/después', () => {
    const filas = resumenDetalle({
      despues: { permiso: 'insumos.ver', sucursalId: 'abc-123', estado: 'bloqueado' },
    })

    expect(filas.map((fila) => [fila.etiqueta, fila.antes, fila.despues])).toEqual([
      ['Permiso', null, 'Ver insumos'],
      ['Sucursal', null, null],
      ['Estado', null, 'Bloqueado'],
    ])
  })
})
