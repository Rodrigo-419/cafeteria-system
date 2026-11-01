import { describe, expect, it } from 'vitest'

import { formatearValorDetalle, resumenDetalle } from './etiquetas'
import type { DetalleAuditoriaApi } from '@/types/api'

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

describe('detalle de exportaciones', () => {
  const detalle = (campos: Record<string, unknown>) =>
    campos as DetalleAuditoriaApi
  const filasDe = (campos: Record<string, unknown>) =>
    resumenDetalle(detalle(campos)).map((fila) => [
      fila.etiqueta,
      fila.despues,
    ])

  it('resume un conjunto con período, formato y filas', () => {
    expect(
      filasDe({
        conjuntos: ['ventas'],
        formato: 'xlsx',
        filtros: { desde: '2026-10-12', hasta: '2026-10-20' },
        filasPorConjunto: { ventas: 42 },
      }),
    ).toEqual([
      ['Conjunto', 'Ventas'],
      ['Formato', 'Excel'],
      ['Período', 'del 12 oct 2026 al 20 oct 2026'],
      ['Filas', '42'],
    ])
  })

  it('omite el período cuando no hay filtros y traduce CSV', () => {
    expect(
      filasDe({
        conjuntos: ['carta'],
        formato: 'csv',
        filtros: {},
        filasPorConjunto: { carta: 7 },
      }),
    ).toEqual([
      ['Conjunto', 'Carta y precios'],
      ['Formato', 'CSV'],
      ['Filas', '7'],
    ])
  })

  it('resume el libro completo con el total de filas', () => {
    expect(
      filasDe({
        conjuntos: ['ventas', 'stock', 'empleados'],
        formato: 'xlsx',
        filtros: {},
        filasPorConjunto: { ventas: 10, stock: 5, empleados: 2 },
      }),
    ).toEqual([
      ['Conjunto', 'Libro completo (3 conjuntos)'],
      ['Formato', 'Excel'],
      ['Filas', '17'],
    ])
  })

  it('muestra el motivo y el conjunto de una exportación fallida', () => {
    expect(
      filasDe({
        conjuntos: ['asistencia'],
        formato: 'xlsx',
        filtros: { desde: '2026-10-12', hasta: '2026-10-20' },
        filasPorConjunto: { asistencia: 0 },
        motivo:
          'El conjunto "asistencia" supera el máximo de 1000 filas (se pidieron 1200). Acota el rango de fechas.',
      }),
    ).toEqual([
      [
        'Motivo',
        'El conjunto "asistencia" supera el máximo de 1000 filas (se pidieron 1200). Acota el rango de fechas.',
      ],
      ['Conjunto', 'Asistencia'],
    ])
  })

  it('no expone la clave de un conjunto desconocido', () => {
    expect(
      filasDe({
        conjuntos: ['futuro'],
        formato: 'xlsx',
        filtros: {},
        filasPorConjunto: { futuro: 1 },
      }),
    ).toEqual([
      ['Conjunto', null],
      ['Formato', 'Excel'],
      ['Filas', '1'],
    ])
  })
})
