// Pruebas end-to-end del modulo de autenticacion.
//
// Se ejercita la ruta real (HTTP + guards + Prisma + seed) contra la base de
// pruebas. No se comprueba aqui la logica interna del caso de uso, que ya
// cubren las pruebas unitarias.
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearAppDePruebas } from './utils/crear-app-pruebas';
import {
  cerrarClientePrueba,
  clientePrueba,
  resetDatabase,
} from './utils/reset-database';
import {
  ADMIN_PASSWORD_PRUEBAS,
  ADMIN_USUARIO_PRUEBAS,
} from './utils/constantes-pruebas';
import { como, iniciarSesion, type RespuestaLogin } from './utils/http-pruebas';
import { NOMBRE_BASE_PRUEBAS } from './utils/url-base-pruebas';
import { PrismaService } from '../src/database/prisma.service';

// Mismo texto para "contrasena incorrecta" y "usuario inexistente": no debe
// revelar si el usuario esta registrado.
const MENSAJE_CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos';

describe('auth (e2e)', () => {
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

  describe('POST /api/auth/login', () => {
    it('la aplicacion esta conectada a la base de pruebas, no a la de desarrollo', async () => {
      // Guarda contra el error mas grave posible en una suite e2e: que el
      // ConfigService resuelva DATABASE_URL antes de que las pruebas la
      // cambien y toda la suite se ejecute contra cafeteria_db.
      const appPrisma = app.get(PrismaService);
      const [{ db: dbDeLaApp }] = await appPrisma.$queryRawUnsafe<
        { db: string }[]
      >('SELECT current_database() AS db');

      expect(dbDeLaApp).toBe(NOMBRE_BASE_PRUEBAS);
      expect(dbDeLaApp.endsWith('_test')).toBe(true);
    });

    it('acepta credenciales validas y devuelve token y permisos del Admin', async () => {
      const respuesta = await iniciarSesion(
        app,
        ADMIN_USUARIO_PRUEBAS,
        ADMIN_PASSWORD_PRUEBAS,
      ).expect(200);

      const body = respuesta.body as RespuestaLogin;

      expect(typeof body.accessToken).toBe('string');
      expect(body.accessToken.length).toBeGreaterThan(20);
      expect(body.tokenType).toBe('Bearer');
      expect(typeof body.expiresIn).toBe('number');

      expect(body.user.nombreUsuario).toBe(ADMIN_USUARIO_PRUEBAS);
      expect(body.user.rol).toBe('Admin');
      // El Admin no pertenece a ninguna sucursal.
      expect(body.user.sucursalId).toBeNull();
      // La respuesta jamas incluye el campo `email`.
      expect((body.user as Record<string, unknown>).email).toBeUndefined();
    });

    it('devuelve exactamente 20 permisos al Admin', async () => {
      // El seed concede 24 permisos; cuatro son exclusivos de Gerente
      // (productos.precio.editar, ventas.registrar, ventas.anular y
      // asistencia.corregir), asi que al Admin le tocan los otros 20.
      const respuesta = await iniciarSesion(
        app,
        ADMIN_USUARIO_PRUEBAS,
        ADMIN_PASSWORD_PRUEBAS,
      ).expect(200);

      const body = respuesta.body as RespuestaLogin;

      expect(body.user.permisos).toHaveLength(20);
      expect(body.user.permisos).toContain('usuarios.crear_editar');
      expect(body.user.permisos).toContain('permisos.asignar');
      expect(body.user.permisos).not.toContain('asistencia.corregir');
    });

    it('rechaza una contrasena erronea con 401', async () => {
      const respuesta = await iniciarSesion(
        app,
        ADMIN_USUARIO_PRUEBAS,
        'EstaNoEsLaContrasena2026!',
      ).expect(401);

      expect(respuesta.body.message).toBe(MENSAJE_CREDENCIALES_INVALIDAS);
      expect(respuesta.body.accessToken).toBeUndefined();
    });

    it('rechaza un usuario inexistente con 401 y el MISMO mensaje', async () => {
      const respuesta = await iniciarSesion(
        app,
        'nadie',
        ADMIN_PASSWORD_PRUEBAS,
      ).expect(401);

      expect(respuesta.body.message).toBe(MENSAJE_CREDENCIALES_INVALIDAS);
      expect(respuesta.body.accessToken).toBeUndefined();
    });

    it('normaliza el nombre de usuario: el mismo usuario puede entrar en mayusculas', async () => {
      const respuesta = await iniciarSesion(
        app,
        ADMIN_USUARIO_PRUEBAS.toUpperCase(),
        ADMIN_PASSWORD_PRUEBAS,
      ).expect(200);

      expect((respuesta.body as RespuestaLogin).user.nombreUsuario).toBe(
        ADMIN_USUARIO_PRUEBAS,
      );
    });

    it('rechaza un cuerpo invalido con 400', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ nombreUsuario: 'ab', password: 'x' })
        .expect(400);
    });

    it('rechaza el campo antiguo "email" con 400', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@cafeteria.test', password: ADMIN_PASSWORD_PRUEBAS })
        .expect(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('devuelve el usuario autenticado con su token', async () => {
      const token = (
        await iniciarSesion(app, ADMIN_USUARIO_PRUEBAS, ADMIN_PASSWORD_PRUEBAS).expect(
          200,
        )
      ).body.accessToken as string;

      const respuesta = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set(...como(token))
        .expect(200);

      expect(respuesta.body.nombreUsuario).toBe(ADMIN_USUARIO_PRUEBAS);
      expect(respuesta.body.rol).toBe('Admin');
      expect(respuesta.body.permisos).toHaveLength(20);
      // El hash jamas viaja en una respuesta, y tampoco el campo `email`.
      expect(respuesta.body.passwordHash).toBeUndefined();
      expect(respuesta.body.email).toBeUndefined();
    });

    it('responde 401 sin token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('responde 401 con un token invalido', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set(...como('este.token.no.es.valido'))
        .expect(401);
    });

    it('responde 401 tras bloquear a la cuenta', async () => {
      const token = await iniciarSesion(app, ADMIN_USUARIO_PRUEBAS, ADMIN_PASSWORD_PRUEBAS)
        .expect(200)
        .then((r) => r.body.accessToken as string);

      // Se bloquea al admin directamente en la base: la API prohibe que alguien
      // se bloquee a si mismo, asi que el caso se comprueba a nivel de datos.
      const prisma = clientePrueba();
      const admin = await prisma.usuario.findUniqueOrThrow({
        where: { nombreUsuario: ADMIN_USUARIO_PRUEBAS },
        select: { id: true },
      });
      await prisma.usuario.update({
        where: { id: admin.id },
        data: { estado: 'bloqueado' },
      });

      // El token anterior deja de valer porque el guard relee el usuario.
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set(...como(token))
        .expect(401);

      // Y tampoco se puede volver a iniciar sesion.
      await iniciarSesion(
        app,
        ADMIN_USUARIO_PRUEBAS,
        ADMIN_PASSWORD_PRUEBAS,
      ).expect(403);
    });
  });
});
