import {
  esFechaLocal,
  fechaLocalDe,
  instanteDeFechaLocal,
  mismoDiaLocal,
  rangoDelDiaLocal,
} from './fechas';

// Lima es UTC-5 sin horario de verano: 05:00 UTC es medianoche local.
const UN_MINUTO_ANTES_DE_MEDIANOCHE = new Date('2026-10-06T04:59:59Z');
const MEDIANOCHE = new Date('2026-10-06T05:00:00Z');

describe('fechaLocalDe', () => {
  it('devuelve el dia local del negocio, no el de la maquina', () => {
    expect(fechaLocalDe(MEDIANOCHE)).toBe('2026-10-06');
    expect(fechaLocalDe(UN_MINUTO_ANTES_DE_MEDIANOCHE)).toBe('2026-10-05');
  });

  it('acepta otra zona cuando se la indican', () => {
    expect(fechaLocalDe(MEDIANOCHE, 'UTC')).toBe('2026-10-06');
    // En UTC la venta de las 04:59 ya es del 6; en Lima aun no.
    expect(fechaLocalDe(UN_MINUTO_ANTES_DE_MEDIANOCHE, 'UTC')).toBe('2026-10-06');
  });
});

describe('mismoDiaLocal', () => {
  it('separa dos instantes que en UTC son del mismo dia', () => {
    // Las dos son del 6 de octubre en UTC, pero del 5 y del 6 en Lima.
    expect(mismoDiaLocal(UN_MINUTO_ANTES_DE_MEDIANOCHE, MEDIANOCHE)).toBe(false);
    expect(
      mismoDiaLocal(UN_MINUTO_ANTES_DE_MEDIANOCHE, new Date('2026-10-05T12:00:00Z')),
    ).toBe(true);
  });
});

describe('esFechaLocal', () => {
  it('acepta un dia de calendario real', () => {
    expect(esFechaLocal('2026-10-06')).toBe(true);
    expect(esFechaLocal('2024-02-29')).toBe(true);
  });

  it('rechaza un dia que no existe', () => {
    expect(esFechaLocal('2026-02-30')).toBe(false);
    expect(esFechaLocal('2026-02-29')).toBe(false);
    expect(esFechaLocal('2026-13-01')).toBe(false);
    expect(esFechaLocal('2026-00-10')).toBe(false);
    expect(esFechaLocal('2026-10-00')).toBe(false);
  });

  it('rechaza cualquier otra forma', () => {
    expect(esFechaLocal('2026-1-1')).toBe(false);
    expect(esFechaLocal('06/10/2026')).toBe(false);
    expect(esFechaLocal('2026-10-06T00:00:00Z')).toBe(false);
    expect(esFechaLocal('')).toBe(false);
    expect(esFechaLocal(20261006)).toBe(false);
    expect(esFechaLocal(null)).toBe(false);
  });
});

describe('instanteDeFechaLocal', () => {
  it('devuelve el instante UTC en el que empieza el dia local', () => {
    expect(instanteDeFechaLocal('2026-10-06').toISOString()).toBe(
      '2026-10-06T05:00:00.000Z',
    );
  });

  it('lanza si la fecha no es un dia real', () => {
    expect(() => instanteDeFechaLocal('2026-02-30')).toThrow(RangeError);
  });
});

describe('rangoDelDiaLocal', () => {
  it('cubre el dia local entero con un extremo exclusivo', () => {
    const rango = rangoDelDiaLocal('2026-10-06');

    expect(rango.desde.toISOString()).toBe('2026-10-06T05:00:00.000Z');
    // Exclusivo: una venta guardada exactamente a medianoche no puede estar
    // dentro de dos dias a la vez.
    expect(rango.hasta.toISOString()).toBe('2026-10-07T05:00:00.000Z');
    expect(rango.desde.getTime()).toBeLessThan(rango.hasta.getTime());
  });

  it('funciona al cruzar de mes y de anio', () => {
    expect(rangoDelDiaLocal('2026-12-31').desde.toISOString()).toBe(
      '2026-12-31T05:00:00.000Z',
    );
    expect(rangoDelDiaLocal('2026-12-31').hasta.toISOString()).toBe(
      '2027-01-01T05:00:00.000Z',
    );
  });
});
