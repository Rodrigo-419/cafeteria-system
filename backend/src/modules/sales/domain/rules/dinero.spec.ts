import {
  MAXIMO_CENTIMOS,
  aCentimos,
  centimosATexto,
  subtotalLinea,
  sumarCentimos,
} from './dinero';

describe('aCentimos', () => {
  it('convierte un importe en texto a centimos exactos', () => {
    expect(aCentimos('12.50')).toBe(1250);
    expect(aCentimos('12.5')).toBe(1250);
    expect(aCentimos('12')).toBe(1200);
    expect(aCentimos(' 0.05 ')).toBe(5);
    expect(aCentimos('0')).toBe(0);
    expect(aCentimos('99999999.99')).toBe(MAXIMO_CENTIMOS);
  });

  it('acepta un numero entero', () => {
    expect(aCentimos(12)).toBe(1200);
    expect(aCentimos(0)).toBe(0);
  });

  it('rechaza lo que no sea un decimal exacto de dos cifras', () => {
    expect(aCentimos('0.001')).toBeNull();
    expect(aCentimos('1.234')).toBeNull();
    expect(aCentimos('1,50')).toBeNull();
    expect(aCentimos('')).toBeNull();
    expect(aCentimos('   ')).toBeNull();
    expect(aCentimos('abc')).toBeNull();
    expect(aCentimos('12.')).toBeNull();
    expect(aCentimos('.5')).toBeNull();
  });

  it('rechaza valores fuera del rango de la columna', () => {
    expect(aCentimos('100000000')).toBeNull();
    expect(aCentimos('-1')).toBeNull();
    expect(aCentimos('-0.01')).toBeNull();
  });

  it('rechaza todo lo que no sea texto ni numero', () => {
    expect(aCentimos(null)).toBeNull();
    expect(aCentimos(undefined)).toBeNull();
    expect(aCentimos({})).toBeNull();
    expect(aCentimos(Number.NaN)).toBeNull();
    expect(aCentimos(Number.POSITIVE_INFINITY)).toBeNull();
    // Un number con decimales se rechaza en vez de redondear: un precio
    // redondeado en silencio es un precio que nadie pidio.
    expect(aCentimos(12.5)).toBeNull();
  });
});

describe('centimosATexto', () => {
  it('fija siempre dos decimales', () => {
    expect(centimosATexto(1250)).toBe('12.50');
    expect(centimosATexto(0)).toBe('0.00');
    expect(centimosATexto(5)).toBe('0.05');
    expect(centimosATexto(MAXIMO_CENTIMOS)).toBe('99999999.99');
  });

  it('rechaza centimos que no sean enteros o se salgan del rango', () => {
    expect(() => centimosATexto(12.5)).toThrow(RangeError);
    expect(() => centimosATexto(-1)).toThrow(RangeError);
    expect(() => centimosATexto(MAXIMO_CENTIMOS + 1)).toThrow(RangeError);
  });
});

describe('subtotalLinea', () => {
  it('multiplica sin coma flotante', () => {
    // 0.10 x 3 es 0.30000000000000004 en coma flotante.
    expect(subtotalLinea(aCentimos('0.10') as number, 3)).toBe(30);
    expect(subtotalLinea(1250, 3)).toBe(3750);
  });

  it('devuelve null cuando el resultado no cabe en la columna', () => {
    expect(subtotalLinea(MAXIMO_CENTIMOS, 2)).toBeNull();
    expect(subtotalLinea(MAXIMO_CENTIMOS, 1)).toBe(MAXIMO_CENTIMOS);
  });

  it('devuelve null si los argumentos no son enteros', () => {
    expect(subtotalLinea(12.5, 3)).toBeNull();
    expect(subtotalLinea(1250, 2.5)).toBeNull();
  });
});

describe('sumarCentimos', () => {
  it('suma importes ya validados', () => {
    expect(sumarCentimos([])).toBe(0);
    expect(sumarCentimos([100, 250])).toBe(350);
    expect(sumarCentimos([10, 10, 10])).toBe(30);
  });

  it('devuelve null si la suma supera el maximo de la columna', () => {
    expect(sumarCentimos([MAXIMO_CENTIMOS, 1])).toBeNull();
  });
});
