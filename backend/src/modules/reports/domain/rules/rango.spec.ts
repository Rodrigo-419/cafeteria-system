import {
  diasDelRango,
  MAXIMO_DIAS_RANGO_COMPARATIVO,
} from './rango';

describe('diasDelRango', () => {
  it('cuenta los dos extremos', () => {
    expect(diasDelRango('2026-10-05', '2026-10-05')).toBe(1);
    expect(diasDelRango('2026-10-05', '2026-10-06')).toBe(2);
  });

  it('atraviesa el cambio de mes y de anio', () => {
    expect(diasDelRango('2026-10-31', '2026-11-01')).toBe(2);
    expect(diasDelRango('2026-12-31', '2027-01-01')).toBe(2);
  });

  it('el tope son 92 dias inclusive', () => {
    // Del 2026-07-01 al 2026-09-30 hay 92 dias (julio 31 + agosto 31 + septiembre 30).
    expect(diasDelRango('2026-07-01', '2026-09-30')).toBe(
      MAXIMO_DIAS_RANGO_COMPARATIVO,
    );
    expect(diasDelRango('2026-07-01', '2026-10-01')).toBe(93);
  });
});
