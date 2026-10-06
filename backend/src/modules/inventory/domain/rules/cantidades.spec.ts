import {
  aCentimos,
  cantidadATexto,
  CANTIDAD_DECIMALES,
  CANTIDAD_MAXIMA,
  centimosATexto,
  calcularDiferencia,
  compararCantidades,
  diferenciaEsCero,
  esCantidadValida,
  mismaCantidad,
  problemasCantidad,
  tieneMasDeDosDecimales,
} from './cantidades';

const NO_NEGATIVA = { positivoEstricto: false };
const POSITIVA = { positivoEstricto: true };

describe('reglas de cantidades', () => {
  describe('tieneMasDeDosDecimales', () => {
    it('acepta hasta dos decimales', () => {
      expect(tieneMasDeDosDecimales(0)).toBe(false);
      expect(tieneMasDeDosDecimales(5)).toBe(false);
      expect(tieneMasDeDosDecimales(5.5)).toBe(false);
      expect(tieneMasDeDosDecimales(5.25)).toBe(false);
    });

    it('rechaza tres o mas decimales', () => {
      expect(tieneMasDeDosDecimales(5.256)).toBe(true);
      expect(tieneMasDeDosDecimales(0.001)).toBe(true);
    });

    it('no revienta con notacion exponencial', () => {
      expect(() => tieneMasDeDosDecimales(1e-7)).not.toThrow();
      expect(() => tieneMasDeDosDecimales(1e21)).not.toThrow();
    });
  });

  describe('problemasCantidad', () => {
    it('acepta cero y positivos cuando no se exige positividad estricta', () => {
      expect(problemasCantidad(0, NO_NEGATIVA)).toEqual([]);
      expect(problemasCantidad(0.01, NO_NEGATIVA)).toEqual([]);
      expect(problemasCantidad(9999999999.99, NO_NEGATIVA)).toEqual([]);
    });

    it('rechaza cero cuando se exige positividad estricta', () => {
      expect(problemasCantidad(0, POSITIVA)).toEqual(['La cantidad debe ser mayor que 0']);
    });

    it('rechaza negativos en ambos casos', () => {
      expect(problemasCantidad(-1, NO_NEGATIVA)).toEqual([
        'La cantidad debe ser mayor o igual a 0',
      ]);
      expect(problemasCantidad(-0.01, POSITIVA)).toEqual(['La cantidad debe ser mayor que 0']);
    });

    it('rechaza mas de dos decimales', () => {
      expect(problemasCantidad(1.234, NO_NEGATIVA)).toEqual([
        'La cantidad no puede tener mas de 2 decimales',
      ]);
    });

    it('rechaza lo que excede el rango de la columna', () => {
      expect(problemasCantidad(CANTIDAD_MAXIMA + 0.01, NO_NEGATIVA)).toContain(
        'La cantidad no puede exceder 9999999999.99',
      );
    });

    it('acumula rango y decimales cuando fallan los dos', () => {
      // 99999999999.999 excede la columna Y trae tres decimales.
      expect(problemasCantidad(99999999999.999, NO_NEGATIVA)).toHaveLength(2);
    });

    it('rechaza lo que no es numero', () => {
      for (const valor of ['5', null, undefined, {}, [], Number.NaN]) {
        expect(problemasCantidad(valor, NO_NEGATIVA)).toEqual([
          'La cantidad debe ser un numero',
        ]);
      }
    });

    it('rechaza Infinity', () => {
      expect(problemasCantidad(Number.POSITIVE_INFINITY, NO_NEGATIVA)).toEqual([
        'La cantidad debe ser un numero',
      ]);
      expect(problemasCantidad(Number.NEGATIVE_INFINITY, NO_NEGATIVA)).toEqual([
        'La cantidad debe ser un numero',
      ]);
    });

    it('devuelve mensajes utilizables como cuerpo de un 400', () => {
      for (const problemas of [
        problemasCantidad(-1, NO_NEGATIVA),
        problemasCantidad(1.234, NO_NEGATIVA),
        problemasCantidad('x', POSITIVA),
      ]) {
        expect(problemas.length).toBeGreaterThan(0);
        expect(problemas.every((p) => p.length > 0)).toBe(true);
      }
    });
  });

  describe('esCantidadValida', () => {
    it('acepta los validos', () => {
      expect(esCantidadValida(0, NO_NEGATIVA)).toBe(true);
      expect(esCantidadValida(10.25, POSITIVA)).toBe(true);
      expect(esCantidadValida(CANTIDAD_MAXIMA, NO_NEGATIVA)).toBe(true);
    });

    it('rechaza los invalidos', () => {
      expect(esCantidadValida(-0.01, NO_NEGATIVA)).toBe(false);
      expect(esCantidadValida(0, POSITIVA)).toBe(false);
      expect(esCantidadValida(1.001, NO_NEGATIVA)).toBe(false);
      expect(esCantidadValida('5', NO_NEGATIVA)).toBe(false);
    });

    it('coincide con problemasCantidad vacio', () => {
      const muestras: unknown[] = [0, -1, 0.01, 1.234, 10.25, '5', null];

      for (const muestra of muestras) {
        expect(esCantidadValida(muestra, NO_NEGATIVA)).toBe(
          problemasCantidad(muestra, NO_NEGATIVA).length === 0,
        );
      }
    });
  });

  describe('aCentimos', () => {
    it('convierte numeros a centimos', () => {
      expect(aCentimos(0)).toBe(0);
      expect(aCentimos(1)).toBe(100);
      expect(aCentimos(1.5)).toBe(150);
      expect(aCentimos(10.25)).toBe(1025);
      expect(aCentimos(-1.5)).toBe(-150);
    });

    it('convierte texto con dos decimales', () => {
      expect(aCentimos('0.00')).toBe(0);
      expect(aCentimos('2.50')).toBe(250);
      expect(aCentimos('12.34')).toBe(1234);
      expect(aCentimos('-12.34')).toBe(-1234);
    });

    it('rellena con ceros cuando el texto trae menos decimales', () => {
      expect(aCentimos('3')).toBe(300);
      expect(aCentimos('3.1')).toBe(310);
      expect(aCentimos('3.10')).toBe(310);
    });

    it('devuelve el mismo centimos para el numero y su texto', () => {
      for (const valor of [0, 1, 1.5, 10.25, 9999999999.99]) {
        expect(aCentimos(cantidadATexto(valor))).toBe(aCentimos(valor));
      }
    });

    it('devuelve NaN con lo que no es decimal valido', () => {
      expect(aCentimos('abc')).toBeNaN();
      expect(aCentimos('')).toBeNaN();
      expect(aCentimos('1,5')).toBeNaN();
      expect(aCentimos('1.234')).toBeNaN();
      expect(aCentimos(Number.NaN)).toBeNaN();
      expect(aCentimos(Number.POSITIVE_INFINITY)).toBeNaN();
    });

    it('no pierde precision en el maximo de la columna', () => {
      expect(aCentimos(CANTIDAD_MAXIMA)).toBe(999999999999);
      expect(Number.isSafeInteger(aCentimos(CANTIDAD_MAXIMA))).toBe(true);
    });
  });

  describe('centimosATexto', () => {
    it('escribe siempre dos decimales', () => {
      expect(centimosATexto(0)).toBe('0.00');
      expect(centimosATexto(100)).toBe('1.00');
      expect(centimosATexto(150)).toBe('1.50');
      expect(centimosATexto(1234)).toBe('12.34');
    });

    it('escribe el signo delante', () => {
      expect(centimosATexto(-150)).toBe('-1.50');
      expect(centimosATexto(-5)).toBe('-0.05');
    });

    it('va y vuelve con aCentimos', () => {
      for (const centimos of [0, 1, 99, 100, 1234, -1234, 999999999999]) {
        expect(aCentimos(centimosATexto(centimos))).toBe(centimos);
      }
    });
  });

  describe('cantidadATexto', () => {
    it('fija exactamente dos decimales', () => {
      expect(cantidadATexto(10)).toBe('10.00');
      expect(cantidadATexto(10.5)).toBe('10.50');
      expect(cantidadATexto(0.01)).toBe('0.01');
    });

    it('redondea a dos decimales', () => {
      expect(cantidadATexto(10.456)).toBe('10.46');
    });

    it('respeta CANTIDAD_DECIMALES', () => {
      expect(cantidadATexto(1).split('.')[1]).toHaveLength(CANTIDAD_DECIMALES);
    });
  });

  describe('compararCantidades', () => {
    it('detecta menor, igual y mayor', () => {
      expect(compararCantidades(1, 2)).toBe(-1);
      expect(compararCantidades(2, 2)).toBe(0);
      expect(compararCantidades(3, 2)).toBe(1);
    });

    it('compara con la precision de la columna', () => {
      expect(compararCantidades('10.00', '9.99')).toBe(1);
      expect(compararCantidades('0.30', '0.3')).toBe(0);
    });

    it('el resultado no depende de la representacion binaria', () => {
      // 0.1 + 0.2 en binario vale 0.30000000000000004, mas que 0.3. Con
      // céntimos las dos son 30.
      expect(0.1 + 0.2).toBeGreaterThan(0.3);
      expect(compararCantidades(0.1 + 0.2, 0.3)).toBe(0);
    });

    it('compara negativos de forma coherente', () => {
      expect(compararCantidades(-2, -1)).toBe(-1);
      expect(compararCantidades(-1, -1)).toBe(0);
      expect(compararCantidades(-1, -2)).toBe(1);
    });
  });

  describe('mismaCantidad', () => {
    it('trata como iguales las que coinciden en centimos', () => {
      expect(mismaCantidad(1.5, '1.50')).toBe(true);
      expect(mismaCantidad('0.00', 0)).toBe(true);
    });

    it('distingue las que no coinciden', () => {
      expect(mismaCantidad(1.5, '1.51')).toBe(false);
      expect(mismaCantidad(0, -0.01)).toBe(false);
    });
  });

  describe('calcularDiferencia', () => {
    it('es fisico menos sistema', () => {
      expect(calcularDiferencia(10, 4)).toBe('6.00');
      expect(calcularDiferencia(4, 10)).toBe('-6.00');
    });

    it('devuelve siempre dos decimales', () => {
      expect(calcularDiferencia(10, 4.5)).toBe('5.50');
      expect(calcularDiferencia(3, 1)).toBe('2.00');
    });

    it('da cero cuando coinciden', () => {
      expect(calcularDiferencia(10, 10)).toBe('0.00');
      expect(calcularDiferencia('2.50', 2.5)).toBe('0.00');
    });

    it('funciona entre el numero que llega por HTTP y el texto de la base', () => {
      expect(calcularDiferencia('12.34', '10.00')).toBe('2.34');
    });

    it('lanza si recibe algo que no es decimal, en vez de devolver NaN', () => {
      expect(() => calcularDiferencia('abc', 1)).toThrow();
      expect(() => calcularDiferencia(1, Number.NaN)).toThrow();
      expect(() => calcularDiferencia('1.234', 1)).toThrow();
    });
  });

  describe('diferenciaEsCero', () => {
    it('reconoce el cero con cualquier signo', () => {
      expect(diferenciaEsCero('0.00')).toBe(true);
      expect(diferenciaEsCero('-0.00')).toBe(true);
      expect(diferenciaEsCero('0')).toBe(true);
    });

    it('reconoce el cero real, no el redondeado', () => {
      expect(diferenciaEsCero('0.01')).toBe(false);
      expect(diferenciaEsCero('-0.01')).toBe(false);
    });
  });
});
