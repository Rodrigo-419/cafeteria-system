// Pruebas end-to-end de la auditoria (ETAPA 1: usuarios y personal).
//
// Van por HTTP con supertest contra la base de pruebas y comprueban el
// comportamiento observable:
//
//   * cada operacion de escritura deja exactamente los eventos que le tocan;
//   * nada se registra cuando la operacion falla (4xx): la transaccion revierte;
//   * el detalle jamas lleva contrasenas, hashes ni PIN;
//   * la tabla es solo-insercion (UPDATE/DELETE directos se rechazan);
//   * el alcance de lectura del Gerente no se sale de su sucursal ni de los
//     Empleados;
//   * los filtros y los bordes de fecha (America/Lima) responden como deben.
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearAppDePruebas } from './utils/crear-app-pruebas';
import {
  cerrarClientePrueba,
  clientePrueba,
  resetDatabase,
} from './utils/reset-database';
import { como, iniciarSesion } from './utils/http-pruebas';
import {
  ADMIN_PASSWORD_PRUEBAS,
  ADMIN_USUARIO_PRUEBAS,
  PASSWORD_VALIDA_PRUEBAS,
} from './utils/constantes-pruebas';
import {
  crearEmpleado,
  crearGerente,
  crearUsuarioPorHttp,
  idDePermiso,
  idsDeSucursales,
  type Sucursales,
} from './utils/fixtures-pruebas';
import {
  idsDeVariantes,
  type Variantes,
} from './utils/fixtures-productos-pruebas';
import {
  AuditoriaAccion,
  AuditoriaEntidad,
} from '../src/generated/prisma/client';

type EventoApi = {
  id: string;
  entidad: string;
  entidadId: string;
  accion: string;
  actor: { id: string; nombre: string; nombreUsuario: string };
  usuarioAfectadoId: string | null;
  sucursalAfectadaId: string | null;
  detalle: { antes?: Record<string, unknown>; despues?: Record<string, unknown> };
  fecha: string;
};

type PaginaApi = {
  eventos: EventoApi[];
  total: number;
  page: number;
  limit: number;
};

/** Fecha local (America/Lima) de hoy en formato YYYY-MM-DD. */
function fechaLocalHoy(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
  }).format(new Date());
}

