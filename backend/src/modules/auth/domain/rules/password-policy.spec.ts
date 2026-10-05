import {
  esPasswordValida,
  LONGITUD_MAXIMA_BYTES_PASSWORD,
  LONGITUD_MINIMA_PASSWORD,
  validarPassword,
} from './password-policy';

describe('password-policy', () => {
  describe('longitud minima', () => {
    it('acepta una contrasena de exactamente 12 caracteres', () => {
      const password = 'a'.repeat(LONGITUD_MINIMA_PASSWORD);

      expect(validarPassword(password)).toEqual([]);
      expect(esPasswordValida(password)).toBe(true);
    });

    it('rechaza una contrasena de 11 caracteres', () => {
      const password = 'a'.repeat(LONGITUD_MINIMA_PASSWORD - 1);

      expect(esPasswordValida(password)).toBe(false);
      expect(validarPassword(password)).toHaveLength(1);
      expect(validarPassword(password)[0]).toContain('al menos 12 caracteres');
    });

    it('rechaza una contrasena vacia', () => {
      expect(esPasswordValida('')).toBe(false);
    });
  });

  describe('longitud maxima en bytes', () => {
    it('acepta una contrasena ASCII de exactamente 72 bytes', () => {
      const password = 'a'.repeat(LONGITUD_MAXIMA_BYTES_PASSWORD);

      expect(Buffer.byteLength(password, 'utf8')).toBe(72);
      expect(validarPassword(password)).toEqual([]);
    });

    it('rechaza una contrasena ASCII de 73 bytes', () => {
      const password = 'a'.repeat(LONGITUD_MAXIMA_BYTES_PASSWORD + 1);

      expect(esPasswordValida(password)).toBe(false);
      expect(validarPassword(password)[0]).toContain('72 bytes');
    });

    it('mide en bytes UTF-8 y no en caracteres', () => {
      // Cada emoji ocupa 4 bytes en UTF-8 y 2 unidades UTF-16: 18 emojis =
      // 72 bytes, que es justo el limite, pero 36 unidades de cadena.
      const password = '\u{1F600}'.repeat(18);
      expect(password).toHaveLength(36);
      expect(Buffer.byteLength(password, 'utf8')).toBe(72);
      expect(validarPassword(password)).toEqual([]);

      const passwordConUnByteMas = '\u{1F600}'.repeat(18) + 'a';
      expect(Buffer.byteLength(passwordConUnByteMas, 'utf8')).toBe(73);
      expect(esPasswordValida(passwordConUnByteMas)).toBe(false);
    });

    it('acepta caracteres multibyte que caben en 72 bytes', () => {
      // "a" + acento combinante: 3 bytes por cada par, 24 pares = 72 bytes.
      const password = 'a\u0301'.repeat(24);
      expect(Buffer.byteLength(password, 'utf8')).toBe(72);
      expect(password.length).toBeGreaterThanOrEqual(LONGITUD_MINIMA_PASSWORD);
      expect(validarPassword(password)).toEqual([]);

      expect(esPasswordValida('a\u0301'.repeat(25))).toBe(false);
    });
  });

  it('devuelve todos los problemas a la vez', () => {
    // Corta en caracteres y larga en bytes no puede ocurrir a la vez, asi que
    // se comprueban los dos limites por separado.
    expect(validarPassword('corta')).toHaveLength(1);
    expect(validarPassword('a'.repeat(80))).toHaveLength(1);
  });

  it('no aplica limites al login (la politica es solo de contrasenas nuevas)', () => {
    // El login nunca llama a esta funcion: la contrasena corta es legitima
    // para usuarios creados antes de que existiera la regla.
    expect(esPasswordValida('123')).toBe(false);
  });
});