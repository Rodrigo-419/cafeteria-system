// Pruebas unitarias de la traduccion de `TRUST_PROXY` y `CORS_ORIGIN`.
//
// Ambas funciones son puras; no se levanta ninguna app. La integracion real con
// el throttler (que la IP de `X-Forwarded-For` cuente o no) se cubre en
// `test/trust-proxy.e2e-spec.ts`, y la de CORS en `test/cors.e2e-spec.ts`.
import { interpretarCorsOrigin, interpretarTrustProxy } from './app.setup';

describe('interpretarTrustProxy', () => {
  it('desactiva la confianza cuando el valor es vacio o ausente', () => {
    expect(interpretarTrustProxy(undefined)).toBe(false);
    expect(interpretarTrustProxy('')).toBe(false);
    expect(interpretarTrustProxy('   ')).toBe(false);
  });

  it('reconoce los alias de "desactivado"', () => {
    expect(interpretarTrustProxy('false')).toBe(false);
    expect(interpretarTrustProxy('FALSE')).toBe(false);
    expect(interpretarTrustProxy('off')).toBe(false);
    expect(interpretarTrustProxy('0')).toBe(false);
  });

  it('reconoce los alias de "activado"', () => {
    expect(interpretarTrustProxy('true')).toBe(true);
    expect(interpretarTrustProxy('TRUE')).toBe(true);
    expect(interpretarTrustProxy('on')).toBe(true);
  });

  it('interpreta un entero como numero de saltos', () => {
    expect(interpretarTrustProxy('1')).toBe(1);
    expect(interpretarTrustProxy('2')).toBe(2);
    expect(interpretarTrustProxy('0')).toBe(false);
  });

  it('pasa las palabras clave y subredes tal cual (normalizadas)', () => {
    expect(interpretarTrustProxy('loopback')).toBe('loopback');
    expect(interpretarTrustProxy('10.0.0.0/8')).toBe('10.0.0.0/8');
    expect(interpretarTrustProxy('Loopback')).toBe('loopback');
  });
});

describe('interpretarCorsOrigin', () => {
  it('no permite ningun origen cuando la variable esta ausente o vacia', () => {
    expect(interpretarCorsOrigin(undefined)).toEqual([]);
    expect(interpretarCorsOrigin('')).toEqual([]);
    expect(interpretarCorsOrigin('   ')).toEqual([]);
  });

  it('separa por comas y recorta los espacios', () => {
    expect(
      interpretarCorsOrigin('http://localhost:5173, http://localhost:4173'),
    ).toEqual(['http://localhost:5173', 'http://localhost:4173']);
  });

  it('descarta los tramos vacios de comas colgantes', () => {
    expect(interpretarCorsOrigin('http://localhost:5173,,')).toEqual([
      'http://localhost:5173',
    ]);
    expect(interpretarCorsOrigin(',')).toEqual([]);
  });
});
