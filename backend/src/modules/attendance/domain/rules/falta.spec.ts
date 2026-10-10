import { TURNO_FIJO, TURNO_VARIABLE } from './falta';
import {
  asignacionVigenteElDia,
  esFalta,
  esTurnoFijo,
  turnoExigeDia,
} from './falta';

describe('regla de falta', () => {
  describe('esTurnoFijo', () => {
    it('distingue fijo de variable', () => {
      expect(esTurnoFijo(TURNO_FIJO)).toBe(true);
      expect(esTurnoFijo(TURNO_VARIABLE)).toBe(false);
    });
  });

  describe('turnoExigeDia', () => {
    // 2026-10-10 es sabado: dia ISO 6.
    it('un turno fijo exige presencia en sus dias de la semana', () => {
      const turno = { tipo: TURNO_FIJO, diasSemana: '1,2,3,4,5,6' };
      expect(turnoExigeDia(turno, '2026-10-10')).toBe(true);
      expect(turnoExigeDia(turno, '2026-10-11')).toBe(false);
    });

    it('un turno variable nunca exige presencia', () => {
      const turno = { tipo: TURNO_VARIABLE, diasSemana: '1,2,3,4,5' };
      expect(turnoExigeDia(turno, '2026-10-10')).toBe(false);
    });
  });

  describe('esFalta', () => {
    const turnoFijo = { tipo: TURNO_FIJO, diasSemana: '1,2,3,4,5,6' };

    it('es falta si el turno exige el dia, sin entrada ni justificacion', () => {
      expect(
        esFalta({
          turno: turnoFijo,
          fecha: '2026-10-10',
          tieneEntrada: false,
          tieneJustificacion: false,
        }),
      ).toBe(true);
    });

    it('no es falta si hubo entrada efectiva', () => {
      expect(
        esFalta({
          turno: turnoFijo,
          fecha: '2026-10-10',
          tieneEntrada: true,
          tieneJustificacion: false,
        }),
      ).toBe(false);
    });

    it('no es falta si el dia esta justificado', () => {
      expect(
        esFalta({
          turno: turnoFijo,
          fecha: '2026-10-10',
          tieneEntrada: false,
          tieneJustificacion: true,
        }),
      ).toBe(false);
    });

    it('no es falta en un dia que el turno no cubre', () => {
      expect(
        esFalta({
          turno: turnoFijo,
          fecha: '2026-10-11',
          tieneEntrada: false,
          tieneJustificacion: false,
        }),
      ).toBe(false);
    });

    it('no es falta con turno variable aunque no haya entrada', () => {
      expect(
        esFalta({
          turno: { tipo: TURNO_VARIABLE, diasSemana: '1,2,3,4,5' },
          fecha: '2026-10-10',
          tieneEntrada: false,
          tieneJustificacion: false,
        }),
      ).toBe(false);
    });
  });

  describe('asignacionVigenteElDia', () => {
    it('respeta el inicio y el fin (inclusive)', () => {
      const vigente = { fechaInicio: '2026-10-01', fechaFin: '2026-10-15' };
      expect(asignacionVigenteElDia({ ...vigente, fecha: '2026-09-30' })).toBe(false);
      expect(asignacionVigenteElDia({ ...vigente, fecha: '2026-10-01' })).toBe(true);
      expect(asignacionVigenteElDia({ ...vigente, fecha: '2026-10-15' })).toBe(true);
      expect(asignacionVigenteElDia({ ...vigente, fecha: '2026-10-16' })).toBe(false);
    });

    it('sin fecha de fin es vigente para siempre', () => {
      const vigente = { fechaInicio: '2026-10-01', fechaFin: null };
      expect(asignacionVigenteElDia({ ...vigente, fecha: '2026-11-30' })).toBe(true);
    });
  });
});