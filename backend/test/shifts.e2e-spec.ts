// Pruebas end-to-end del modulo de turnos y asignaciones.
//
// Todas pasan por HTTP con supertest contra la base de pruebas: no se llaman
// casos de uso ni se falsea ningun repositorio. Ademas del comportamiento
// observable, se comprueba el punto mas delicado del modulo: dos altas de
// asignacion simultaneas para el mismo empleado solo pueden dejar pasar una.
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearAppDePruebas } from './utils/crear-app-pruebas';
import {
  cerrarClientePrueba,
  clientePrueba,
  resetDatabase,
} from './utils/reset-database';
import { como, iniciarSesion, tokenDeAdmin } from './utils/http-pruebas';
import { PASSWORD_VALIDA_PRUEBAS } from './utils/constantes-pruebas';
import {
  crearEmpleado,
  crearGerente,
  idsDeSucursales,
  type Sucursales,
} from './utils/fixtures-pruebas';

type TurnoE2E = {
  id: string;
  sucursalId: string;
  tipo: string;
  horaInicio: string | null;
  horaFin: string | null;
  diasSemana: string | null;
};

type EmpleadoE2E = {
  id: string;
  usuarioId: string;
  sucursalId: string;
  estado: string;
};

type AsignacionE2E = {
  id: string;
  empleadoId: string;
  turnoId: string;
  fechaInicio: string;
  fechaFin: string | null;
  empleado: { id: string; sucursalId: string };
  turno: TurnoE2E;
};

const ID_INEXISTENTE = '00000000-0000-7000-8000-000000000000';

/**
 * Dia `YYYY-MM-DD` en el calendario del negocio (America/Lima, UTC-5 fijo).
 *
 * Se calcula relativo a hoy en vez de fijarlo para que las pruebas que
 * comparan contra "hoy" (retirar una asignacion) no dependan del dia en que se
 * ejecuten.
 */
function fechaLocal(desplazamientoDias = 0): string {
  const base = new Date(Date.now() + desplazamientoDias * 86_400_000);
  const lima = new Date(base.getTime() - 5 * 3_600_000);
  return lima.toISOString().slice(0, 10);
}

