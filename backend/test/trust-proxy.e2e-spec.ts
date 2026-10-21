// Pruebas end-to-end de la configuracion `trust proxy`.
//
// Comprueban la consecuencia real de `TRUST_PROXY`: si el limite de intentos
// fallidos del login identifica al cliente por la IP del socket (por defecto) o
// por `X-Forwarded-For` (cuando se confia en el proxy).
//
// A diferencia del resto de suites, aqui NO se usa `crearAppDePruebas` en su
// forma neutra: esa funcion sustituye el control de intentos de login por uno
// que nunca bloquea, y justamente se necesita el real. Por eso cada app se
// construye a mano, sin el override, pasando el valor de `TRUST_PROXY` a
// `configureApp`.
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PASSWORD_DEBIL_PRUEBAS } from './utils/constantes-pruebas';

const RUTA_LOGIN = '/api/auth/login';
const USUARIO_INEXISTENTE = 'nadie';

/**
 * Levanta la app real conservando el control de intentos de login (sin el
 * override de las demas suites) y con el valor de `TRUST_PROXY` indicado. El
 * entorno (base y secreto JWT) ya lo fijo `test/entorno-pruebas.ts` via
 * `setupFiles`.
 */
async function crearAppConLimiteLoginReal(
  trustProxy: string,
): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app, { trustProxy });

  await app.init();
  await app.listen(0);

  return app;
}

/** Un login con credenciales inexistentes (401 si no esta bloqueado) desde `ip`. */
function intentoLogin(app: INestApplication, ip: string): request.Test {
  return request(app.getHttpServer())
    .post(RUTA_LOGIN)
    .set('X-Forwarded-For', ip)
    .send({ nombreUsuario: USUARIO_INEXISTENTE, password: PASSWORD_DEBIL_PRUEBAS });
}

/** Ejecuta `cantidad` intentos, con la IP que devuelve `ipDe(intento)`. */
async function serieDeIntentos(
  app: INestApplication,
  ipDe: (intento: number) => string,
  cantidad: number,
): Promise<number[]> {
  const estados: number[] = [];

  for (let intento = 0; intento < cantidad; intento += 1) {
    const respuesta = await intentoLogin(app, ipDe(intento));
    estados.push(respuesta.status);
  }

  return estados;
}

describe('trust proxy (e2e)', () => {
  describe('desactivado por defecto (TRUST_PROXY=false)', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await crearAppConLimiteLoginReal('false');
    });

    afterAll(async () => {
      await app.close();
    });

    it('ignora X-Forwarded-For: cambiar la IP declarada no evita el bloqueo', async () => {
      // Cada intento declara una IP distinta. Si se confiara en la cabecera,
      // ninguna se bloquearia; al ignorarla, todas comparten la IP del socket.
      const estados = await serieDeIntentos(
        app,
        (intento) => `10.0.0.${intento + 1}`,
        20,
      );

      expect(estados).toContain(429);
      expect(estados.every((estado) => estado === 401 || estado === 429)).toBe(
        true,
      );
    });
  });

  describe('activado (TRUST_PROXY=true)', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await crearAppConLimiteLoginReal('true');
    });

    afterAll(async () => {
      await app.close();
    });

    it('honra X-Forwarded-For: cada IP declarada tiene su propio limite', async () => {
      const estados = await serieDeIntentos(
        app,
        (intento) => `203.0.113.${intento + 1}`,
        20,
      );

      expect(estados).not.toContain(429);
      expect(estados.every((estado) => estado === 401)).toBe(true);
    });

    it('bloquea cuando se repite la misma IP declarada', async () => {
      const estados = await serieDeIntentos(
        app,
        () => '198.51.100.7',
        20,
      );

      expect(estados).toContain(429);
    });
  });

  // Render es un unico proxy inverso delante del servicio, asi que el valor
  // correcto es un salto ("1"), no "true" (que confiaria en todos los saltos).
  describe('con un salto (TRUST_PROXY=1, valor de Render)', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await crearAppConLimiteLoginReal('1');
    });

    afterAll(async () => {
      await app.close();
    });

    it('honra la IP del cliente declarada por el proxy', async () => {
      const estados = await serieDeIntentos(
        app,
        (intento) => `203.0.113.${intento + 1}`,
        20,
      );

      expect(estados).not.toContain(429);
      expect(estados.every((estado) => estado === 401)).toBe(true);
    });

    it('bloquea la IP del cliente cuando se repite', async () => {
      const estados = await serieDeIntentos(
        app,
        () => '198.51.100.9',
        20,
      );

      expect(estados).toContain(429);
    });
  });
});
