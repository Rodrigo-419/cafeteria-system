import {
  esHoraValida,
  minutosDeHora,
  problemasHorarioTurno,
} from './horario';

describe('horario de turno', () => {
  it('acepta un turno fijo con franja valida', () => {
    expect(
      problemasHorarioTurno({
        tipo: 'fijo',
        horaInicio: '08:00',
        horaFin: '16:00',
      }),
    ).toEqual([]);
  });

  it('exige las dos horas en un turno fijo', () => {
    expect(
      problemasHorarioTurno({ tipo: 'fijo', horaInicio: '08:00' }),
    ).toContain('Un turno fijo debe tener hora de inicio y de fin');
    expect(
      problemasHorarioTurno({ tipo: 'fijo', horaFin: '16:00' }),
    ).toContain('Un turno fijo debe tener hora de inicio y de fin');
    expect(problemasHorarioTurno({ tipo: 'fijo' })).toContain(
      'Un turno fijo debe tener hora de inicio y de fin',
    );
  });

  it('acepta un turno variable sin horas', () => {
    expect(problemasHorarioTurno({ tipo: 'variable' })).toEqual([]);
  });

  it('acepta un turno variable con las dos horas', () => {
    expect(
      problemasHorarioTurno({
        tipo: 'variable',
        horaInicio: '08:00',
        horaFin: '12:00',
      }),
    ).toEqual([]);
  });

  it('rechaza un turno variable con una sola hora', () => {
    const mensaje =
      'Un turno variable debe indicar hora de inicio y de fin, o ninguna de las dos';

    expect(
      problemasHorarioTurno({ tipo: 'variable', horaInicio: '08:00' }),
    ).toContain(mensaje);
    expect(
      problemasHorarioTurno({ tipo: 'variable', horaFin: '12:00' }),
    ).toContain(mensaje);
  });

  it('rechaza una hora con formato invalido', () => {
    expect(
      problemasHorarioTurno({
        tipo: 'fijo',
        horaInicio: '8:00',
        horaFin: '16:00',
      }),
    ).toContain('La hora de inicio debe tener el formato HH:mm');
  });

  it('rechaza una hora de fin anterior o igual a la de inicio', () => {
    expect(
      problemasHorarioTurno({
        tipo: 'fijo',
        horaInicio: '16:00',
        horaFin: '08:00',
      }),
    ).toContain('La hora de fin debe ser posterior a la hora de inicio');

    expect(
      problemasHorarioTurno({
        tipo: 'fijo',
        horaInicio: '08:00',
        horaFin: '08:00',
      }),
    ).toContain('La hora de fin debe ser posterior a la hora de inicio');
  });

  it('valida el formato de una hora suelta', () => {
    expect(esHoraValida('00:00')).toBe(true);
    expect(esHoraValida('23:59')).toBe(true);
    expect(esHoraValida('24:00')).toBe(false);
    expect(esHoraValida('8:00')).toBe(false);
    expect(esHoraValida('08:60')).toBe(false);
    expect(esHoraValida(null)).toBe(false);
  });

  it('calcula los minutos desde medianoche', () => {
    expect(minutosDeHora('00:00')).toBe(0);
    expect(minutosDeHora('08:30')).toBe(510);
    expect(minutosDeHora('23:59')).toBe(1439);
  });
});
