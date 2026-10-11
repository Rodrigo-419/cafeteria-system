// Pruebas end-to-end de la configuracion CORS.
//
// Comprueban la consecuencia real de `CORS_ORIGIN`: que solo los origenes
// declarados reciben `Access-Control-Allow-Origin`, y que sin la variable
// ningun origen lo recibe (default seguro).
//
// Como en `trust-proxy.e2e-spec.ts`, aqui NO se usa `crearAppDePruebas` porque
// esa funcion llama a `configureApp` sin opciones; se necesita pasar el valor
// de `CORS_ORIGIN` y ademas el throttler real es irrelevante, pero montar la
// app a mano deja explicito el valor bajo prueba. El entorno (base y secreto
// JWT) lo fijo `test/entorno-pruebas.ts` via `setupFiles`.
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

const RUTA_RAIZ = '/api';
const ORIGEN_PERMITIDO = 'http://localhost:5173';
const ORIGEN_AJENO = 'http://malicioso.example';

/** Levanta la app real con el valor de `CORS_ORIGIN` indicado. */
async function crearAppConCors(
  corsOrigin: string | undefined,
): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app, { corsOrigin });

  await app.init();
  await app.listen(0);

  return app;
}

describe('CORS (e2e)', () => {
  describe('con CORS_ORIGIN declarado', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await crearAppConCors(`${ORIGEN_PERMITIDO}, http://localhost:4173`);
    });

    afterAll(async () => {
      await app.close();
    });

    it('responde con el origen permitido en Access-Control-Allow-Origin', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(RUTA_RAIZ)
        .set('Origin', ORIGEN_PERMITIDO);

      expect(respuesta.status).toBe(200);
      expect(respuesta.headers['access-control-allow-origin']).toBe(
        ORIGEN_PERMITIDO,
      );
    });

    it('no permite un origen no listado', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(RUTA_RAIZ)
        .set('Origin', ORIGEN_AJENO);

      expect(
        respuesta.headers['access-control-allow-origin'],
      ).toBeUndefined();
    });

    it('responde al preflight con Authorization entre las cabeceras permitidas', async () => {
      const respuesta = await request(app.getHttpServer())
        .options(RUTA_RAIZ)
        .set('Origin', ORIGEN_PERMITIDO)
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'authorization');

      expect(respuesta.status).toBe(204);
      expect(respuesta.headers['access-control-allow-origin']).toBe(
        ORIGEN_PERMITIDO,
      );
      expect(
        String(respuesta.headers['access-control-allow-headers']),
      ).toContain('Authorization');
    });
  });

  describe('sin CORS_ORIGIN (valor por defecto)', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await crearAppConCors(undefined);
    });

    afterAll(async () => {
      await app.close();
    });

    it('no permite ningun origen', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(RUTA_RAIZ)
        .set('Origin', ORIGEN_PERMITIDO);

      expect(respuesta.status).toBe(200);
      expect(
        respuesta.headers['access-control-allow-origin'],
      ).toBeUndefined();
    });
  });
});
