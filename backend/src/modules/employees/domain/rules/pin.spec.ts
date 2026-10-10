import { LONGITUD_PIN, esPinValido, generarPin } from './pin';

describe('PIN', () => {
  describe('generarPin', () => {
    it('rellena con ceros a la izquierda hasta seis digitos', () => {
      expect(generarPin(() => 42)).toBe('000042');
      expect(generarPin(() => 0)).toBe('000000');
    });

    it('no altera un PIN que ya tiene seis digitos', () => {
      expect(generarPin(() => 999999)).toBe('999999');
      expect(generarPin(() => 100000)).toBe('100000');
    });

    it('produce siempre un PIN valido con la fuente real', () => {
      for (let i = 0; i < 50; i += 1) {
        expect(esPinValido(generarPin())).toBe(true);
      }
    });
  });

  describe('esPinValido', () => {
    it('acepta exactamente seis digitos, ceros incluidos', () => {
      expect(esPinValido('000000')).toBe(true);
      expect(esPinValido('123456')).toBe(true);
    });

    it('rechaza longitudes distintas, letras y otros tipos', () => {
      expect(esPinValido('12345')).toBe(false);
      expect(esPinValido('1234567')).toBe(false);
      expect(esPinValido('12345a')).toBe(false);
      expect(esPinValido(' 123456')).toBe(false);
      expect(esPinValido(123456)).toBe(false);
      expect(esPinValido(null)).toBe(false);
      expect(esPinValido(undefined)).toBe(false);
    });

    it('la longitud declarada es seis', () => {
      expect(LONGITUD_PIN).toBe(6);
    });
  });
});
