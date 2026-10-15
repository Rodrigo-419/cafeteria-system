import { describe, expect, it } from 'vitest'
import {
  diasDeTexto,
  estadoAsignacion,
  formatearDias,
  formatearHorario,
  formatearVigencia,
  mensajeDias,
  mensajeFechaFin,
  mensajeFechaInicio,
  mensajeFechaInicioContratacion,
  mensajeFechaRetiro,
  mensajeHoras,
  resumenTurno,
  textoDeDias,
} from './presentacion'
import type { AsignacionApi } from '@/types/api'

describe('Presentación de turnos', () => {
  it('lee los días de un texto del contrato', () => {
    expect(diasDeTexto(null)).toEqual([])
    expect(diasDeTexto('')).toEqual([])
    expect(diasDeTexto('1,3,5')).toEqual([1, 3, 5])
  })

  it('escribe los días en orden canónico', () => {
    expect(textoDeDias([5, 1, 3])).toBe('1,3,5')
    expect(textoDeDias([])).toBe('')
  })

  it('formatea los días con sus abreviaturas', () => {
    expect(formatearDias('1,2,3,4,5')).toBe('Lun, Mar, Mié, Jue, Vie')
    expect(formatearDias(null)).toBe('Sin días definidos')
  })

  it('formatea el horario o lo declara ausente', () => {
    expect(formatearHorario('07:30', '16:00')).toBe('07:30 – 16:00')
    expect(formatearHorario(null, null)).toBe('Sin horario')
  })

  it('resume un turno variable con su marca', () => {
    expect(
      resumenTurno({
        id: 't',
        sucursalId: 's',
        tipo: 'fijo',
        horaInicio: '07:30',
        horaFin: '16:00',
        diasSemana: '1,2,3,4,5',
        createdAt: '',
        updatedAt: '',
      }),
    ).toBe('07:30 – 16:00')
    expect(
      resumenTurno({
        id: 't',
        sucursalId: 's',
        tipo: 'variable',
        horaInicio: null,
        horaFin: null,
        diasSemana: null,
        createdAt: '',
        updatedAt: '',
      }),
    ).toBe('Sin horario · variable')
  })

  describe('validación de la franja horaria', () => {
    it('exige las dos horas en un turno fijo', () => {
      expect(mensajeHoras('fijo', '', '')).toBe(
        'Un turno fijo necesita la hora de inicio y la de fin.',
      )
      expect(mensajeHoras('fijo', '07:00', '')).toBe(
        'Un turno fijo necesita la hora de inicio y la de fin.',
      )
      expect(mensajeHoras('fijo', '07:00', '16:00')).toBeNull()
    })

    it('en un turno variable admite ninguna franja o las dos', () => {
      expect(mensajeHoras('variable', '', '')).toBeNull()
      expect(mensajeHoras('variable', '07:00', '')).toBe(
        'Un turno variable debe llevar las dos horas o ninguna.',
      )
    })

    it('valida el formato y que la hora de fin sea posterior', () => {
      expect(mensajeHoras('variable', '7:00', '16:00')).toBe(
        'Las horas deben tener el formato HH:mm.',
      )
      expect(mensajeHoras('variable', '16:00', '07:00')).toBe(
        'La hora de fin debe ser posterior a la de inicio.',
      )
    })
  })

  it('exige al menos un día en un turno fijo', () => {
    expect(mensajeDias('fijo', [])).toBe(
      'Un turno fijo debe indicar los días de la semana.',
    )
    expect(mensajeDias('fijo', [1])).toBeNull()
    expect(mensajeDias('variable', [])).toBeNull()
  })

  describe('validación de fechas de asignación', () => {
    it('la fecha de inicio es obligatoria y debe existir', () => {
      expect(mensajeFechaInicio('')).toBe('La fecha de inicio es obligatoria.')
      expect(mensajeFechaInicio('2026-02-30')).toBe(
        'La fecha de inicio debe ser un día válido.',
      )
      expect(mensajeFechaInicio('2026-02-28')).toBeNull()
    })

    it('la fecha de inicio no puede ser anterior a la contratación', () => {
      const contratacion = '2026-02-01T00:00:00.000Z'
      expect(
        mensajeFechaInicioContratacion(contratacion, '2026-01-15'),
      ).toBe(
        'La fecha de inicio no puede ser anterior a la contratación del empleado.',
      )
      expect(
        mensajeFechaInicioContratacion(contratacion, '2026-02-01'),
      ).toBeNull()
    })

    it('la fecha de fin es opcional pero no puede ser anterior', () => {
      expect(mensajeFechaFin('2026-02-01', '')).toBeNull()
      expect(mensajeFechaFin('2026-02-01', '2026-02-01')).toBeNull()
      expect(mensajeFechaFin('2026-02-10', '2026-02-02')).toBe(
        'La fecha de fin no puede ser anterior a la de inicio.',
      )
    })

    it('la fecha de retiro no puede ser anterior al inicio ni a hoy', () => {
      expect(mensajeFechaRetiro('2026-02-01', '2026-02-10', '')).toBe(
        'La fecha de fin es obligatoria.',
      )
      expect(
        mensajeFechaRetiro('2026-02-01', '2026-02-10', '2026-01-15'),
      ).toBe('La fecha de fin no puede ser anterior a la de inicio.')
      expect(
        mensajeFechaRetiro('2026-02-01', '2026-02-10', '2026-02-05'),
      ).toBe('La fecha de fin no puede ser anterior a hoy.')
      expect(
        mensajeFechaRetiro('2026-02-01', '2026-02-10', '2026-02-15'),
      ).toBeNull()
    })

    it('una fecha de fin no puede ser anterior a la de inicio al retirar', () => {
      // El retiro admite como fin hoy si es posterior al inicio.
      expect(mensajeFechaRetiro('2026-01-01', '2026-02-10', '2026-02-10')).toBeNull()
    })
  })

  describe('estado y vigencia de una asignación', () => {
    function asignacion(
      fechaInicio: string,
      fechaFin: string | null,
    ): Pick<AsignacionApi, 'fechaInicio' | 'fechaFin'> {
      return { fechaInicio: `${fechaInicio}T00:00:00.000Z`, fechaFin }
    }

    it('es programada si empieza en el futuro', () => {
      expect(estadoAsignacion(asignacion('2026-03-01', null), '2026-02-10')).toBe(
        'programada',
      )
    })

    it('es vigente mientras no haya terminado', () => {
      expect(estadoAsignacion(asignacion('2026-02-01', null), '2026-02-10')).toBe(
        'vigente',
      )
      expect(
        estadoAsignacion(asignacion('2026-02-01', '2026-02-10'), '2026-02-10'),
      ).toBe('vigente')
    })

    it('es finalizada si la fecha de fin ya pasó', () => {
      expect(
        estadoAsignacion(asignacion('2026-01-01', '2026-02-09'), '2026-02-10'),
      ).toBe('finalizada')
    })

    it('formatea la vigencia abierta o cerrada', () => {
      expect(formatearVigencia('2026-04-14', null)).toBe('Desde 14 abr. 2026')
      expect(formatearVigencia('2026-04-14', '2026-04-20')).toBe(
        '14 abr. 2026 – 20 abr. 2026',
      )
    })
  })
})
