// Comprobacion de que la aplicacion de pruebas esta configurada como la real.
//
// Usa el mismo `crearAppDePruebas` que el resto de suites, de modo que si
// `configureApp` dejara de aplicar el prefijo global o el ValidationPipe, este
// test lo detectaria en lugar de dar por buena una configuracion que solo existe
// en el entono de pruebas.
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearAppDePruebas } from './utils/crear-app-pruebas';
import { cerrarClientePrueba, clientePrueba, resetDatabase } from './utils/reset-database';
import { NOMBRE_BASE_PRUEBAS } from './utils/url-base-pruebas';
import { PrismaService } from '../src/database/prisma.service';

describe('App (e2e)', () => {
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

  it('responde en la ruta con prefijo global', async () => {
    await request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });

  it('no expone la ruta sin prefijo', async () => {
    // Confirma que el prefijo se aplica de verdad y no por casualidad.
    await request(app.getHttpServer()).get('/').expect(404);
  });

  it('aplica el ValidationPipe global: cuerpo sin validar da 400', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ correo: 'no-es-el-campo-esperado' })
      .expect(400);
  });

  it('la aplicacion apunta a la base de pruebas', async () => {
    const prisma = app.get(PrismaService);
    const [{ db }] = await prisma.$queryRawUnsafe<{ db: string }[]>(
      'SELECT current_database() AS db',
    );

    expect(db).toBe(NOMBRE_BASE_PRUEBAS);
  });
});