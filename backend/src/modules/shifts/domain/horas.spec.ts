import { fechaAHora, horaADate } from './horas';

describe('horas', () => {
  it('convierte una hora en el Date anclado a 1970 en UTC', () => {
    expect(horaADate('08:30').toISOString()).toBe('1970-01-01T08:30:00.000Z');
    expect(horaADate('00:00').toISOString()).toBe('1970-01-01T00:00:00.000Z');
    expect(horaADate('23:59').toISOString()).toBe('1970-01-01T23:59:00.000Z');
  });

  it('vuelve de Date a hora "HH:mm"', () => {
    expect(fechaAHora(new Date('1970-01-01T08:30:00.000Z'))).toBe('08:30');
    expect(fechaAHora(new Date('1970-01-01T00:00:00.000Z'))).toBe('00:00');
  });

  it('devuelve null cuando no hay hora', () => {
    expect(fechaAHora(null)).toBeNull();
  });

  it('el viaje de ida y vuelta conserva la hora', () => {
    expect(fechaAHora(horaADate('17:05'))).toBe('17:05');
  });
});
