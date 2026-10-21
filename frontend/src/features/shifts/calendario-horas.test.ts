// Pruebas de las reglas puras del calendario por horas.
import { describe, expect, it } from 'vitest'
import {
  HORA_MAXIMA,
  HORA_MINIMA,
  bloqueFijoDelDia,
  etiquetaBloque,
  horaDeMinutos,
  horasDeLaRejilla,
  minutosDeHora,
  numeroDiaSemana,
  seSolapan,
  variableTocaElDia,
} from './calendario-horas'
import type { AsignacionApi, TurnoApi } from '@/types/api'

const TURNO_FIJO: TurnoApi = {
  id: 't-1',
  sucursalId: 'suc-1',
  tipo: 'fijo',
  horaInicio: '07:30',
  horaFin: '16:00',
  diasSemana: '1,2,3,4,5',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function asignacion(
  desde: string,
  hasta: string | null,
  turno: TurnoApi,
): AsignacionApi {
  return {
    id: `a-${desde}-${turno.id}`,
    empleadoId: 'emp-1',
    turnoId: turno.id,
    fechaInicio: desde,
    fechaFin: hasta,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    empleado: {
      id: 'emp-1',
      cargo: 'Barista',
      sucursalId: 'suc-1',
      usuario: { id: 'u-1', nombre: 'Ada', nombreUsuario: 'ada' },
    },
    turno,
  }
}

describe('calendario por horas: reglas puras', () => {
  describe('minutosDeHora y horaDeMinutos', () => {
    it('convierte horas a minutos y viceversa', () => {
      expect(minutosDeHora('07:30')).toBe(450)
      expect(minutosDeHora('16:00')).toBe(960)
      expect(horaDeMinutos(450)).toBe('07:30')
      expect(horaDeMinutos(960)).toBe('16:00')
    })
  })

  describe('horasDeLaRejilla', () => {
    it('cubre de 6:00 a 22:00', () => {
      const horas = horasDeLaRejilla()
      expect(horas[0]).toBe(HORA_MINIMA * 60)
      expect(horas[horas.length - 1]).toBe(HORA_MAXIMA * 60)
      expect(horas).toHaveLength(HORA_MAXIMA - HORA_MINIMA + 1)
    })
  })

  describe('numeroDiaSemana', () => {
    it('devuelve el número ISO del día', () => {
      expect(numeroDiaSemana('2026-10-19')).toBe(1) // lunes
      expect(numeroDiaSemana('2026-10-25')).toBe(7) // domingo
      expect(numeroDiaSemana('2026-10-24')).toBe(6) // sábado
    })
  })

  describe('bloqueFijoDelDia', () => {
    it('devuelve el bloque cuando el día está en vigencia y en diasSemana', () => {
      const bloque = bloqueFijoDelDia(
        asignacion('2026-10-12', '2026-10-18', TURNO_FIJO),
        '2026-10-13',
      )
      expect(bloque).toEqual({ inicioMin: 450, finMin: 960 })
    })

    it('devuelve null si el día no está en diasSemana', () => {
      expect(
        bloqueFijoDelDia(
          asignacion('2026-10-12', '2026-10-18', TURNO_FIJO),
          '2026-10-18',
        ),
      ).toBeNull()
    })

    it('devuelve null fuera de la vigencia', () => {
      expect(
        bloqueFijoDelDia(
          asignacion('2026-10-12', '2026-10-16', TURNO_FIJO),
          '2026-10-17',
        ),
      ).toBeNull()
    })

    it('devuelve null para un turno variable', () => {
      const variable: TurnoApi = {
        ...TURNO_FIJO,
        tipo: 'variable',
        horaInicio: null,
        horaFin: null,
        diasSemana: null,
      }
      expect(
        bloqueFijoDelDia(
          asignacion('2026-10-12', '2026-10-18', variable),
          '2026-10-13',
        ),
      ).toBeNull()
    })
  })

  describe('variableTocaElDia', () => {
    const variable: TurnoApi = {
      ...TURNO_FIJO,
      tipo: 'variable',
      horaInicio: null,
      horaFin: null,
      diasSemana: null,
    }

    it('es true dentro de la vigencia de un variable', () => {
      expect(
        variableTocaElDia(
          asignacion('2026-10-12', '2026-10-18', variable),
          '2026-10-15',
        ),
      ).toBe(true)
    })

    it('es false fuera de la vigencia', () => {
      expect(
        variableTocaElDia(
          asignacion('2026-10-12', '2026-10-16', variable),
          '2026-10-17',
        ),
      ).toBe(false)
    })
  })

  describe('seSolapan', () => {
    it('detecta solapes y no confunde horas contiguas', () => {
      expect(
        seSolapan(
          { inicioMin: 450, finMin: 960 },
          { inicioMin: 960, finMin: 1200 },
        ),
      ).toBe(false)
      expect(
        seSolapan(
          { inicioMin: 450, finMin: 960 },
          { inicioMin: 900, finMin: 1000 },
        ),
      ).toBe(true)
    })
  })

  describe('etiquetaBloque', () => {
    it('muestra el rango horario', () => {
      expect(etiquetaBloque({ inicioMin: 450, finMin: 960 })).toBe(
        '07:30 – 16:00',
      )
    })
  })
})
