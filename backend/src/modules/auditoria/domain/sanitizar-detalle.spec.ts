import { sanitizarDetalle } from './sanitizar-detalle';

describe('sanitizarDetalle', () => {
  describe('lado prohibido: lanza', () => {
    it.each([
      'password',
      'contrasena',
      'contraseña',
      'hash',
      'pin',
      'pinHash',
      'passwordHash',
      'secret',
      'token',
    ])('rechaza la clave "%s"', (clave) => {
      expect(() => sanitizarDetalle({ [clave]: 'algun-valor' })).toThrow();
    });

    it('rechaza una clave prohibida anidada en un objeto', () => {
      expect(() =>
        sanitizarDetalle({ despues: { usuario: { password: 'x' } } }),
      ).toThrow(/password/u);
    });

    it('rechaza una clave prohibida dentro de un array', () => {
      expect(() =>
        sanitizarDetalle({ cambios: [{ pin: '1234' }] }),
      ).toThrow();
    });

    it('normaliza mayusculas: "PASSWORD" tambien se rechaza', () => {
      expect(() => sanitizarDetalle({ PASSWORD: 'x' })).toThrow();
    });
  });

  describe('lado legitimo: pasa', () => {
    it('deja pasar claves que solo contienen "pin" como substring', () => {
      const entrada = {
        mapping: 'producto',
        shipping: 12,
        pinIntentos: 0,
      };

      expect(sanitizarDetalle(entrada)).toEqual(entrada);
    });

    it('conserva primitivos, arrays y anidamiento', () => {
      const entrada = {
        antes: { cargo: 'Cajero', sueldo: null },
        despues: { cargo: 'Supervisor' },
        etiquetas: ['a', 'b'],
      };

      expect(sanitizarDetalle(entrada)).toEqual(entrada);
    });

    it('no convierte un Date en objeto vacio', () => {
      const fecha = new Date('2026-10-13T00:00:00.000Z');

      expect(sanitizarDetalle({ fecha })).toEqual({ fecha });
    });

    it('devuelve una copia nueva (no comparte referencias)', () => {
      const interno = { cargo: 'Cajero' };
      const entrada = { antes: interno };

      const salida = sanitizarDetalle(entrada) as { antes: unknown };

      expect(salida.antes).toEqual(interno);
      expect(salida.antes).not.toBe(interno);
    });
  });
});
