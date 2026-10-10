import {
  centimosDeTexto,
  formatearCentimos,
  ticketPromedio,
} from './ventas';

describe('formatearCentimos', () => {
  it('convierte centimos enteros a texto con dos decimales', () => {
    expect(formatearCentimos(0)).toBe('0.00');
    expect(formatearCentimos(5)).toBe('0.05');
    expect(formatearCentimos(250)).toBe('2.50');
    expect(formatearCentimos(12040)).toBe('120.40');
  });

  it('conserva el signo de los negativos', () => {
    expect(formatearCentimos(-5)).toBe('-0.05');
    expect(formatearCentimos(-200)).toBe('-2.00');
  });

  it('no impone el tope de una columna Decimal(10,2)', () => {
    // Un total de 92 dias puede superar lo que cabe en una sola fila.
    expect(formatearCentimos(123_456_789_012_345)).toBe('1234567890123.45');
  });

  it('rechaza un valor que no sea entero seguro', () => {
    expect(() => formatearCentimos(1.5)).toThrow(RangeError);
    expect(() => formatearCentimos(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      RangeError,
    );
  });
});

describe('centimosDeTexto', () => {
  it('parsea el texto que devuelve un SUM(...)::numeric(p,2)::text', () => {
    expect(centimosDeTexto('20.50')).toBe(2050);
    expect(centimosDeTexto('0.00')).toBe(0);
    expect(centimosDeTexto('-2.00')).toBe(-200);
  });

  it('acepta enteros y un solo decimal', () => {
    expect(centimosDeTexto('5')).toBe(500);
    expect(centimosDeTexto('15.5')).toBe(1550);
  });

  it('devuelve 0 ante un texto que no tiene el formato esperado', () => {
    expect(centimosDeTexto('')).toBe(0);
    expect(centimosDeTexto('abc')).toBe(0);
    expect(centimosDeTexto('1.234')).toBe(0);
  });
});

describe('ticketPromedio', () => {
  it('devuelve null cuando no hubo ventas', () => {
    expect(ticketPromedio(0, 0)).toBeNull();
    expect(ticketPromedio(1000, 0)).toBeNull();
  });

  it('devuelve el importe exacto cuando la division es exacta', () => {
    expect(ticketPromedio(1000, 4)).toBe('2.50');
    expect(ticketPromedio(0, 3)).toBe('0.00');
  });

  it('redondea half-up al centimo', () => {
    // 10.00 entre 3 = 3.3333 -> 3.33
    expect(ticketPromedio(1000, 3)).toBe('3.33');
    // 10.01 entre 2 = 5.005 -> 5.01 (empate al alza)
    expect(ticketPromedio(1001, 2)).toBe('5.01');
    // 9.99 entre 2 = 4.995 -> 5.00 (empate al alza)
    expect(ticketPromedio(999, 2)).toBe('5.00');
    // 2.50 entre 4 = 0.625 -> 0.63
    expect(ticketPromedio(250, 4)).toBe('0.63');
  });
});