describe('shifts (e2e)', () => {
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

  // ------------------------------------------------------------------ helpers

  /** Crea un turno fijo valido y exige 201. */
  async function crearTurnoFijo(
    sucursalId: string,
    overrides: Partial<{ horaInicio: string; horaFin: string; diasSemana: string }> = {},
    token: string = admin,
  ): Promise<TurnoE2E> {
    const respuesta = await request(app.getHttpServer())
      .post('/api/shifts')
      .set(...como(token))
      .send({
        sucursalId,
        tipo: 'fijo',
        horaInicio: overrides.horaInicio ?? '08:00',
        horaFin: overrides.horaFin ?? '16:00',
        diasSemana: overrides.diasSemana ?? '1,2,3,4,5',
      })
      .expect(201);

    return respuesta.body as TurnoE2E;
  }

  /** Registra un empleado por HTTP y exige 201. */
  async function registrarEmpleado(
    usuarioId: string,
    fechaContratacion = '2020-01-01',
  ): Promise<EmpleadoE2E> {
    const respuesta = await request(app.getHttpServer())
      .post('/api/employees')
      .set(...como(admin))
      .send({ usuarioId, cargo: 'Barista', fechaContratacion })
      .expect(201);

    return respuesta.body as EmpleadoE2E;
  }

  /** Asigna un turno por HTTP; devuelve la respuesta para inspeccionar el status. */
  function asignar(
    datos: { empleadoId: string; turnoId: string; fechaInicio?: string; fechaFin?: string },
    token: string = admin,
  ): request.Test {
    return request(app.getHttpServer())
      .post('/api/assignments')
      .set(...como(token))
      .send({
        empleadoId: datos.empleadoId,
        turnoId: datos.turnoId,
        fechaInicio: datos.fechaInicio ?? fechaLocal(),
        ...(datos.fechaFin !== undefined ? { fechaFin: datos.fechaFin } : {}),
      });
  }

  // ------------------------------------------------------------------- turnos

  describe('crear turnos', () => {
    it('crea un turno fijo con horas y dias: 201', async () => {
      const turno = await crearTurnoFijo(sucursales.centro);

      expect(turno.tipo).toBe('fijo');
      expect(turno.sucursalId).toBe(sucursales.centro);
      expect(turno.horaInicio).toBe('08:00');
      expect(turno.horaFin).toBe('16:00');
      expect(turno.diasSemana).toBe('1,2,3,4,5');
    });

    it('crea un turno variable sin horas: 201', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/shifts')
        .set(...como(admin))
        .send({ sucursalId: sucursales.centro, tipo: 'variable' })
        .expect(201);

      const turno = respuesta.body as TurnoE2E;
      expect(turno.tipo).toBe('variable');
      expect(turno.horaInicio).toBeNull();
      expect(turno.horaFin).toBeNull();
      expect(turno.diasSemana).toBeNull();
    });

    it('rechaza un turno fijo sin horas: 400', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/shifts')
        .set(...como(admin))
        .send({ sucursalId: sucursales.centro, tipo: 'fijo', diasSemana: '1,2' })
        .expect(400);

      expect(JSON.stringify(respuesta.body)).toContain(
        'Un turno fijo debe tener hora de inicio y de fin',
      );
    });

    it('rechaza una hora de fin anterior a la de inicio: 400', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/shifts')
        .set(...como(admin))
        .send({
          sucursalId: sucursales.centro,
          tipo: 'fijo',
          horaInicio: '16:00',
          horaFin: '08:00',
          diasSemana: '1,2',
        })
        .expect(400);

      expect(JSON.stringify(respuesta.body)).toContain(
        'La hora de fin debe ser posterior a la hora de inicio',
      );
    });

    it('rechaza diasSemana mal formado: 400', async () => {
      const desordenado = await request(app.getHttpServer())
        .post('/api/shifts')
        .set(...como(admin))
        .send({
          sucursalId: sucursales.centro,
          tipo: 'fijo',
          horaInicio: '08:00',
          horaFin: '16:00',
          diasSemana: '3,1',
        })
        .expect(400);
      expect(JSON.stringify(desordenado.body)).toContain('orden ascendente');

      const fueraDeRango = await request(app.getHttpServer())
        .post('/api/shifts')
        .set(...como(admin))
        .send({
          sucursalId: sucursales.centro,
          tipo: 'fijo',
          horaInicio: '08:00',
          horaFin: '16:00',
          diasSemana: '1,8',
        })
        .expect(400);
      expect(JSON.stringify(fueraDeRango.body)).toContain('fuera del rango 1-7');
    });

    it('un Admin con sucursal inexistente recibe 404', async () => {
      await request(app.getHttpServer())
        .post('/api/shifts')
        .set(...como(admin))
        .send({ sucursalId: ID_INEXISTENTE, tipo: 'variable' })
        .expect(404);
    });
  });

  // -------------------------------------------------------- alcance del Gerente

  describe('alcance del Gerente', () => {
    it('fuerza su propia sucursal aunque envie otra', async () => {
      const gerente = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Turnos',
      );

      const respuesta = await request(app.getHttpServer())
        .post('/api/shifts')
        .set(...como(gerente.token))
        .send({ sucursalId: sucursales.norte, tipo: 'variable' })
        .expect(201);

      expect((respuesta.body as TurnoE2E).sucursalId).toBe(sucursales.centro);
    });

    it('no ve un turno de otra sucursal: 404', async () => {
      const turnoAjeno = await crearTurnoFijo(sucursales.norte);
      const gerente = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Ajeno',
      );

      await request(app.getHttpServer())
        .get(`/api/shifts/${turnoAjeno.id}`)
        .set(...como(gerente.token))
        .expect(404);
    });

    it('lista solo los turnos de su sucursal', async () => {
      await crearTurnoFijo(sucursales.centro);
      await crearTurnoFijo(sucursales.norte);
      const gerente = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Lista',
      );

      const respuesta = await request(app.getHttpServer())
        .get('/api/shifts')
        .set(...como(gerente.token))
        .expect(200);

      const cuerpo = respuesta.body as { data: TurnoE2E[]; total: number };
      expect(cuerpo.total).toBe(1);
      expect(cuerpo.data[0].sucursalId).toBe(sucursales.centro);
    });
  });

  // ------------------------------------------------------------- asignaciones

  describe('crear asignaciones', () => {
    it('asigna un turno al empleado: 201', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Asignado',
      );
      const empleado = await registrarEmpleado(usuario.id);
      const turno = await crearTurnoFijo(sucursales.centro);

      const respuesta = await asignar({
        empleadoId: empleado.id,
        turnoId: turno.id,
      }).expect(201);

      const asignacion = respuesta.body as AsignacionE2E;
      expect(asignacion.empleadoId).toBe(empleado.id);
      expect(asignacion.turnoId).toBe(turno.id);
      expect(asignacion.fechaFin).toBeNull();
      expect(asignacion.turno.id).toBe(turno.id);
    });

    it('rechaza un empleado de otra sucursal: 404', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.norte,
        'Empleado Otra Sucursal',
      );
      const empleado = await registrarEmpleado(usuario.id);
      const turno = await crearTurnoFijo(sucursales.centro);

      await asignar({ empleadoId: empleado.id, turnoId: turno.id }).expect(404);
    });

    it('rechaza asignar a un empleado cesado: 409', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Cesado',
      );
      const empleado = await registrarEmpleado(usuario.id);
      const turno = await crearTurnoFijo(sucursales.centro);

      await request(app.getHttpServer())
        .post(`/api/employees/${empleado.id}/cese`)
        .set(...como(admin))
        .send({ fechaCese: fechaLocal() })
        .expect(200);

      const respuesta = await asignar({
        empleadoId: empleado.id,
        turnoId: turno.id,
      }).expect(409);

      expect(respuesta.body.message).toBe(
        'El empleado esta cesado y no se le pueden asignar turnos',
      );
    });

    it('rechaza un solapamiento fijo-fijo: 409', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Solape Fijo',
      );
      const empleado = await registrarEmpleado(usuario.id);
      const manana = await crearTurnoFijo(sucursales.centro, {
        horaInicio: '08:00',
        horaFin: '12:00',
        diasSemana: '1,2',
      });
      const tarde = await crearTurnoFijo(sucursales.centro, {
        horaInicio: '11:00',
        horaFin: '15:00',
        diasSemana: '2,3',
      });

      await asignar({ empleadoId: empleado.id, turnoId: manana.id }).expect(201);

      const respuesta = await asignar({
        empleadoId: empleado.id,
        turnoId: tarde.id,
      }).expect(409);

      expect(respuesta.body.message).toBe(
        'El empleado ya tiene una asignacion que se solapa',
      );
    });

    it('acepta fijo-fijo sin cruce de dias: 201', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Sin Cruce',
      );
      const empleado = await registrarEmpleado(usuario.id);
      const primero = await crearTurnoFijo(sucursales.centro, {
        horaInicio: '08:00',
        horaFin: '12:00',
        diasSemana: '1,2',
      });
      const segundo = await crearTurnoFijo(sucursales.centro, {
        horaInicio: '08:00',
        horaFin: '12:00',
        diasSemana: '4,5',
      });

      await asignar({ empleadoId: empleado.id, turnoId: primero.id }).expect(201);
      await asignar({ empleadoId: empleado.id, turnoId: segundo.id }).expect(201);
    });

    it('rechaza un turno variable que se solape con cualquier otro: 409', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Variable',
      );
      const empleado = await registrarEmpleado(usuario.id);
      const fijo = await crearTurnoFijo(sucursales.centro, {
        diasSemana: '1,2',
      });

      const variable = (
        await request(app.getHttpServer())
          .post('/api/shifts')
          .set(...como(admin))
          .send({ sucursalId: sucursales.centro, tipo: 'variable' })
          .expect(201)
      ).body as TurnoE2E;

      await asignar({ empleadoId: empleado.id, turnoId: fijo.id }).expect(201);
      await asignar({ empleadoId: empleado.id, turnoId: variable.id }).expect(409);
    });

    it('dos asignaciones simultaneas conflictivas: solo una pasa', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Simultaneo',
      );
      const empleado = await registrarEmpleado(usuario.id);
      const turno = await crearTurnoFijo(sucursales.centro);
      const datos = {
        empleadoId: empleado.id,
        turnoId: turno.id,
        fechaInicio: fechaLocal(),
      };
      const servidor = app.getHttpServer();

      const [primera, segunda] = await Promise.all([
        request(servidor).post('/api/assignments').set(...como(admin)).send(datos),
        request(servidor).post('/api/assignments').set(...como(admin)).send(datos),
      ]);

      const estados = [primera.status, segunda.status].sort((a, b) => a - b);
      expect(estados).toEqual([201, 409]);

      // Y en la base quedo una sola asignacion.
      const total = await clientePrueba().asignacionTurno.count({
        where: { empleadoId: empleado.id },
      });
      expect(total).toBe(1);
    });
  });

  // ------------------------------------------------------------- retirar

  describe('retirar asignaciones', () => {
    it('retira una asignacion fijando su fecha de fin', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Retirado',
      );
      const empleado = await registrarEmpleado(usuario.id);
      const turno = await crearTurnoFijo(sucursales.centro);

      const asignacion = (
        await asignar({ empleadoId: empleado.id, turnoId: turno.id }).expect(201)
      ).body as AsignacionE2E;

      const retirada = await request(app.getHttpServer())
        .patch(`/api/assignments/${asignacion.id}`)
        .set(...como(admin))
        .send({ fechaFin: fechaLocal(1) })
        .expect(200);

      expect((retirada.body as AsignacionE2E).fechaFin).toContain(fechaLocal(1));
    });

    it('rechaza una fecha de fin anterior a la de inicio: 400', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Fin Temprano',
      );
      const empleado = await registrarEmpleado(usuario.id);
      const turno = await crearTurnoFijo(sucursales.centro);

      const asignacion = (
        await asignar({
          empleadoId: empleado.id,
          turnoId: turno.id,
          fechaInicio: fechaLocal(5),
        }).expect(201)
      ).body as AsignacionE2E;

      const respuesta = await request(app.getHttpServer())
        .patch(`/api/assignments/${asignacion.id}`)
        .set(...como(admin))
        .send({ fechaFin: fechaLocal(4) })
        .expect(400);

      expect(JSON.stringify(respuesta.body)).toContain(
        'La fecha de fin no puede ser anterior a la de inicio',
      );
    });

    it('rechaza una fecha de fin anterior a hoy: 400', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Fin Pasado',
      );
      const empleado = await registrarEmpleado(usuario.id);
      const turno = await crearTurnoFijo(sucursales.centro);

      const asignacion = (
        await asignar({
          empleadoId: empleado.id,
          turnoId: turno.id,
          fechaInicio: fechaLocal(-10),
        }).expect(201)
      ).body as AsignacionE2E;

      const respuesta = await request(app.getHttpServer())
        .patch(`/api/assignments/${asignacion.id}`)
        .set(...como(admin))
        .send({ fechaFin: fechaLocal(-1) })
        .expect(400);

      expect(JSON.stringify(respuesta.body)).toContain(
        'La fecha de fin no puede ser anterior a hoy',
      );
    });

    it('lista solo las asignaciones vigentes con vigente=true', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Vigente',
      );
      const empleado = await registrarEmpleado(usuario.id);
      const turno = await crearTurnoFijo(sucursales.centro);

      await asignar({
        empleadoId: empleado.id,
        turnoId: turno.id,
        fechaInicio: fechaLocal(-10),
        fechaFin: fechaLocal(-5),
      }).expect(201);
      await asignar({ empleadoId: empleado.id, turnoId: turno.id }).expect(201);

      const respuesta = await request(app.getHttpServer())
        .get('/api/assignments')
        .query({ empleadoId: empleado.id, vigente: 'true' })
        .set(...como(admin))
        .expect(200);

      expect((respuesta.body as { total: number }).total).toBe(1);
    });
  });

  // ------------------------------------------------------------- editar turno

  describe('editar turnos', () => {
    it('rechaza un cambio de horas que dejaria un solape: 409', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Edita Turno',
      );
      const empleado = await registrarEmpleado(usuario.id);
      const manana = await crearTurnoFijo(sucursales.centro, {
        horaInicio: '08:00',
        horaFin: '12:00',
        diasSemana: '1,2',
      });
      const tarde = await crearTurnoFijo(sucursales.centro, {
        horaInicio: '13:00',
        horaFin: '17:00',
        diasSemana: '1,2',
      });

      await asignar({ empleadoId: empleado.id, turnoId: manana.id }).expect(201);
      await asignar({ empleadoId: empleado.id, turnoId: tarde.id }).expect(201);

      const respuesta = await request(app.getHttpServer())
        .patch(`/api/shifts/${tarde.id}`)
        .set(...como(admin))
        .send({ horaInicio: '11:00', horaFin: '15:00' })
        .expect(409);

      expect(respuesta.body.message).toContain('solapadas');
    });

    it('acepta un cambio de horas sin solape: 200', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Edita Turno Ok',
      );
      const empleado = await registrarEmpleado(usuario.id);
      const manana = await crearTurnoFijo(sucursales.centro, {
        horaInicio: '08:00',
        horaFin: '12:00',
        diasSemana: '1,2',
      });
      const tarde = await crearTurnoFijo(sucursales.centro, {
        horaInicio: '13:00',
        horaFin: '17:00',
        diasSemana: '1,2',
      });

      await asignar({ empleadoId: empleado.id, turnoId: manana.id }).expect(201);
      await asignar({ empleadoId: empleado.id, turnoId: tarde.id }).expect(201);

      const respuesta = await request(app.getHttpServer())
        .patch(`/api/shifts/${tarde.id}`)
        .set(...como(admin))
        .send({ horaInicio: '13:00', horaFin: '14:00' })
        .expect(200);

      expect((respuesta.body as TurnoE2E).horaFin).toBe('14:00');
    });
  });

  // ----------------------------------------------------------------- permisos

  describe('permisos', () => {
    it('un Empleado sin permiso no toca turnos ni asignaciones: 403', async () => {
      const empleado = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Sin Permiso Turnos',
      );
      const token = (
        await iniciarSesion(app, empleado.email, PASSWORD_VALIDA_PRUEBAS).expect(200)
      ).body.accessToken as string;

      await request(app.getHttpServer())
        .get('/api/shifts')
        .set(...como(token))
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/shifts')
        .set(...como(token))
        .send({})
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/assignments')
        .set(...como(token))
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/assignments')
        .set(...como(token))
        .send({})
        .expect(403);
    });

    it('todas las rutas responden 401 sin token', async () => {
      const servidor = app.getHttpServer();

      const peticiones: [string, () => request.Test][] = [
        ['GET shifts', () => request(servidor).get('/api/shifts')],
        ['POST shifts', () => request(servidor).post('/api/shifts').send({})],
        ['GET shift', () => request(servidor).get(`/api/shifts/${ID_INEXISTENTE}`)],
        [
          'PATCH shift',
          () => request(servidor).patch(`/api/shifts/${ID_INEXISTENTE}`).send({}),
        ],
        ['GET assignments', () => request(servidor).get('/api/assignments')],
        ['POST assignments', () => request(servidor).post('/api/assignments').send({})],
        [
          'PATCH assignment',
          () => request(servidor).patch(`/api/assignments/${ID_INEXISTENTE}`).send({}),
        ],
      ];

      for (const [nombre, construir] of peticiones) {
        await construir().expect(401);
        expect(nombre).toBeTruthy();
      }
    });
  });
});
