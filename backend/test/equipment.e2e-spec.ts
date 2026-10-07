// Pruebas E2E del módulo de equipos.

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearAppDePruebas } from './utils/crear-app-pruebas';
import { clientePrueba, cerrarClientePrueba, resetDatabase } from './utils/reset-database';
import { como, iniciarSesion, tokenDeAdmin } from './utils/http-pruebas';
import {
  crearEmpleado,
  crearGerente,
  idDePermiso,
  idsDeSucursales,
  type Sucursales,
  type UsuarioCreado,
} from './utils/fixtures-pruebas';
import { PASSWORD_VALIDA_PRUEBAS } from './utils/constantes-pruebas';

type EquipoE2E = {
  id: string;
  sucursalId: string;
  nombre: string;
  tipo: string;
  estado: string;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
};

type HistorialE2E = {
  id: string;
  equipoId: string;
  estadoAnterior: string;
  estadoNuevo: string;
  observacionesAnterior: string | null;
  observacionesNuevas: string | null;
  usuarioId: string;
  createdAt: string;
};

type Paginado<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPaginas: number;
};

function mensajesDe(cuerpo: unknown): string[] {
  const mensaje = (cuerpo as { message?: string | string[] }).message;
  if (mensaje === undefined) {
    return [];
  }
  return Array.isArray(mensaje) ? mensaje : [mensaje];
}

/** UUID v1 valido e inexistente, util para casos 404. */
const ID_INEXISTENTE = 'a2c1e2c0-1234-11ec-8d3d-0242ac130003';

type GerenteCreado = { usuario: UsuarioCreado; token: string };