describe('auditoria (e2e)', () => {
  let app: INestApplication;
  let admin: string;
  let adminId: string;
  let sucursales: Sucursales;
  let variantes: Variantes;

  beforeAll(async () => {
    app = await crearAppDePruebas();
  });

  beforeEach(async () => {
    await resetDatabase(clientePrueba());
    const sesion = await iniciarSesion(
      app,
      ADMIN_USUARIO_PRUEBAS,
      ADMIN_PASSWORD_PRUEBAS,
    ).expect(200);
    admin = sesion.body.accessToken as string;
    adminId = sesion.body.user.id as string;
    sucursales = await idsDeSucursales();
    variantes = await idsDeVariantes();
  });

  afterAll(async () => {
    await app.close();
    await cerrarClientePrueba();
  });

  /** Lista la auditoria y exige 200. */
  async function listar(token: string, query = ''): Promise<PaginaApi> {
    const respuesta = await request(app.getHttpServer())
      .get(`/api/auditoria${query}`)
      .set(...como(token))
      .expect(200);

    return respuesta.body as PaginaApi;
  }

  /** Eventos que cumplen el filtro, con limit alto para no truncar. */
  async function eventos(token: string, query: string): Promise<EventoApi[]> {
    return (await listar(token, `?limit=100&${query}`)).eventos;
  }

  // ----------------------------------------------------------- usuarios

  describe('eventos de usuario', () => {
    it('registra usuario_creado con actor, usuario afectado y sin contrasena', async () => {
      const usuario = await crearUsuarioPorHttp(app, admin, {
        nombre: 'Ana Auditada',
        nombreUsuario: 'ana.auditada',
        rol: 'Empleado',
        sucursalId: sucursales.centro,
      });

      const encontrados = await eventos(
        admin,
        `entidad=usuario&accion=usuario_creado&entidadId=${usuario.id}`,
      );

      expect(encontrados).toHaveLength(1);
      const evento = encontrados[0];
      expect(evento.actor.id).toBe(adminId);
      expect(evento.entidad).toBe('usuario');
      expect(evento.usuarioAfectadoId).toBe(usuario.id);
      expect(evento.sucursalAfectadaId).toBe(sucursales.centro);
      expect(evento.detalle.despues).toMatchObject({
        rol: 'Empleado',
        sucursalId: sucursales.centro,
      });
      expect(JSON.stringify(evento)).not.toContain('$2b$');
    });

    it('un PATCH de nombre deja usuario_editado con antes/despues', async () => {
      const usuario = await crearUsuarioPorHttp(app, admin, {
        nombre: 'Nombre Viejo',
        nombreUsuario: 'nombre.viejo',
        rol: 'Empleado',
        sucursalId: sucursales.centro,
      });

      await request(app.getHttpServer())
        .patch(`/api/users/${usuario.id}`)
        .set(...como(admin))
        .send({ nombre: 'Nombre Nuevo' })
        .expect(200);

      const encontrados = await eventos(
        admin,
        `entidad=usuario&accion=usuario_editado&entidadId=${usuario.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({ nombre: 'Nombre Viejo' });
      expect(encontrados[0].detalle.despues).toMatchObject({ nombre: 'Nombre Nuevo' });
    });

    it('un PATCH con cambios de rol y sucursal deja dos eventos, uno por tipo', async () => {
      const usuario = await crearUsuarioPorHttp(app, admin, {
        nombre: 'Cambio Multiple',
        nombreUsuario: 'cambio.multiple',
        rol: 'Empleado',
        sucursalId: sucursales.centro,
      });

      await request(app.getHttpServer())
        .patch(`/api/users/${usuario.id}`)
        .set(...como(admin))
        .send({ rol: 'Gerente', sucursalId: sucursales.norte })
        .expect(200);

      const rolCambiado = await eventos(
        admin,
        `entidad=usuario&accion=usuario_rol_cambiado&entidadId=${usuario.id}`,
      );
      const sucursalCambiada = await eventos(
        admin,
        `entidad=usuario&accion=usuario_sucursal_cambiada&entidadId=${usuario.id}`,
      );

      expect(rolCambiado).toHaveLength(1);
      expect(rolCambiado[0].detalle.antes).toMatchObject({ rol: 'Empleado' });
      expect(rolCambiado[0].detalle.despues).toMatchObject({ rol: 'Gerente' });

      expect(sucursalCambiada).toHaveLength(1);
      expect(sucursalCambiada[0].detalle.antes).toMatchObject({
        sucursalId: sucursales.centro,
      });
      expect(sucursalCambiada[0].detalle.despues).toMatchObject({
        sucursalId: sucursales.norte,
      });
    });

    it('un PATCH sin cambios reales no genera eventos', async () => {
      const usuario = await crearUsuarioPorHttp(app, admin, {
        nombre: 'Sin Cambios',
        nombreUsuario: 'sin.cambios',
        rol: 'Empleado',
        sucursalId: sucursales.centro,
      });

      await request(app.getHttpServer())
        .patch(`/api/users/${usuario.id}`)
        .set(...como(admin))
        .send({ nombre: 'Sin Cambios' })
        .expect(200);

      const editados = await eventos(
        admin,
        `entidad=usuario&accion=usuario_editado&entidadId=${usuario.id}`,
      );
      expect(editados).toHaveLength(0);
    });

    it('cambiar el estado deja usuario_bloqueado y luego usuario_activado', async () => {
      const usuario = await crearUsuarioPorHttp(app, admin, {
        nombre: 'Bloqueable',
        nombreUsuario: 'bloqueable',
        rol: 'Empleado',
        sucursalId: sucursales.centro,
      });

      await request(app.getHttpServer())
        .patch(`/api/users/${usuario.id}/estado`)
        .set(...como(admin))
        .send({ estado: 'bloqueado' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/users/${usuario.id}/estado`)
        .set(...como(admin))
        .send({ estado: 'activo' })
        .expect(200);

      const bloqueos = await eventos(
        admin,
        `accion=usuario_bloqueado&entidadId=${usuario.id}`,
      );
      const activaciones = await eventos(
        admin,
        `accion=usuario_activado&entidadId=${usuario.id}`,
      );

      expect(bloqueos).toHaveLength(1);
      expect(bloqueos[0].detalle.despues).toMatchObject({ estado: 'bloqueado' });
      expect(activaciones).toHaveLength(1);
      expect(activaciones[0].detalle.despues).toMatchObject({ estado: 'activo' });
    });

    it('restablecer una contrasena deja el evento sin el hash', async () => {
      const usuario = await crearUsuarioPorHttp(app, admin, {
        nombre: 'Password Reset',
        nombreUsuario: 'password.reset',
        rol: 'Empleado',
        sucursalId: sucursales.centro,
      });

      await request(app.getHttpServer())
        .patch(`/api/users/${usuario.id}/password`)
        .set(...como(admin))
        .send({ password: PASSWORD_VALIDA_PRUEBAS })
        .expect(204);

      const encontrados = await eventos(
        admin,
        `accion=usuario_password_restablecida&entidadId=${usuario.id}`,
      );

      expect(encontrados).toHaveLength(1);
      const serializado = JSON.stringify(encontrados[0]);
      expect(serializado).not.toContain('$2b$');
      expect(serializado).not.toContain(PASSWORD_VALIDA_PRUEBAS);
    });

    it('cambiar la propia contrasena deja usuario_password_cambiada', async () => {
      const nueva = 'NuevaPropia2026!';

      await request(app.getHttpServer())
        .patch('/api/users/me/password')
        .set(...como(admin))
        .send({ passwordActual: ADMIN_PASSWORD_PRUEBAS, passwordNueva: nueva })
        .expect(204);

      const encontrados = await eventos(
        admin,
        `accion=usuario_password_cambiada&entidadId=${adminId}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].usuarioAfectadoId).toBe(adminId);
      const serializado = JSON.stringify(encontrados[0]);
      expect(serializado).not.toContain('$2b$');
      expect(serializado).not.toContain(nueva);
    });

    it('conceder, revocar y restablecer un permiso dejan sus tres eventos', async () => {
      const usuario = await crearUsuarioPorHttp(app, admin, {
        nombre: 'Permisos Auditado',
        nombreUsuario: 'permisos.auditado',
        rol: 'Empleado',
        sucursalId: sucursales.centro,
      });
      // `equipo.ver` es uno de los permisos concedibles a un Empleado.
      const permisoConcedible = await idDePermiso('equipo.ver');
      // `productos.ver` lo tiene el rol Empleado por defecto: se puede revocar.
      const permisoPorDefecto = await idDePermiso('productos.ver');

      await request(app.getHttpServer())
        .put(`/api/users/${usuario.id}/permisos/${permisoConcedible}`)
        .set(...como(admin))
        .send({ tipo: 'concedido' })
        .expect(204);

      await request(app.getHttpServer())
        .put(`/api/users/${usuario.id}/permisos/${permisoPorDefecto}`)
        .set(...como(admin))
        .send({ tipo: 'revocado' })
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/api/users/${usuario.id}/permisos/${permisoConcedible}`)
        .set(...como(admin))
        .expect(204);

      const concedidos = await eventos(
        admin,
        `accion=permiso_concedido&entidadId=${usuario.id}`,
      );
      const revocados = await eventos(
        admin,
        `accion=permiso_revocado&entidadId=${usuario.id}`,
      );
      const restablecidos = await eventos(
        admin,
        `accion=permiso_restablecido&entidadId=${usuario.id}`,
      );

      expect(concedidos).toHaveLength(1);
      expect(revocados).toHaveLength(1);
      expect(restablecidos).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------- empleados

  describe('eventos de empleado', () => {
    it('registrar un empleado deja empleado_creado con el usuario vinculado', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Auditado',
      );

      const creado = await request(app.getHttpServer())
        .post('/api/employees')
        .set(...como(admin))
        .send({
          usuarioId: usuario.id,
          cargo: 'Barista',
          fechaContratacion: '2026-01-15',
        })
        .expect(201);

      const encontrados = await eventos(
        admin,
        `entidad=empleado&accion=empleado_creado&entidadId=${creado.body.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].usuarioAfectadoId).toBe(usuario.id);
      expect(encontrados[0].sucursalAfectadaId).toBe(sucursales.centro);
      expect(encontrados[0].detalle.despues).toMatchObject({ cargo: 'Barista' });
    });

    it('editar el cargo deja empleado_editado con antes/despues', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Editado',
      );
      const creado = await request(app.getHttpServer())
        .post('/api/employees')
        .set(...como(admin))
        .send({
          usuarioId: usuario.id,
          cargo: 'Barista',
          fechaContratacion: '2026-01-15',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/employees/${creado.body.id}`)
        .set(...como(admin))
        .send({ cargo: 'Cajero' })
        .expect(200);

      const encontrados = await eventos(
        admin,
        `accion=empleado_editado&entidadId=${creado.body.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({ cargo: 'Barista' });
      expect(encontrados[0].detalle.despues).toMatchObject({ cargo: 'Cajero' });
    });

    it('cesar deja empleado_cesado y encadena usuario_bloqueado', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Cesado',
      );
      const creado = await request(app.getHttpServer())
        .post('/api/employees')
        .set(...como(admin))
        .send({
          usuarioId: usuario.id,
          cargo: 'Barista',
          fechaContratacion: '2026-01-15',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/employees/${creado.body.id}/cese`)
        .set(...como(admin))
        .send({ fechaCese: '2026-02-01' })
        .expect(200);

      const cesados = await eventos(
        admin,
        `accion=empleado_cesado&entidadId=${creado.body.id}`,
      );
      const bloqueos = await eventos(
        admin,
        `accion=usuario_bloqueado&entidadId=${usuario.id}`,
      );

      expect(cesados).toHaveLength(1);
      expect(cesados[0].usuarioAfectadoId).toBe(usuario.id);
      expect(bloqueos).toHaveLength(1);
    });

    it('regenerar el PIN deja el evento sin el PIN ni su hash', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Pin',
      );
      const creado = await request(app.getHttpServer())
        .post('/api/employees')
        .set(...como(admin))
        .send({
          usuarioId: usuario.id,
          cargo: 'Barista',
          fechaContratacion: '2026-01-15',
        })
        .expect(201);

      const pinRespuesta = await request(app.getHttpServer())
        .post(`/api/employees/${creado.body.id}/pin`)
        .set(...como(admin))
        .expect(200);
      const pin = pinRespuesta.body.pin as string;

      const encontrados = await eventos(
        admin,
        `accion=empleado_pin_regenerado&entidadId=${creado.body.id}`,
      );

      expect(encontrados).toHaveLength(1);
      const serializado = JSON.stringify(encontrados[0]);
      expect(serializado).not.toContain(pin);
      expect(serializado).not.toContain('pinHash');
    });
  });

  // --------------------------------------------------- atomicidad / 4xx

  describe('atomicidad en operaciones rechazadas', () => {
    it('un nombre de usuario duplicado no deja ningun evento', async () => {
      await crearUsuarioPorHttp(app, admin, {
        nombre: 'Primera Alta',
        nombreUsuario: 'repetido.auditoria',
        rol: 'Empleado',
        sucursalId: sucursales.centro,
      });

      const eventosAntes = await eventos(admin, 'accion=usuario_creado');

      await request(app.getHttpServer())
        .post('/api/users')
        .set(...como(admin))
        .send({
          nombre: 'Segunda Alta',
          nombreUsuario: 'repetido.auditoria',
          password: PASSWORD_VALIDA_PRUEBAS,
          rol: 'Empleado',
          sucursalId: sucursales.centro,
        })
        .expect(409);

      const eventosDespues = await eventos(admin, 'accion=usuario_creado');

      expect(eventosDespues).toHaveLength(eventosAntes.length);
    });

    it('una operacion rechazada sobre el propio usuario no deja evento', async () => {
      // El Admin no puede bloquearse a si mismo (400); el intento revierte sin
      // escribir ningun evento.
      await request(app.getHttpServer())
        .patch(`/api/users/${adminId}/estado`)
        .set(...como(admin))
        .send({ estado: 'bloqueado' })
        .expect(400);

      const bloqueos = await eventos(admin, `accion=usuario_bloqueado`);
      expect(bloqueos).toHaveLength(0);
    });
  });

  // --------------------------------------------------------- inmutabilidad

  describe('inmutabilidad de la tabla', () => {
    it('rechaza UPDATE y DELETE directos sobre auditoria', async () => {
      const usuario = await crearUsuarioPorHttp(app, admin, {
        nombre: 'Inmutable',
        nombreUsuario: 'inmutable',
        rol: 'Empleado',
        sucursalId: sucursales.centro,
      });
      const evento = (
        await eventos(
          admin,
          `accion=usuario_creado&entidadId=${usuario.id}`,
        )
      )[0];

      const db = clientePrueba();

      await expect(
        db.$executeRawUnsafe(
          `UPDATE auditoria SET accion = 'usuario_editado' WHERE id = $1`,
          evento.id,
        ),
      ).rejects.toThrow();

      await expect(
        db.$executeRawUnsafe(`DELETE FROM auditoria WHERE id = $1`, evento.id),
      ).rejects.toThrow();

      const sigue = await eventos(
        admin,
        `accion=usuario_creado&entidadId=${usuario.id}`,
      );
      expect(sigue).toHaveLength(1);
    });
  });

  // --------------------------------------------------------- secretos

  describe('el detalle nunca lleva secretos', () => {
    it('ninguna respuesta de auditoria expone contrasenas, hashes ni PIN', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Secretos',
      );
      const creado = await request(app.getHttpServer())
        .post('/api/employees')
        .set(...como(admin))
        .send({
          usuarioId: usuario.id,
          cargo: 'Barista',
          fechaContratacion: '2026-01-15',
        })
        .expect(201);

      const pinRespuesta = await request(app.getHttpServer())
        .post(`/api/employees/${creado.body.id}/pin`)
        .set(...como(admin))
        .expect(200);
      const pin = pinRespuesta.body.pin as string;

      await request(app.getHttpServer())
        .patch(`/api/users/${usuario.id}/password`)
        .set(...como(admin))
        .send({ password: PASSWORD_VALIDA_PRUEBAS })
        .expect(204);

      const pagina = await listar(admin, '?limit=100');
      const serializado = JSON.stringify(pagina.eventos);

      expect(serializado).not.toContain('$2b$');
      expect(serializado).not.toContain('passwordHash');
      expect(serializado).not.toContain('pinHash');
      expect(serializado).not.toContain(PASSWORD_VALIDA_PRUEBAS);
      expect(serializado).not.toContain(pin);
    });
  });

  // --------------------------------------------------------- alcance

  describe('alcance de lectura', () => {
    it('un Gerente solo ve eventos de sus Empleados, no los de otras sucursales ni de otros roles', async () => {
      const gerenteCentro = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Centro Audit',
      );
      const empleadoCentro = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Centro Audit',
      );
      const empleadoNorte = await crearEmpleado(
        app,
        admin,
        sucursales.norte,
        'Empleado Norte Audit',
      );
      const gerenteNorte = await crearGerente(
        app,
        admin,
        sucursales.norte,
        'Gerente Norte Audit',
      );

      const comoAdmin = await eventos(admin, 'entidad=usuario&accion=usuario_creado');
      const idsAdmin = comoAdmin.map((e) => e.entidadId);
      expect(idsAdmin).toEqual(
        expect.arrayContaining([
          gerenteCentro.usuario.id,
          empleadoCentro.id,
          empleadoNorte.id,
          gerenteNorte.usuario.id,
        ]),
      );

      const comoGerente = await eventos(
        gerenteCentro.token,
        'entidad=usuario&accion=usuario_creado',
      );
      const idsGerente = comoGerente.map((e) => e.entidadId);

      expect(idsGerente).toContain(empleadoCentro.id);
      expect(idsGerente).not.toContain(empleadoNorte.id);
      expect(idsGerente).not.toContain(gerenteCentro.usuario.id);
      expect(idsGerente).not.toContain(gerenteNorte.usuario.id);
    });

    it('el historial por usuario respeta el alcance: Gerente 404 para Empleados ajenos y otros roles', async () => {
      const gerenteCentro = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Historial',
      );
      const empleadoCentro = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Historial Centro',
      );
      const empleadoNorte = await crearEmpleado(
        app,
        admin,
        sucursales.norte,
        'Empleado Historial Norte',
      );

      await request(app.getHttpServer())
        .get(`/api/auditoria/usuarios/${empleadoCentro.id}`)
        .set(...como(gerenteCentro.token))
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/auditoria/usuarios/${empleadoNorte.id}`)
        .set(...como(gerenteCentro.token))
        .expect(404);

      await request(app.getHttpServer())
        .get(`/api/auditoria/usuarios/${gerenteCentro.usuario.id}`)
        .set(...como(gerenteCentro.token))
        .expect(404);

      await request(app.getHttpServer())
        .get(`/api/auditoria/usuarios/${adminId}`)
        .set(...como(gerenteCentro.token))
        .expect(404);

      await request(app.getHttpServer())
        .get(`/api/auditoria/usuarios/${empleadoNorte.id}`)
        .set(...como(admin))
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/auditoria/usuarios/0192f0a0-0000-7000-8000-000000000000')
        .set(...como(admin))
        .expect(404);
    });
  });

  // --------------------------------------------------------- filtros

  describe('filtros y paginado', () => {
    it('filtra por actor, accion y entidad del recurso', async () => {
      const usuario = await crearUsuarioPorHttp(app, admin, {
        nombre: 'Filtrable',
        nombreUsuario: 'filtrable',
        rol: 'Empleado',
        sucursalId: sucursales.centro,
      });

      const porActor = await eventos(admin, `actorId=${adminId}`);
      expect(porActor.length).toBeGreaterThan(0);
      expect(porActor.every((e) => e.actor.id === adminId)).toBe(true);

      const porRecurso = await eventos(admin, `entidadId=${usuario.id}`);
      expect(porRecurso.every((e) => e.entidadId === usuario.id)).toBe(true);
      expect(porRecurso.map((e) => e.accion)).toContain('usuario_creado');
    });

    it('pagina los resultados', async () => {
      await crearUsuarioPorHttp(app, admin, {
        nombre: 'Pagina Uno',
        nombreUsuario: 'pagina.uno',
        rol: 'Empleado',
        sucursalId: sucursales.centro,
      });
      await crearUsuarioPorHttp(app, admin, {
        nombre: 'Pagina Dos',
        nombreUsuario: 'pagina.dos',
        rol: 'Empleado',
        sucursalId: sucursales.centro,
      });

      const pagina = await listar(admin, '?limit=1&entidad=usuario');

      expect(pagina.eventos).toHaveLength(1);
      expect(pagina.page).toBe(1);
      expect(pagina.limit).toBe(1);
      expect(pagina.total).toBeGreaterThanOrEqual(2);
    });
  });

  // ----------------------------------------------------------- sucursales

  describe('eventos de sucursal', () => {
    it('crear una sucursal deja sucursal_creada sin sucursal afectada (evento global)', async () => {
      const creada = await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({ nombre: 'Sucursal Auditada', direccion: 'Calle Nueva 1' })
        .expect(201);

      const encontrados = await eventos(
        admin,
        `entidad=sucursal&accion=sucursal_creada&entidadId=${creada.body.id}`,
      );

      expect(encontrados).toHaveLength(1);
      const evento = encontrados[0];
      expect(evento.actor.id).toBe(adminId);
      expect(evento.usuarioAfectadoId).toBeNull();
      expect(evento.sucursalAfectadaId).toBeNull();
      expect(evento.detalle.despues).toMatchObject({ nombre: 'Sucursal Auditada' });
    });

    it('editar una sucursal deja sucursal_editada con antes/despues', async () => {
      const creada = await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({
          nombre: 'Sucursal Editable',
          direccion: 'Calle 1',
          telefono: '600000000',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/branches/${creada.body.id}`)
        .set(...como(admin))
        .send({ telefono: '699999999' })
        .expect(200);

      const encontrados = await eventos(
        admin,
        `entidad=sucursal&accion=sucursal_editada&entidadId=${creada.body.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({ telefono: '600000000' });
      expect(encontrados[0].detalle.despues).toMatchObject({ telefono: '699999999' });
    });

    it('un nombre de sucursal duplicado (409) no deja evento', async () => {
      await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({ nombre: 'Sucursal Unica', direccion: 'Calle 1' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({ nombre: 'Sucursal Unica', direccion: 'Calle 2' })
        .expect(409);

      const eventosSucursal = await eventos(admin, 'entidad=sucursal&accion=sucursal_creada');
      expect(eventosSucursal).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------- equipos

  describe('eventos de equipo', () => {
    async function crearEquipo(): Promise<{ id: string }> {
      const respuesta = await request(app.getHttpServer())
        .post('/api/equipment')
        .set(...como(admin))
        .send({
          sucursalId: sucursales.centro,
          nombre: 'Cafetera Auditada',
          tipo: 'Cafetera',
        })
        .expect(201);
      return respuesta.body as { id: string };
    }

    it('crear un equipo deja equipo_creado ligado a su sucursal', async () => {
      const equipo = await crearEquipo();

      const encontrados = await eventos(
        admin,
        `entidad=equipo&accion=equipo_creado&entidadId=${equipo.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].sucursalAfectadaId).toBe(sucursales.centro);
      expect(encontrados[0].detalle.despues).toMatchObject({
        nombre: 'Cafetera Auditada',
        estado: 'funcionando',
      });
    });

    it('cambiar el estado deja equipo_estado_cambiado', async () => {
      const equipo = await crearEquipo();

      await request(app.getHttpServer())
        .patch(`/api/equipment/${equipo.id}`)
        .set(...como(admin))
        .send({ estado: 'danado' })
        .expect(200);

      const encontrados = await eventos(
        admin,
        `entidad=equipo&accion=equipo_estado_cambiado&entidadId=${equipo.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({ estado: 'funcionando' });
      expect(encontrados[0].detalle.despues).toMatchObject({ estado: 'danado' });
    });

    it('editar el nombre deja equipo_editado', async () => {
      const equipo = await crearEquipo();

      await request(app.getHttpServer())
        .patch(`/api/equipment/${equipo.id}`)
        .set(...como(admin))
        .send({ nombre: 'Cafetera Renombrada' })
        .expect(200);

      const encontrados = await eventos(
        admin,
        `entidad=equipo&accion=equipo_editado&entidadId=${equipo.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({ nombre: 'Cafetera Auditada' });
      expect(encontrados[0].detalle.despues).toMatchObject({
        nombre: 'Cafetera Renombrada',
      });
    });
  });

  // ------------------------------------------------------- turnos y asignaciones

  describe('eventos de turno', () => {
    async function crearTurno(): Promise<{ id: string }> {
      const respuesta = await request(app.getHttpServer())
        .post('/api/shifts')
        .set(...como(admin))
        .send({
          sucursalId: sucursales.centro,
          tipo: 'fijo',
          horaInicio: '08:00',
          horaFin: '16:00',
          diasSemana: '1,2,3,4,5',
        })
        .expect(201);
      return respuesta.body as { id: string };
    }

    it('crear un turno deja turno_creado ligado a su sucursal', async () => {
      const turno = await crearTurno();

      const encontrados = await eventos(
        admin,
        `entidad=turno&accion=turno_creado&entidadId=${turno.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].sucursalAfectadaId).toBe(sucursales.centro);
      expect(encontrados[0].detalle.despues).toMatchObject({
        tipo: 'fijo',
        horaInicio: '08:00',
      });
    });

    it('editar las horas deja turno_editado', async () => {
      const turno = await crearTurno();

      await request(app.getHttpServer())
        .patch(`/api/shifts/${turno.id}`)
        .set(...como(admin))
        .send({ horaFin: '17:00' })
        .expect(200);

      const encontrados = await eventos(
        admin,
        `entidad=turno&accion=turno_editado&entidadId=${turno.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({ horaFin: '16:00' });
      expect(encontrados[0].detalle.despues).toMatchObject({ horaFin: '17:00' });
    });
  });

  describe('eventos de asignacion', () => {
    async function prepararAsignacion(): Promise<{
      turnoId: string;
      empleadoId: string;
    }> {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Asignado Audit',
      );
      const empleado = await request(app.getHttpServer())
        .post('/api/employees')
        .set(...como(admin))
        .send({
          usuarioId: usuario.id,
          cargo: 'Barista',
          fechaContratacion: '2020-01-01',
        })
        .expect(201);

      const turno = await request(app.getHttpServer())
        .post('/api/shifts')
        .set(...como(admin))
        .send({
          sucursalId: sucursales.centro,
          tipo: 'fijo',
          horaInicio: '08:00',
          horaFin: '16:00',
          diasSemana: '1,2,3,4,5',
        })
        .expect(201);

      return { turnoId: turno.body.id as string, empleadoId: empleado.body.id as string };
    }

    it('asignar un turno deja asignacion_creada ligada a la sucursal del empleado', async () => {
      const { turnoId, empleadoId } = await prepararAsignacion();

      const asignacion = await request(app.getHttpServer())
        .post('/api/assignments')
        .set(...como(admin))
        .send({ empleadoId, turnoId, fechaInicio: fechaLocalHoy() })
        .expect(201);

      const encontrados = await eventos(
        admin,
        `entidad=asignacion&accion=asignacion_creada&entidadId=${asignacion.body.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].sucursalAfectadaId).toBe(sucursales.centro);
      expect(encontrados[0].detalle.despues).toMatchObject({ turnoId });
    });

    it('retirar una asignacion deja asignacion_retirada', async () => {
      const { turnoId, empleadoId } = await prepararAsignacion();

      const asignacion = await request(app.getHttpServer())
        .post('/api/assignments')
        .set(...como(admin))
        .send({ empleadoId, turnoId, fechaInicio: fechaLocalHoy() })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/assignments/${asignacion.body.id}`)
        .set(...como(admin))
        .send({ fechaFin: fechaLocalHoy() })
        .expect(200);

      const encontrados = await eventos(
        admin,
        `entidad=asignacion&accion=asignacion_retirada&entidadId=${asignacion.body.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({ fechaFin: null });
      expect(encontrados[0].detalle.despues).toMatchObject({
        fechaFin: fechaLocalHoy(),
      });
    });
  });

  // ------------------------------------------------- catalogo y ofertas

  describe('eventos de catalogo global', () => {
    async function crearCategoria(nombre: string): Promise<string> {
      const respuesta = await request(app.getHttpServer())
        .post('/api/product-categories')
        .set(...como(admin))
        .send({ nombre })
        .expect(201);
      return respuesta.body.id as string;
    }

    it('crear una categoria deja categoria_creada sin sucursal afectada', async () => {
      const categoriaId = await crearCategoria('Categoria Auditada');

      const encontrados = await eventos(
        admin,
        `entidad=categoria&accion=categoria_creada&entidadId=${categoriaId}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].sucursalAfectadaId).toBeNull();
      expect(encontrados[0].detalle.despues).toMatchObject({
        nombre: 'Categoria Auditada',
      });
    });

    it('renombrar una categoria deja categoria_editada con antes/despues', async () => {
      const categoriaId = await crearCategoria('Categoria Original');

      await request(app.getHttpServer())
        .patch(`/api/product-categories/${categoriaId}`)
        .set(...como(admin))
        .send({ nombre: 'Categoria Renombrada' })
        .expect(200);

      const encontrados = await eventos(
        admin,
        `entidad=categoria&accion=categoria_editada&entidadId=${categoriaId}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({
        nombre: 'Categoria Original',
      });
      expect(encontrados[0].detalle.despues).toMatchObject({
        nombre: 'Categoria Renombrada',
      });
    });

    it('borrar una categoria vacia deja categoria_eliminada', async () => {
      const categoriaId = await crearCategoria('Categoria Efimera');

      await request(app.getHttpServer())
        .delete(`/api/product-categories/${categoriaId}`)
        .set(...como(admin))
        .expect(204);

      const encontrados = await eventos(
        admin,
        `entidad=categoria&accion=categoria_eliminada&entidadId=${categoriaId}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({
        nombre: 'Categoria Efimera',
      });
    });

    it('crear una variante deja variante_creada sin sucursal afectada', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/variants')
        .set(...como(admin))
        .send({ nombre: 'Variante Auditada' })
        .expect(201);

      const encontrados = await eventos(
        admin,
        `entidad=variante&accion=variante_creada&entidadId=${respuesta.body.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].sucursalAfectadaId).toBeNull();
      expect(encontrados[0].detalle.despues).toMatchObject({
        nombre: 'Variante Auditada',
      });
    });

    it('borrar una variante sin precios deja variante_eliminada', async () => {
      const creada = await request(app.getHttpServer())
        .post('/api/variants')
        .set(...como(admin))
        .send({ nombre: 'Variante Efimera' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/variants/${creada.body.id}`)
        .set(...como(admin))
        .expect(204);

      const encontrados = await eventos(
        admin,
        `entidad=variante&accion=variante_eliminada&entidadId=${creada.body.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({
        nombre: 'Variante Efimera',
      });
    });

    it('crear un producto deja producto_creado sin sucursal afectada', async () => {
      const categoriaId = await crearCategoria('Bebidas Audit');

      const creado = await request(app.getHttpServer())
        .post('/api/products')
        .set(...como(admin))
        .send({ nombre: 'Cafe Audit', categoriaId })
        .expect(201);

      const encontrados = await eventos(
        admin,
        `entidad=producto&accion=producto_creado&entidadId=${creado.body.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].sucursalAfectadaId).toBeNull();
      expect(encontrados[0].detalle.despues).toMatchObject({
        nombre: 'Cafe Audit',
        categoriaId,
      });
    });

    it('editar un producto deja producto_editado con antes/despues', async () => {
      const categoriaId = await crearCategoria('Bebidas Audit');
      const creado = await request(app.getHttpServer())
        .post('/api/products')
        .set(...como(admin))
        .send({ nombre: 'Cafe Audit', categoriaId })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/products/${creado.body.id}`)
        .set(...como(admin))
        .send({ descripcion: 'Recien molido' })
        .expect(200);

      const encontrados = await eventos(
        admin,
        `entidad=producto&accion=producto_editado&entidadId=${creado.body.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({ descripcion: null });
      expect(encontrados[0].detalle.despues).toMatchObject({
        descripcion: 'Recien molido',
      });
    });

    it('borrar un producto sin precios deja producto_eliminado', async () => {
      const categoriaId = await crearCategoria('Bebidas Audit');
      const creado = await request(app.getHttpServer())
        .post('/api/products')
        .set(...como(admin))
        .send({ nombre: 'Cafe Audit', categoriaId })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/products/${creado.body.id}`)
        .set(...como(admin))
        .expect(204);

      const encontrados = await eventos(
        admin,
        `entidad=producto&accion=producto_eliminado&entidadId=${creado.body.id}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({
        nombre: 'Cafe Audit',
        categoriaId,
      });
    });

    it('una categoria duplicada (409) no deja evento', async () => {
      await crearCategoria('Categoria Unica');

      await request(app.getHttpServer())
        .post('/api/product-categories')
        .set(...como(admin))
        .send({ nombre: 'Categoria Unica' })
        .expect(409);

      const creados = await eventos(
        admin,
        'entidad=categoria&accion=categoria_creada',
      );
      expect(creados).toHaveLength(1);
    });
  });

  describe('eventos de oferta por sucursal', () => {
    function urlOferta(
      sucursalId: string,
      productoId: string,
      varianteId: string,
    ): string {
      return `/api/branches/${sucursalId}/products/${productoId}/variants/${varianteId}`;
    }

    /** Deja una categoria y un producto, y devuelve el token de un Gerente. */
    async function prepararCarta(): Promise<{
      productoId: string;
      varianteId: string;
      gerente: string;
    }> {
      const categoria = await request(app.getHttpServer())
        .post('/api/product-categories')
        .set(...como(admin))
        .send({ nombre: 'Carta Audit' })
        .expect(201);

      const producto = await request(app.getHttpServer())
        .post('/api/products')
        .set(...como(admin))
        .send({ nombre: 'Producto Carta', categoriaId: categoria.body.id })
        .expect(201);

      const gerente = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Carta Audit',
      );

      return {
        productoId: producto.body.id as string,
        varianteId: variantes.unica,
        gerente: gerente.token,
      };
    }

    it('fijar un precio nuevo deja oferta_creada ligada a la sucursal', async () => {
      const { productoId, varianteId, gerente } = await prepararCarta();

      await request(app.getHttpServer())
        .put(urlOferta(sucursales.centro, productoId, varianteId))
        .set(...como(gerente))
        .send({ precio: 2.5 })
        .expect(200);

      const encontrados = await eventos(
        admin,
        `entidad=oferta&accion=oferta_creada&sucursalId=${sucursales.centro}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].sucursalAfectadaId).toBe(sucursales.centro);
      expect(encontrados[0].detalle.despues).toMatchObject({
        productoId,
        varianteId,
        precio: '2.50',
        estado: 'activo',
      });
    });

    it('cambiar el precio deja oferta_precio_fijado', async () => {
      const { productoId, varianteId, gerente } = await prepararCarta();

      await request(app.getHttpServer())
        .put(urlOferta(sucursales.centro, productoId, varianteId))
        .set(...como(gerente))
        .send({ precio: 2.5 })
        .expect(200);

      await request(app.getHttpServer())
        .put(urlOferta(sucursales.centro, productoId, varianteId))
        .set(...como(gerente))
        .send({ precio: 3 })
        .expect(200);

      const encontrados = await eventos(
        admin,
        `entidad=oferta&accion=oferta_precio_fijado&sucursalId=${sucursales.centro}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({ precio: '2.50' });
      expect(encontrados[0].detalle.despues).toMatchObject({ precio: '3.00' });
    });

    it('desactivar y reactivar dejan oferta_desactivada y oferta_activada', async () => {
      const { productoId, varianteId, gerente } = await prepararCarta();
      const url = urlOferta(sucursales.centro, productoId, varianteId);

      await request(app.getHttpServer())
        .put(url)
        .set(...como(gerente))
        .send({ precio: 2.5 })
        .expect(200);

      await request(app.getHttpServer())
        .put(url)
        .set(...como(gerente))
        .send({ precio: 2.5, estado: 'inactivo' })
        .expect(200);

      await request(app.getHttpServer())
        .put(url)
        .set(...como(gerente))
        .send({ precio: 2.5, estado: 'activo' })
        .expect(200);

      const desactivada = await eventos(
        admin,
        `entidad=oferta&accion=oferta_desactivada&sucursalId=${sucursales.centro}`,
      );
      expect(desactivada).toHaveLength(1);
      expect(desactivada[0].detalle.antes).toMatchObject({ estado: 'activo' });
      expect(desactivada[0].detalle.despues).toMatchObject({ estado: 'inactivo' });

      const activada = await eventos(
        admin,
        `entidad=oferta&accion=oferta_activada&sucursalId=${sucursales.centro}`,
      );
      expect(activada).toHaveLength(1);
      expect(activada[0].detalle.antes).toMatchObject({ estado: 'inactivo' });
      expect(activada[0].detalle.despues).toMatchObject({ estado: 'activo' });
    });

    it('un Gerente que edita otra sucursal (404) no deja evento', async () => {
      const { productoId, varianteId, gerente } = await prepararCarta();

      await request(app.getHttpServer())
        .put(urlOferta(sucursales.sur, productoId, varianteId))
        .set(...como(gerente))
        .send({ precio: 2.5 })
        .expect(404);

      const encontrados = await eventos(
        admin,
        `entidad=oferta&accion=oferta_creada&sucursalId=${sucursales.sur}`,
      );
      expect(encontrados).toHaveLength(0);
    });
  });

  // --------------------------------------------------------- inventario

  describe('eventos de inventario', () => {
    async function crearInsumo(nombre: string): Promise<string> {
      const respuesta = await request(app.getHttpServer())
        .post('/api/insumos')
        .set(...como(admin))
        .send({ nombre, presentacion: 'paquete' })
        .expect(201);
      return respuesta.body.id as string;
    }

    function configurar(
      sucursalId: string,
      insumoId: string,
      datos: Record<string, unknown>,
    ) {
      return request(app.getHttpServer())
        .put(`/api/inventario/sucursales/${sucursalId}/insumos/${insumoId}`)
        .set(...como(admin))
        .send(datos)
        .expect(200);
    }

    it('crear un insumo deja insumo_creado sin sucursal afectada', async () => {
      const insumoId = await crearInsumo('Insumo Auditado');

      const encontrados = await eventos(
        admin,
        `entidad=insumo&accion=insumo_creado&entidadId=${insumoId}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].usuarioAfectadoId).toBeNull();
      expect(encontrados[0].sucursalAfectadaId).toBeNull();
      expect(encontrados[0].detalle.despues).toMatchObject({
        nombre: 'Insumo Auditado',
        presentacion: 'paquete',
      });
    });

    it('editar un insumo deja insumo_editado con antes/despues', async () => {
      const insumoId = await crearInsumo('Insumo Editable');

      await request(app.getHttpServer())
        .patch(`/api/insumos/${insumoId}`)
        .set(...como(admin))
        .send({ nombre: 'Insumo Editado' })
        .expect(200);

      const encontrados = await eventos(
        admin,
        `entidad=insumo&accion=insumo_editado&entidadId=${insumoId}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({ nombre: 'Insumo Editable' });
      expect(encontrados[0].detalle.despues).toMatchObject({ nombre: 'Insumo Editado' });
    });

    it('borrar un insumo sin stock deja insumo_eliminado', async () => {
      const insumoId = await crearInsumo('Insumo Efimero');

      await request(app.getHttpServer())
        .delete(`/api/insumos/${insumoId}`)
        .set(...como(admin))
        .expect(204);

      const encontrados = await eventos(
        admin,
        `entidad=insumo&accion=insumo_eliminado&entidadId=${insumoId}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({ nombre: 'Insumo Efimero' });
    });

    it('configurar stock deja insumo_sucursal_creado ligado a la sucursal', async () => {
      const insumoId = await crearInsumo('Insumo con Stock');

      await configurar(sucursales.centro, insumoId, { stockMinimo: 4 });

      const encontrados = await eventos(
        admin,
        `entidad=insumo_sucursal&accion=insumo_sucursal_creado&sucursalId=${sucursales.centro}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].sucursalAfectadaId).toBe(sucursales.centro);
      expect(encontrados[0].detalle.despues).toMatchObject({
        stockMinimo: '4.00',
        estado: 'activo',
      });
    });

    it('cambiar el minimo deja insumo_sucursal_stock_minimo_cambiado', async () => {
      const insumoId = await crearInsumo('Insumo con Minimo');

      await configurar(sucursales.centro, insumoId, { stockMinimo: 4 });
      await configurar(sucursales.centro, insumoId, { stockMinimo: 9 });

      const encontrados = await eventos(
        admin,
        `entidad=insumo_sucursal&accion=insumo_sucursal_stock_minimo_cambiado&sucursalId=${sucursales.centro}`,
      );

      expect(encontrados).toHaveLength(1);
      expect(encontrados[0].detalle.antes).toMatchObject({ stockMinimo: '4.00' });
      expect(encontrados[0].detalle.despues).toMatchObject({ stockMinimo: '9.00' });
    });

    it('descontinuar y reactivar dejan insumo_sucursal_descontinuado y activado', async () => {
      const insumoId = await crearInsumo('Insumo con Estado');

      await configurar(sucursales.centro, insumoId, { stockMinimo: 4 });
      await configurar(sucursales.centro, insumoId, { estado: 'descontinuado' });
      await configurar(sucursales.centro, insumoId, { estado: 'activo' });

      const descontinuados = await eventos(
        admin,
        `entidad=insumo_sucursal&accion=insumo_sucursal_descontinuado&sucursalId=${sucursales.centro}`,
      );
      expect(descontinuados).toHaveLength(1);
      expect(descontinuados[0].detalle.antes).toMatchObject({ estado: 'activo' });
      expect(descontinuados[0].detalle.despues).toMatchObject({ estado: 'descontinuado' });

      const activados = await eventos(
        admin,
        `entidad=insumo_sucursal&accion=insumo_sucursal_activado&sucursalId=${sucursales.centro}`,
      );
      expect(activados).toHaveLength(1);
      expect(activados[0].detalle.antes).toMatchObject({ estado: 'descontinuado' });
      expect(activados[0].detalle.despues).toMatchObject({ estado: 'activo' });
    });

    it('borrar un insumo con stock configurado (409) no deja evento', async () => {
      const insumoId = await crearInsumo('Insumo en Uso');

      await configurar(sucursales.centro, insumoId, { stockMinimo: 1 });

      await request(app.getHttpServer())
        .delete(`/api/insumos/${insumoId}`)
        .set(...como(admin))
        .expect(409);

      const eliminados = await eventos(
        admin,
        `entidad=insumo&accion=insumo_eliminado&entidadId=${insumoId}`,
      );
      expect(eliminados).toHaveLength(0);
    });
  });

  // --------------------------------------------------------- fechas

  describe('bordes de fecha (America/Lima)', () => {
    it('un rango del dia de hoy incluye los eventos recien creados', async () => {
      await crearUsuarioPorHttp(app, admin, {
        nombre: 'Fecha Hoy',
        nombreUsuario: 'fecha.hoy',
        rol: 'Empleado',
        sucursalId: sucursales.centro,
      });

      const hoy = fechaLocalHoy();
      const pagina = await listar(admin, `?desde=${hoy}&hasta=${hoy}`);

      expect(pagina.total).toBeGreaterThanOrEqual(1);
    });

    it('un hasta anterior al alta de los datos no devuelve nada', async () => {
      const pagina = await listar(admin, '?hasta=2000-01-01');
      expect(pagina.total).toBe(0);
    });

    it('rechaza un rango invertido con 400', async () => {
      await request(app.getHttpServer())
        .get('/api/auditoria?desde=2026-03-01&hasta=2026-01-01')
        .set(...como(admin))
        .expect(400);
    });

    it('rechaza un rango de mas de 92 dias con 400', async () => {
      await request(app.getHttpServer())
        .get('/api/auditoria?desde=2020-01-01&hasta=2026-01-01')
        .set(...como(admin))
        .expect(400);
    });

    it('rechaza una fecha que no existe con 400', async () => {
      await request(app.getHttpServer())
        .get('/api/auditoria?desde=2026-13-01')
        .set(...como(admin))
        .expect(400);
    });

    it('rechaza un formato de fecha invalido con 400', async () => {
      await request(app.getHttpServer())
        .get('/api/auditoria?desde=2026-1-1')
        .set(...como(admin))
        .expect(400);
    });
  });

  describe('enums de auditoria en la base de datos', () => {
    type FilaEnum = { tipo: string; valor: string };

    async function valoresDelEnum(): Promise<Map<string, Set<string>>> {
      const filas = await clientePrueba().$queryRawUnsafe<FilaEnum[]>(
        `SELECT t.typname AS tipo, e.enumlabel AS valor
           FROM pg_enum e
           JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname IN ('auditoria_accion', 'auditoria_entidad')`,
      );

      const porTipo = new Map<string, Set<string>>();
      for (const { tipo, valor } of filas) {
        const conjunto = porTipo.get(tipo) ?? new Set<string>();
        conjunto.add(valor);
        porTipo.set(tipo, conjunto);
      }
      return porTipo;
    }

    it('cada accion definida en el codigo existe en el enum de la BD', async () => {
      const enBd =
        (await valoresDelEnum()).get('auditoria_accion') ?? new Set<string>();
      const enCodigo = new Set<string>(Object.values(AuditoriaAccion));

      // Ninguna accion del codigo puede faltar en la migracion...
      expect([...enCodigo].filter((valor) => !enBd.has(valor)).sort()).toEqual([]);
      // ...ni la migracion tener acciones que el codigo no conozca.
      expect([...enBd].filter((valor) => !enCodigo.has(valor)).sort()).toEqual([]);
    });

    it('cada entidad definida en el codigo existe en el enum de la BD', async () => {
      const enBd =
        (await valoresDelEnum()).get('auditoria_entidad') ?? new Set<string>();
      const enCodigo = new Set<string>(Object.values(AuditoriaEntidad));

      expect([...enCodigo].filter((valor) => !enBd.has(valor)).sort()).toEqual([]);
      expect([...enBd].filter((valor) => !enCodigo.has(valor)).sort()).toEqual([]);
    });

    it('el enum de la BD usa insumo_sucursal_descontinuado (no desactivado)', async () => {
      const enBd = await valoresDelEnum();
      const acciones = enBd.get('auditoria_accion') ?? new Set<string>();

      expect(acciones.has('insumo_sucursal_activado')).toBe(true);
      expect(acciones.has('insumo_sucursal_descontinuado')).toBe(true);
      expect(acciones.has('insumo_sucursal_desactivado')).toBe(false);
    });
  });
});
