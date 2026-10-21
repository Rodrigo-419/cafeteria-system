// Pruebas de la validacion de variables de entorno.
//
// El arranque debe fallar de forma clara si falta alguna variable obligatoria,
// y NUNCA mostrar los valores recibidos (la `DATABASE_URL` incluye la clave y
// `JWT_SECRET` es un secreto). Estas pruebas fijan ese comportamiento.
import { validate } from './env.config';

const URL_VALIDA =
  'postgresql://usuario:clave-supersecreta@localhost:5432/cafeteria_db?schema=public';
const SECRETO_VALIDO = 'x'.repeat(48);

function configBase(sobre: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    DATABASE_URL: URL_VALIDA,
    JWT_SECRET: SECRETO_VALIDO,
    ...sobre,
  };
}

describe('validate (variables de entorno)', () => {
  it('aplica los valores por defecto seguros', () => {
    const config = validate(configBase());

    expect(config.PORT).toBe(3000);
    expect(config.NODE_ENV).toBe('development');
    expect(config.JWT_EXPIRES_IN).toBe('8h');
    expect(config.TRUST_PROXY).toBe('false');
    expect(config.CORS_ORIGIN).toBe('');
  });

  it('acepta produccion con todos los secretos presentes', () => {
    const config = validate(configBase({ NODE_ENV: 'production' }));

    expect(config.NODE_ENV).toBe('production');
  });

  it('no define ningun secreto por defecto en produccion', () => {
    // Sin JWT_SECRET ni DATABASE_URL no hay arranque, ni siquiera en produccion.
    expect(() => validate({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() =>
      validate({ NODE_ENV: 'production', JWT_SECRET: SECRETO_VALIDO }),
    ).toThrow(/DATABASE_URL/);
  });

  it('exige DATABASE_URL y nombra la variable en el error', () => {
    try {
      validate({ JWT_SECRET: SECRETO_VALIDO });
      throw new Error('Se esperaba un fallo de validacion');
    } catch (error) {
      const mensaje = (error as Error).message;
      expect(mensaje).toContain('DATABASE_URL');
      expect(mensaje).toContain('no puede arrancar');
    }
  });

  it('exige JWT_SECRET de al menos 32 caracteres', () => {
    expect(() => validate(configBase({ JWT_SECRET: 'corto' }))).toThrow(
      /JWT_SECRET/,
    );
  });

  it('rechaza un NODE_ENV desconocido', () => {
    expect(() => validate(configBase({ NODE_ENV: 'staging' }))).toThrow(
      /NODE_ENV/,
    );
  });

  it('no muestra la DATABASE_URL ni el JWT_SECRET en el error', () => {
    const mensajeDe = (config: Record<string, unknown>): string => {
      try {
        validate(config);
        throw new Error('Se esperaba un fallo de validacion');
      } catch (error) {
        return (error as Error).message;
      }
    };

    const sinJwt = mensajeDe({ DATABASE_URL: URL_VALIDA });
    expect(sinJwt).not.toContain('clave-supersecreta');

    const sinUrl = mensajeDe({ JWT_SECRET: SECRETO_VALIDO });
    expect(sinUrl).not.toContain(SECRETO_VALIDO);
  });

  it('el mensaje apunta a backend/.env sin volcar valores', () => {
    try {
      validate({});
      throw new Error('Se esperaba un fallo de validacion');
    } catch (error) {
      const mensaje = (error as Error).message;
      expect(mensaje).toContain('backend/.env');
      expect(mensaje).toContain('no se muestran');
    }
  });
});