describe('equipment (e2e)', () => {
  let app: INestApplication;
  let admin: string;
  let sucursales: Sucursales;
  let gerenteCentro: GerenteCreado;
  let gerenteNorte: GerenteCreado;
  let empleadoCentro: UsuarioCreado;
  let empleadoCentroLogueado: string;
  let equipoCentro: EquipoE2E;

  /** Crea un equipo como Admin en una sucursal dada y devuelve el cuerpo. */
  async function crearEquipo(
    sucursalId: string,
    nombre = 'Equipo Auxiliar',
    tipo = 'Auxiliar',
    observaciones?: string,
  ): Promise<EquipoE2E> {
    const respuesta = await request(app.getHttpServer())
      .post('/api/equipment')
      .set(...como(admin))
      .send({
        sucursalId,
        nombre,
        tipo,
        ...(observaciones !== undefined ? { observaciones } : {}),
      })
      .expect(201);
    return respuesta.body as EquipoE2E;
  }

  /** Devuelve la lista paginada de historial de un equipo. */
  async function historialDe(id: string, query = ''): Promise<Paginado<HistorialE2E>> {
    const respuesta = await request(app.getHttpServer())
      .get(`/api/equipment/${id}/history${query}`)
      .set(...como(admin))
      .expect(200);
    return respuesta.body as Paginado<HistorialE2E>;
  }

  beforeAll(async () => {
    app = await crearAppDePruebas();
    await resetDatabase(clientePrueba());

    admin = await tokenDeAdmin(app);
    sucursales = await idsDeSucursales();

    gerenteCentro = await crearGerente(app, admin, sucursales.centro, 'Gerente Eq Centro');
    gerenteNorte = await crearGerente(app, admin, sucursales.norte, 'Gerente Eq Norte');
    empleadoCentro = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Eq');

    const acceso = await iniciarSesion(
      app,
      'empleado.eq@cafeteria.test',
      PASSWORD_VALIDA_PRUEBAS,
    ).expect(200);
    empleadoCentroLogueado = acceso.body.accessToken as string;

    const resp = await request(app.getHttpServer())
      .post('/api/equipment')
      .set(...como(gerenteCentro.token))
      .send({
        sucursalId: sucursales.centro,
        nombre: 'Cafetera Central',
        tipo: 'Cafetera',
        observaciones: 'Nueva',
      })
      .expect(201);
    equipoCentro = resp.body as EquipoE2E;
  });

  afterAll(async () => {
    await app.close();
    await cerrarClientePrueba();
  });

  describe('autorizacion y creacion', () => {
    it('sin token devuelve 401 en todas las rutas', async () => {
      await request(app.getHttpServer()).post('/api/equipment').expect(401);
      await request(app.getHttpServer()).get('/api/equipment').expect(401);
      await request(app.getHttpServer()).get(`/api/equipment/${equipoCentro.id}`).expect(401);
      await request(app.getHttpServer()).get(`/api/equipment/${equipoCentro.id}/history`).expect(401);
    });

    it('admin crea equipo en cualquier sucursal', async () => {
      const resp = await request(app.getHttpServer())
        .post('/api/equipment')
        .set(...como(admin))
        .send({
          sucursalId: sucursales.norte,
          nombre: 'Molino Norte',
          tipo: 'Molino',
        })
        .expect(201);
      expect(resp.body.sucursalId).toBe(sucursales.norte);
      expect(resp.body.estado).toBe('funcionando');
      expect(resp.body.observaciones).toBeNull();
    });

    it('admin crea con sucursal inexistente -> 404', async () => {
      await request(app.getHttpServer())
        .post('/api/equipment')
        .set(...como(admin))
        .send({
          sucursalId: ID_INEXISTENTE,
          nombre: 'Horno Inexistente',
          tipo: 'Horno',
        })
        .expect(404);
    });

    it('gerente forza sucursal a la suya aunque envie otra', async () => {
      const resp = await request(app.getHttpServer())
        .post('/api/equipment')
        .set(...como(gerenteCentro.token))
        .send({
          sucursalId: sucursales.norte,
          nombre: 'Impresora Centro',
          tipo: 'Impresora',
        })
        .expect(201);
      expect(resp.body.sucursalId).toBe(sucursales.centro);
    });

    it('empleado sin equipo.registrar_editar no puede crear -> 403', async () => {
      await request(app.getHttpServer())
        .post('/api/equipment')
        .set(...como(empleadoCentroLogueado))
        .send({
          sucursalId: sucursales.centro,
          nombre: 'Test Sin Permiso',
          tipo: 'Test',
        })
        .expect(403);
    });

    it('empleado sin equipo.ver no puede listar -> 403', async () => {
      await request(app.getHttpServer())
        .get('/api/equipment')
        .set(...como(empleadoCentroLogueado))
        .expect(403);
    });
  });

  describe('validaciones', () => {
    it('POST con nombre demasiado corto -> 400', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/equipment')
        .set(...como(admin))
        .send({ sucursalId: sucursales.centro, nombre: 'X', tipo: 'Horno' })
        .expect(400);
      expect(mensajesDe(respuesta.body).join(' ')).toContain('nombre');
    });

    it('POST con tipo demasiado corto -> 400', async () => {
      await request(app.getHttpServer())
        .post('/api/equipment')
        .set(...como(admin))
        .send({ sucursalId: sucursales.centro, nombre: 'Horno Real', tipo: 'H' })
        .expect(400);
    });

    it('POST sin sucursalId -> 400', async () => {
      await request(app.getHttpServer())
        .post('/api/equipment')
        .set(...como(admin))
        .send({ nombre: 'Horno Real', tipo: 'Horno' })
        .expect(400);
    });

    it('ids que no son uuid -> 400', async () => {
      await request(app.getHttpServer())
        .get('/api/equipment/abc')
        .set(...como(admin))
        .expect(400);
      await request(app.getHttpServer())
        .patch('/api/equipment/abc')
        .set(...como(admin))
        .send({})
        .expect(400);
    });

    it('PATCH con estado invalido -> 400', async () => {
      const equipo = await crearEquipo(sucursales.centro, 'Pieza Invalida', 'Pieza');
      await request(app.getHttpServer())
        .patch(`/api/equipment/${equipo.id}`)
        .set(...como(admin))
        .send({ estado: 'roto' })
        .expect(400);
    });

    it('PATCH con nombre demasiado corto -> 400', async () => {
      const equipo = await crearEquipo(sucursales.centro, 'Pieza Nombres', 'Pieza');
      await request(app.getHttpServer())
        .patch(`/api/equipment/${equipo.id}`)
        .set(...como(admin))
        .send({ nombre: 'A' })
        .expect(400);
    });

    it('PATCH de equipo inexistente -> 404', async () => {
      await request(app.getHttpServer())
        .patch(`/api/equipment/${ID_INEXISTENTE}`)
        .set(...como(admin))
        .send({ estado: 'danado' })
        .expect(404);
    });

    it('obtener equipo inexistente -> 404', async () => {
      await request(app.getHttpServer())
        .get(`/api/equipment/${ID_INEXISTENTE}`)
        .set(...como(admin))
        .expect(404);
    });

    it('historial de equipo inexistente -> 404', async () => {
      await request(app.getHttpServer())
        .get(`/api/equipment/${ID_INEXISTENTE}/history`)
        .set(...como(admin))
        .expect(404);
    });
  });

  describe('actualizacion e historial', () => {
    it('cambiar el estado crea un historial con el usuario y los valores anteriores', async () => {
      const equipo = await crearEquipo(sucursales.centro, 'Licuadora Hist', 'Licuadora', 'Lista');

      const actualizado = await request(app.getHttpServer())
        .patch(`/api/equipment/${equipo.id}`)
        .set(...como(gerenteCentro.token))
        .send({ estado: 'danado', observaciones: 'Peda de reparacion' })
        .expect(200);
      expect(actualizado.body.estado).toBe('danado');

      const historial = await historialDe(equipo.id);
      expect(historial.total).toBe(1);
      const registro = historial.data[0];
      expect(registro).toBeDefined();
      expect(registro?.estadoAnterior).toBe('funcionando');
      expect(registro?.estadoNuevo).toBe('danado');
      expect(registro?.observacionesAnterior).toBe('Lista');
      expect(registro?.observacionesNuevas).toBe('Peda de reparacion');
      expect(registro?.usuarioId).toBe(gerenteCentro.usuario.id);
    });

    it('cambiar solo el nombre no genera historial', async () => {
      const equipo = await crearEquipo(sucursales.centro, 'Nombre Antiguo', 'Microonda');

      await request(app.getHttpServer())
        .patch(`/api/equipment/${equipo.id}`)
        .set(...como(gerenteCentro.token))
        .send({ nombre: 'Nombre Nuevo' })
        .expect(200);

      const historial = await historialDe(equipo.id);
      expect(historial.total).toBe(0);
    });

    it('cambiar observaciones registra el historial', async () => {
      const equipo = await crearEquipo(sucursales.centro, 'Vitrina Obs', 'Vitrina', 'Antigua');

      await request(app.getHttpServer())
        .patch(`/api/equipment/${equipo.id}`)
        .set(...como(gerenteCentro.token))
        .send({ observaciones: 'Nueva observacion' })
        .expect(200);

      const historial = await historialDe(equipo.id);
      expect(historial.total).toBe(1);
      expect(historial.data[0]?.observacionesAnterior).toBe('Antigua');
      expect(historial.data[0]?.observacionesNuevas).toBe('Nueva observacion');
    });

    it('PATCH sin cambios devuelve el mismo equipo sin historial', async () => {
      const equipo = await crearEquipo(sucursales.centro, 'Sin Cambios', 'Pieza');

      const actualizado = await request(app.getHttpServer())
        .patch(`/api/equipment/${equipo.id}`)
        .set(...como(gerenteCentro.token))
        .send({ estado: 'funcionando', nombre: 'Sin Cambios', tipo: 'Pieza' })
        .expect(200);
      expect(actualizado.body.estado).toBe('funcionando');

      const historial = await historialDe(equipo.id);
      expect(historial.total).toBe(0);
    });

    it('un equipo retirado no puede volver a cambiar de estado -> 409', async () => {
      const equipo = await crearEquipo(sucursales.centro, 'Equipo Retirado', 'Pieza');

      await request(app.getHttpServer())
        .patch(`/api/equipment/${equipo.id}`)
        .set(...como(gerenteCentro.token))
        .send({ estado: 'retirado' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/equipment/${equipo.id}`)
        .set(...como(gerenteCentro.token))
        .send({ estado: 'funcionando' })
        .expect(409);

      // Sigue pudiendo cambiar datos que no sean de estado.
      await request(app.getHttpServer())
        .patch(`/api/equipment/${equipo.id}`)
        .set(...como(gerenteCentro.token))
        .send({ nombre: 'Retirado Renombrado' })
        .expect(200);
    });

    it('un gerente no puede actualizar un equipo de otra sucursal -> 404', async () => {
      const equipo = await crearEquipo(sucursales.norte, 'Equipo Solo Norte', 'Pieza');

      await request(app.getHttpServer())
        .patch(`/api/equipment/${equipo.id}`)
        .set(...como(gerenteCentro.token))
        .send({ estado: 'danado' })
        .expect(404);
    });

    it('historial paginado con page y limit', async () => {
      const equipo = await crearEquipo(sucursales.centro, 'Paginar Hist', 'Pieza');
      const token = gerenteCentro.token;

      for (let i = 0; i < 3; i += 1) {
        await request(app.getHttpServer())
          .patch(`/api/equipment/${equipo.id}`)
          .set(...como(token))
          .send({ estado: i % 2 === 0 ? 'danado' : 'en_mantenimiento' })
          .expect(200);
      }

      const pagina1 = await historialDe(equipo.id, '?page=1&limit=2');
      expect(pagina1.data).toHaveLength(2);
      expect(pagina1.total).toBe(3);
      expect(pagina1.page).toBe(1);
      expect(pagina1.limit).toBe(2);
      expect(pagina1.totalPaginas).toBe(2);
    });
  });

  describe('listado y alcance', () => {
    it('admin lista todos los equipos con el envelope paginado', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/api/equipment')
        .set(...como(admin))
        .expect(200);

      const cuerpo = respuesta.body as Paginado<EquipoE2E>;
      expect(cuerpo.total).toBeGreaterThanOrEqual(3);
      expect(cuerpo.data).toHaveLength(cuerpo.total > 10 ? 10 : cuerpo.total);
      expect(cuerpo.page).toBe(1);
      expect(cuerpo.limit).toBe(10);
      expect(cuerpo.totalPaginas).toBe(Math.ceil(cuerpo.total / 10));
    });

    it('admin filtra por sucursal', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(`/api/equipment?sucursalId=${sucursales.centro}`)
        .set(...como(admin))
        .expect(200);

      const cuerpo = respuesta.body as Paginado<EquipoE2E>;
      expect(cuerpo.total).toBeGreaterThanOrEqual(2);
      for (const equipo of cuerpo.data) {
        expect(equipo.sucursalId).toBe(sucursales.centro);
      }
    });

    it('admin filtra por estado y busqueda', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(`/api/equipment?estado=danado&busqueda=Licuadora`)
        .set(...como(admin))
        .expect(200);

      const cuerpo = respuesta.body as Paginado<EquipoE2E>;
      expect(cuerpo.total).toBe(1);
      expect(cuerpo.data[0]?.nombre).toBe('Licuadora Hist');
    });

    it('un gerente solo ve su sucursal', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/api/equipment')
        .set(...como(gerenteCentro.token))
        .expect(200);

      const cuerpo = respuesta.body as Paginado<EquipoE2E>;
      expect(cuerpo.total).toBeGreaterThanOrEqual(2);
      for (const equipo of cuerpo.data) {
        expect(equipo.sucursalId).toBe(sucursales.centro);
      }

      const norte = await request(app.getHttpServer())
        .get('/api/equipment')
        .set(...como(gerenteNorte.token))
        .expect(200);
      const cuerpoNorte = norte.body as Paginado<EquipoE2E>;
      for (const equipo of cuerpoNorte.data) {
        expect(equipo.sucursalId).toBe(sucursales.norte);
      }
    });

    it('un gerente no puede ver un equipo de otra sucursal -> 404', async () => {
      await request(app.getHttpServer())
        .get(`/api/equipment/${equipoCentro.id}`)
        .set(...como(gerenteNorte.token))
        .expect(404);

      await request(app.getHttpServer())
        .get(`/api/equipment/${equipoCentro.id}/history`)
        .set(...como(gerenteNorte.token))
        .expect(404);
    });

    it('paginado con page y limit', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/api/equipment?page=1&limit=2')
        .set(...como(admin))
        .expect(200);

      const cuerpo = respuesta.body as Paginado<EquipoE2E>;
      expect(cuerpo.data).toHaveLength(2);
      expect(cuerpo.page).toBe(1);
      expect(cuerpo.limit).toBe(2);
    });
  });

  describe('permisos concedidos a un Empleado', () => {
    it('un Empleado con equipo.ver concedido puede ver pero no editar', async () => {
      const permisoId = await idDePermiso('equipo.ver');
      await request(app.getHttpServer())
        .put(`/api/users/${empleadoCentro.id}/permisos/${permisoId}`)
        .set(...como(gerenteCentro.token))
        .send({ tipo: 'concedido' })
        .expect(204);

      const lista = await request(app.getHttpServer())
        .get('/api/equipment')
        .set(...como(empleadoCentroLogueado))
        .expect(200);
      const cuerpo = lista.body as Paginado<EquipoE2E>;
      for (const equipo of cuerpo.data) {
        expect(equipo.sucursalId).toBe(sucursales.centro);
      }

      await request(app.getHttpServer())
        .get(`/api/equipment/${equipoCentro.id}`)
        .set(...como(empleadoCentroLogueado))
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/equipment/${equipoCentro.id}/history`)
        .set(...como(empleadoCentroLogueado))
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/equipment')
        .set(...como(empleadoCentroLogueado))
        .send({ sucursalId: sucursales.centro, nombre: 'Nuevo Empleado', tipo: 'Pieza' })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/equipment/${equipoCentro.id}`)
        .set(...como(empleadoCentroLogueado))
        .send({ estado: 'danado' })
        .expect(403);
    });
  });
});