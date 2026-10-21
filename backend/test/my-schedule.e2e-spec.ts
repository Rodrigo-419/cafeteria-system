// Pruebas end-to-end del modulo MiHorario.
//
// Verifica que la ruta /api/my/schedule exige autenticacion, resuelve el
// empleado desde el token (no desde parametros), y devuelve el horario del
// rango pedido con las reglas de vigencia y cese.
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearAppDePruebas } from './utils/crear-app-pruebas';
import {
  cerrarClientePrueba,
  clientePrueba,
  resetDatabase,
} from './utils/reset-database';
import { como, iniciarSesion, tokenDeAdmin } from './utils/http-pruebas';
import {
  ADMIN_USUARIO_PRUEBAS,
  PASSWORD_VALIDA_PRUEBAS,
} from './utils/constantes-pruebas';
import {
  crearEmpleado,
  idsDeSucursales,
  type Sucursales,
} from './utils/fixtures-pruebas';

describe('mi-horario (e2e)', () => {
  let app: INestApplication;
  let admin: string;
  let sucursales: Sucursales;

  beforeAll(async () => {
    app = await crearAppDePruebas();
  });

  beforeEach(async () => {
    await resetDatabase(clientePrueba());
    admin = await tokenDeAdmin(app);
    sucursales = await idsDeSucursales();
  });

  afterAll(async () => {
    await app.close();
    await cerrarClientePrueba();
  });

  /** Crea un usuario Empleado y lo vincula como empleado; devuelve su token. */
  async function empleadoConToken(): Promise<{
    token: string;
    usuarioId: string;
  }> {
    const usuario = await crearEmpleado(
      app,
      admin,
      sucursales.centro,
      'Empleado MiHorario',
    );

    await request(app.getHttpServer())
      .post('/api/employees')
      .set(...como(admin))
      .send({
        usuarioId: usuario.id,
        cargo: 'Barista',
        fechaContratacion: '2026-01-15',
      })
      .expect(201);

    const respuesta = await iniciarSesion(
      app,
      usuario.nombreUsuario,
      PASSWORD_VALIDA_PRUEBAS,
    ).expect(200);

    return {
      token: (respuesta.body as { accessToken: string }).accessToken,
      usuarioId: usuario.id,
    };
  }

  it('responde 401 sin token', async () => {
    await request(app.getHttpServer())
      .get('/api/my/schedule')
      .expect(401);
  });

  it('responde 404 cuando el usuario no tiene empleado vinculado', async () => {
    // El admin de pruebas no tiene empleado
    await request(app.getHttpServer())
      .get('/api/my/schedule')
      .set(...como(admin))
      .expect(404);
  });

  it('devuelve el horario de la semana por defecto', async () => {
    const { token } = await empleadoConToken();

    const respuesta = await request(app.getHttpServer())
      .get('/api/my/schedule')
      .set(...como(token))
      .expect(200);

    const cuerpo = respuesta.body as {
      empleado: { nombre: string; cargo: string; sucursal: string };
      dias: { fecha: string; turno: unknown }[];
    };

    expect(cuerpo.empleado.nombre).toBe('Empleado MiHorario');
    expect(cuerpo.empleado.cargo).toBe('Barista');
    expect(cuerpo.empleado.sucursal).toBe('Sucursal Centro');
    expect(cuerpo.dias).toHaveLength(7);
    // Sin asignaciones, todos los dias tienen turno null
    expect(cuerpo.dias.every((d) => d.turno === null)).toBe(true);
  });

  it('acepta un rango explicito', async () => {
    const { token } = await empleadoConToken();

    await request(app.getHttpServer())
      .get('/api/my/schedule?desde=2026-10-12&hasta=2026-10-14')
      .set(...como(token))
      .expect(200)
      .expect((res) => {
        const cuerpo = res.body as { dias: { fecha: string }[] };
        expect(cuerpo.dias).toHaveLength(3);
        expect(cuerpo.dias[0]?.fecha).toBe('2026-10-12');
        expect(cuerpo.dias[2]?.fecha).toBe('2026-10-14');
      });
  });

  it('rechaza un rango mayor a 92 dias', async () => {
    const { token } = await empleadoConToken();

    await request(app.getHttpServer())
      .get('/api/my/schedule?desde=2026-01-01&hasta=2026-12-31')
      .set(...como(token))
      .expect(400);
  });

  it('rechaza desde posterior a hasta', async () => {
    const { token } = await empleadoConToken();

    await request(app.getHttpServer())
      .get('/api/my/schedule?desde=2026-10-20&hasta=2026-10-17')
      .set(...como(token))
      .expect(400);
  });

  it('nunca expone datos de otros usuarios', async () => {
    // El admin consulta y recibe 404 (no tiene empleado), no ve el de otro
    await request(app.getHttpServer())
      .get('/api/my/schedule')
      .set(...como(admin))
      .expect(404);

    // Un token de empleado no puede pedir el horario de otro por parametro:
    // la ruta no acepta parametro de usuario.
    const { token } = await empleadoConToken();
    const respuesta = await request(app.getHttpServer())
      .get('/api/my/schedule?empleadoId=otro')
      .set(...como(token))
      .expect(400); // ValidationPipe rechaza campo desconocido
  });
});
