import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearAppDePruebas } from './utils/crear-app-pruebas';
import { cerrarClientePrueba, clientePrueba, resetDatabase } from './utils/reset-database';

describe('Exports (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await crearAppDePruebas();
  });

  beforeEach(async () => {
    await resetDatabase(clientePrueba());
  });

  afterAll(async () => {
    await app.close();
    await cerrarClientePrueba();
  });

  it('sin token -> 401', async () => {
    await request(app.getHttpServer())
      .post('/api/exports')
      .send({ conjunto: 'ventas', formato: 'xlsx' })
      .expect(401);
  });
});
