import {
  asegurarEntornoDemo,
  esEntornoProduccion,
  leerPasswordDemo,
  VARIABLE_PASSWORD_DEMO,
} from './seed-demo-ambiente';

describe('seed de demostracion: reglas de entorno', () => {
  describe('asegurarEntornoDemo', () => {
    it('rechaza la ejecucion en produccion', () => {
      expect(() => asegurarEntornoDemo('production')).toThrow(/production/i);
    });

    it('permite desarrollo, pruebas y un entorno sin definir', () => {
      expect(() => asegurarEntornoDemo('development')).not.toThrow();
      expect(() => asegurarEntornoDemo('test')).not.toThrow();
      expect(() => asegurarEntornoDemo(undefined)).not.toThrow();
    });
  });

  describe('esEntornoProduccion', () => {
    it('solo reconoce production como produccion', () => {
      expect(esEntornoProduccion('production')).toBe(true);
      expect(esEntornoProduccion('Production')).toBe(false);
      expect(esEntornoProduccion('development')).toBe(false);
      expect(esEntornoProduccion(undefined)).toBe(false);
    });
  });

  describe('leerPasswordDemo', () => {
    it('exige que la variable este definida', () => {
      expect(() => leerPasswordDemo({})).toThrow(VARIABLE_PASSWORD_DEMO);
    });

    it('trata la cadena vacia como ausente', () => {
      expect(() =>
        leerPasswordDemo({ [VARIABLE_PASSWORD_DEMO]: '' }),
      ).toThrow(VARIABLE_PASSWORD_DEMO);
    });

    it('rechaza una contrasena demasiado corta', () => {
      expect(() =>
        leerPasswordDemo({ [VARIABLE_PASSWORD_DEMO]: 'corta' }),
      ).toThrow(/politica de seguridad/i);
    });

    it('no revela el valor de la contrasena en el mensaje de error', () => {
      // 80 bytes ASCII: supera el maximo de bcrypt (72) y falla la validacion.
      const secreto = 'x'.repeat(80);

      try {
        leerPasswordDemo({ [VARIABLE_PASSWORD_DEMO]: secreto });
        throw new Error('Se esperaba un fallo de validacion');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).not.toContain(secreto);
      }
    });

    it('acepta y devuelve una contrasena valida', () => {
      const password = 'clave-demostracion-123';

      expect(leerPasswordDemo({ [VARIABLE_PASSWORD_DEMO]: password })).toBe(
        password,
      );
    });
  });
});
