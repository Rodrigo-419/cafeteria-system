// Pruebas end-to-end del control de intentos fallidos de login.
//
// Comprueban la consecuencia real del rediseno: solo cuentan los fallos, un
// login correcto no consume cupo, y el bloqueo se libera al vencer la ventana.
// Se usa un RELOJ SIMULADO (via `crearAppDePruebas`) para no esperar minutos
// reales, y `TRUST_PROXY=true` con `X-Forwarded-For` para que cada caso use una
// IP propia y no se contamine con los demas.
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
  PASSWORD_VALIDA_PRUEBAS,
} from './utils/constantes-pruebas';
import {
  MAX_FALLOS_POR_IP,
  MAX_FALLOS_POR_USUARIO_IP,
  VENTANA_INTENTOS_MS,
} from '../src/modules/auth/application/login-throttle.service';

const RUTA_LOGIN = '/api/auth/login';
const PASSWORD_MALA = 'EstaNoEsLaContrasena2026!';

describe('limite de intentos de login (e2e)', () => {
  let app: INestApplication;
  let ahora: number;

  const reloj = () => ahora;

  beforeAll(async () => {
    ahora = 1_700_000_000_000;
    app = await crearAppDePruebas({
      reloj,
      neutroLoginThrottle: false,
      trustProxy: 'true',
    });
  });

  beforeEach(async () => {
    await resetDatabase(clientePrueba());
  });

  afterAll(async () => {
    await app.close();
    await cerrarClientePrueba();
  });

  function login(nombreUsuario: string, password: string, ip: string) {
    return request(app.getHttpServer())
      .post(RUTA_LOGIN)
      .set('X-Forwarded-For', ip)
      .send({ nombreUsuario, password });
  }

  async function fallarLogin(
    nombreUsuario: string,
    ip: string,
    cantidad: number,
  ): Promise<void> {
    for (let intento = 0; intento < cantidad; intento += 1) {
      await login(nombreUsuario, PASSWORD_MALA, ip).expect(401);
    }
  }

  it('los logins correctos no consumen cupo: cambiar de cuenta muchas veces', async () => {
    const ip = '10.10.0.1';

    for (let intento = 0; intento < 10; intento += 1) {
      await login(
        ADMIN_USUARIO_PRUEBAS,
        ADMIN_PASSWORD_PRUEBAS,
        ip,
      ).expect(200);
    }
  });

  it('tras los fallos permitidos, la cuenta queda bloqueada incluso con la contrasena correcta', async () => {
    const ip = '10.10.0.2';
    await fallarLogin(ADMIN_USUARIO_PRUEBAS, ip, MAX_FALLOS_POR_USUARIO_IP);

    const bloqueado = await login(
      ADMIN_USUARIO_PRUEBAS,
      ADMIN_PASSWORD_PRUEBAS,
      ip,
    ).expect(429);

    const retryAfter = Number(bloqueado.headers['retry-after']);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(VENTANA_INTENTOS_MS / 1000);
    expect(bloqueado.body.message).toContain('Demasiados intentos');
    expect(bloqueado.body.message).toContain('segundos');
  });

  it('una cuenta inexistente cuenta igual y produce el mismo bloqueo', async () => {
    const ip = '10.10.0.3';
    await fallarLogin('cuenta-inexistente', ip, MAX_FALLOS_POR_USUARIO_IP);

    const bloqueado = await login(
      'cuenta-inexistente',
      PASSWORD_VALIDA_PRUEBAS,
      ip,
    ).expect(429);

    expect(bloqueado.body.message).toContain('Demasiados intentos');
  });

  it('el bloqueo de una cuenta no afecta a otra desde la misma IP', async () => {
    const ip = '10.10.0.4';
    await fallarLogin('cuenta-bloqueada', ip, MAX_FALLOS_POR_USUARIO_IP);

    await login(ADMIN_USUARIO_PRUEBAS, ADMIN_PASSWORD_PRUEBAS, ip).expect(200);
  });

  it('bloquea la IP al probar demasiados usuarios distintos', async () => {
    const ip = '10.10.0.5';

    for (let intento = 0; intento < MAX_FALLOS_POR_IP; intento += 1) {
      await login(`usuario-falso-${intento}`, PASSWORD_MALA, ip).expect(401);
    }

    await login(ADMIN_USUARIO_PRUEBAS, ADMIN_PASSWORD_PRUEBAS, ip).expect(429);
  });

  it('al vencer la ventana se puede volver a iniciar sesion', async () => {
    const ip = '10.10.0.6';
    await fallarLogin(ADMIN_USUARIO_PRUEBAS, ip, MAX_FALLOS_POR_USUARIO_IP);

    await login(ADMIN_USUARIO_PRUEBAS, ADMIN_PASSWORD_PRUEBAS, ip).expect(429);

    ahora += VENTANA_INTENTOS_MS;

    await login(ADMIN_USUARIO_PRUEBAS, ADMIN_PASSWORD_PRUEBAS, ip).expect(200);
  });
});
