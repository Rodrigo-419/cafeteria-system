// Pruebas unitarias de las reglas puras del horario propio.
import {
  MAXIMO_DIAS_HORARIO,
  AsignacionHorario,
  diasDelRango,
  diasEntre,
  lunesDeSemana,
  sumarDias,
  turnoParaDia,
  validarRango,
} from './reglas-mi-horario';

function asignacion(
  desde: string,
  hasta: string | null,
  turno: AsignacionHorario['turno'],
): AsignacionHorario {
  return { id: `asignacion-${desde}`, fechaInicio: desde, fechaFin: hasta, turno };
}

const FIJO_MARTES_JUEVES = {
  tipo: 'fijo' as const,
  horaInicio: '07:30',
  horaFin: '16:00',
  diasSemana: '2,4',
};

const FIKO_UNICO = {
  tipo: 'fijo' as const,
  horaInicio: '09:00',
  horaFin: '13:00',
  diasSemana: '6',
};

const VARIABLE = {
  tipo: 'variable' as const,
  horaInicio: null,
  horaFin: null,
  diasSemana: null,
};

describe('reglas del horario propio', () => {
  describe('sumarDias y lunesDeSemana', () => {
    it('suma días en UTC', () => {
      expect(sumarDias('2026-10-17', 7)).toBe('2026-10-24');
      expect(sumarDias('2026-10-17', -1)).toBe('2026-10-16');
    });

    it('lunesDeSemana devuelve el lunes de la semana', () => {
      expect(lunesDeSemana('2026-10-17')).toBe('2026-10-12'); // sábado
      expect(lunesDeSemana('2026-10-19')).toBe('2026-10-19'); // lunes
      expect(lunesDeSemana('2026-10-25')).toBe('2026-10-19'); // domingo
    });
  });

  describe('diasEntre y diasDelRango', () => {
    it('cuenta días inclusivos', () => {
      expect(diasEntre('2026-10-17', '2026-10-17')).toBe(1);
      expect(diasEntre('2026-10-12', '2026-10-18')).toBe(7);
      expect(diasEntre('2026-10-12', '2027-01-11')).toBe(MAXIMO_DIAS_HORARIO);
    });

    it('diasDelRango devuelve todos los días del rango', () => {
      expect(diasDelRango('2026-10-12', '2026-10-14')).toEqual([
        '2026-10-12',
        '2026-10-13',
        '2026-10-14',
      ]);
    });
  });

  describe('validarRango', () => {
    it('sin parámetros devuelve la semana actual', () => {
      const rango = validarRango(undefined, undefined);
      expect(rango.hasta).toBe(sumarDias(rango.desde, 6));
    });

    it('un solo extremo lo usa como día único', () => {
      expect(validarRango('2026-10-17', undefined)).toEqual({
        desde: '2026-10-17',
        hasta: '2026-10-17',
      });
      expect(validarRango(undefined, '2026-10-20')).toEqual({
        desde: '2026-10-20',
        hasta: '2026-10-20',
      });
    });

    it('rechaza desde posterior a hasta', () => {
      expect(() => validarRango('2026-10-20', '2026-10-17')).toThrow(
        /desde.*posterior/i,
      );
    });

    it('rechaza un rango mayor a 92 días', () => {
      expect(() =>
        validarRango('2026-01-01', '2026-12-31'),
      ).toThrow(/92/);
    });

    it('acepta exactamente 92 días', () => {
      expect(() =>
        validarRango('2026-10-12', '2027-01-11'),
      ).not.toThrow();
    });
  });

  describe('turnoParaDia', () => {
    it('devuelve null fuera de la vigencia', () => {
      const asignaciones = [asignacion('2026-10-12', '2026-10-16', FIJO_MARTES_JUEVES)];
      expect(turnoParaDia('2026-10-17', asignaciones, null)).toBeNull();
    });

    it('un turno fijo solo aplica los días de su diasSemana', () => {
      const asignaciones = [asignacion('2026-10-12', '2026-10-18', FIJO_MARTES_JUEVES)];
      // 2026-10-13 = martes (día 2) → aplica
      expect(turnoParaDia('2026-10-13', asignaciones, null)).toMatchObject({
        tipo: 'fijo',
        horaInicio: '07:30',
      });
      // 2026-10-14 = miércoles (día 3) → no aplica
      expect(turnoParaDia('2026-10-14', asignaciones, null)).toBeNull();
    });

    it('un turno variable aplica todos los días de su vigencia', () => {
      const asignaciones = [asignacion('2026-10-12', '2026-10-18', VARIABLE)];
      expect(turnoParaDia('2026-10-15', asignaciones, null)).toMatchObject({
        tipo: 'variable',
        horaInicio: null,
        horaFin: null,
      });
    });

    it('un cesado no obtiene horario posterior al cese', () => {
      const VIERNES = {
        tipo: 'fijo' as const,
        horaInicio: '09:00',
        horaFin: '17:00',
        diasSemana: '5',
      };
      const asignaciones = [asignacion('2026-10-12', null, VIERNES)];
      expect(turnoParaDia('2026-10-17', asignaciones, '2026-10-16')).toBeNull();
      expect(turnoParaDia('2026-10-16', asignaciones, '2026-10-16')).not.toBeNull();
    });

    it('devuelve la primera asignación que aplica', () => {
      const asignaciones = [
        asignacion('2026-10-12', '2026-10-16', FIJO_MARTES_JUEVES),
        asignacion('2026-10-17', '2026-10-24', FIKO_UNICO),
      ];
      expect(turnoParaDia('2026-10-13', asignaciones, null)).toMatchObject({
        tipo: 'fijo',
      });
      expect(turnoParaDia('2026-10-24', asignaciones, null)).toMatchObject({
        tipo: 'fijo',
        horaInicio: '09:00',
      });
    });

    it('un día sin asignaciones devuelve null', () => {
      expect(turnoParaDia('2026-10-13', [], null)).toBeNull();
    });
  });
});
