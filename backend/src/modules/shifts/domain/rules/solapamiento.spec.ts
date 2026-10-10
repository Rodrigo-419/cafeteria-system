import {
  asignacionesSeSolapan,
  haySolapamiento,
  horariosSeCruzan,
  horasSeCruzan,
  rangosDeFechasSeCruzan,
  type HorarioTurno,
  type RangoFechas,
} from './solapamiento';

function fijo(
  horaInicio: string,
  horaFin: string,
  diasSemana: string,
): HorarioTurno {
  return { tipo: 'fijo', horaInicio, horaFin, diasSemana };
}

function variable(): HorarioTurno {
  return { tipo: 'variable', horaInicio: null, horaFin: null, diasSemana: null };
}

describe('solapamiento de asignaciones', () => {
  describe('rangosDeFechasSeCruzan', () => {
    it('detecta rangos que se pisan', () => {
      expect(
        rangosDeFechasSeCruzan(
          { fechaInicio: '2026-01-01', fechaFin: '2026-01-31' },
          { fechaInicio: '2026-01-15', fechaFin: '2026-02-15' },
        ),
      ).toBe(true);
    });

    it('trata los extremos como inclusivos', () => {
      expect(
        rangosDeFechasSeCruzan(
          { fechaInicio: '2026-01-01', fechaFin: '2026-01-15' },
          { fechaInicio: '2026-01-15', fechaFin: '2026-02-01' },
        ),
      ).toBe(true);
    });

    it('no marca rangos separados', () => {
      expect(
        rangosDeFechasSeCruzan(
          { fechaInicio: '2026-01-01', fechaFin: '2026-01-15' },
          { fechaInicio: '2026-01-16', fechaFin: '2026-02-01' },
        ),
      ).toBe(false);
    });

    it('un rango sin fecha de fin se extiende al futuro', () => {
      expect(
        rangosDeFechasSeCruzan(
          { fechaInicio: '2026-01-01', fechaFin: null },
          { fechaInicio: '2030-01-01', fechaFin: null },
        ),
      ).toBe(true);
    });
  });

  describe('horasSeCruzan', () => {
    it('se pisan cuando comparten minutos', () => {
      expect(horasSeCruzan('08:00', '12:00', '11:00', '15:00')).toBe(true);
    });

    it('tocarse en el borde no es pisarse', () => {
      expect(horasSeCruzan('08:00', '12:00', '12:00', '16:00')).toBe(false);
    });

    it('franjas separadas no se pisan', () => {
      expect(horasSeCruzan('08:00', '10:00', '11:00', '13:00')).toBe(false);
    });
  });

  describe('horariosSeCruzan', () => {
    it('dos fijos con dias y horas comunes chocan', () => {
      expect(
        horariosSeCruzan(
          fijo('08:00', '12:00', '1,2,3'),
          fijo('11:00', '15:00', '3,4,5'),
        ),
      ).toBe(true);
    });

    it('dos fijos sin dias comunes no chocan aunque las horas se pisen', () => {
      expect(
        horariosSeCruzan(
          fijo('08:00', '12:00', '1,2'),
          fijo('11:00', '15:00', '4,5'),
        ),
      ).toBe(false);
    });

    it('dos fijos con dias comunes pero horas separadas no chocan', () => {
      expect(
        horariosSeCruzan(
          fijo('08:00', '10:00', '1,2'),
          fijo('11:00', '13:00', '1,2'),
        ),
      ).toBe(false);
    });

    it('un variable choca con un fijo aunque las horas no encajen', () => {
      expect(horariosSeCruzan(variable(), fijo('08:00', '12:00', '1,2'))).toBe(
        true,
      );
      expect(horariosSeCruzan(fijo('08:00', '12:00', '1,2'), variable())).toBe(
        true,
      );
    });

    it('dos variables chocan', () => {
      expect(horariosSeCruzan(variable(), variable())).toBe(true);
    });
  });

  describe('asignacionesSeSolapan y haySolapamiento', () => {
    const base: RangoFechas = { fechaInicio: '2026-01-01', fechaFin: null };

    it('no se solapan si las fechas no coinciden', () => {
      expect(
        asignacionesSeSolapan(
          { fechaInicio: '2026-01-01', fechaFin: '2026-01-15', turno: fijo('08:00', '12:00', '1') },
          { fechaInicio: '2026-02-01', fechaFin: null, turno: fijo('08:00', '12:00', '1') },
        ),
      ).toBe(false);
    });

    it('se solapan si fechas y horarios coinciden', () => {
      expect(
        asignacionesSeSolapan(
          { ...base, fechaFin: '2026-01-31', turno: fijo('08:00', '12:00', '1,2') },
          { ...base, turno: fijo('11:00', '15:00', '2,3') },
        ),
      ).toBe(true);
    });

    it('haySolapamiento encuentra la primera que choca', () => {
      const nueva = { ...base, turno: fijo('08:00', '12:00', '1,2') };
      const existentes = [
        {
          fechaInicio: '2026-01-01',
          fechaFin: null,
          turno: fijo('13:00', '17:00', '1,2'),
        },
        {
          fechaInicio: '2026-01-01',
          fechaFin: null,
          turno: fijo('11:00', '15:00', '1,2'),
        },
      ];

      expect(haySolapamiento(nueva, existentes)).toBe(true);
    });

    it('no hay solapamiento con una lista vacia', () => {
      expect(
        haySolapamiento({ ...base, turno: fijo('08:00', '12:00', '1') }, []),
      ).toBe(false);
    });
  });
});
