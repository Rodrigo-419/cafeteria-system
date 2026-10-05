// Pruebas E2E del modulo de sucursales.
//
// Todas las peticiones van por HTTP contra la base de pruebas; los ids de
// sucursal se leen de la base porque el seed genera UUIDs v7 nuevas en cada
// reset.
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearAppDePruebas } from './utils/crear-app-pruebas';
import {
  clientePrueba,
  cerrarClientePrueba,
  resetDatabase,
} from './utils/reset-database';
import { como, iniciarSesion, tokenDeAdmin } from './utils/http-pruebas';
import {
  crearEmpleado,
  crearGerente,
  idsDeSucursales,
  type Sucursales,
} from './utils/fixtures-pruebas';
import { PASSWORD_VALIDA_PRUEBAS } from './utils/constantes-pruebas';

/** Campos que la API debe devolver, y solo esos. */
const CAMPOS_SUCURSAL = [
  'createdAt',
  'direccion',
  'id',
  'nombre',
  'telefono',
  'updatedAt',
];

type SucursalRespuestaE2E = {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string | null;
  createdAt: string;
  updatedAt: string;
};

async function crearSucursalPorHttp(
  app: INestApplication,
  token: string,
  datos: { nombre: string; direccion?: string; telefono?: string | null },
): Promise<SucursalRespuestaE2E> {
  const respuesta = await request(app.getHttpServer())
    .post('/api/branches')
    .set(...como(token))
    .send({
      nombre: datos.nombre,
      direccion: datos.direccion ?? 'Calle de Prueba 1',
      ...(datos.telefono !== undefined ? { telefono: datos.telefono } : {}),
    })
    .expect(201);

  return respuesta.body as SucursalRespuestaE2E;
}

describe('branches (e2e)', () => {
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

  // ------------------------------------------------------------------ crear

  describe('POST /branches', () => {
    it('el Admin crea una sucursal y devuelve 201', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({
          nombre: 'Sucursal Nueva',
          direccion: 'Calle Nueva 42',
          telefono: '600000000',
        })
        .expect(201);

      const cuerpo = respuesta.body as SucursalRespuestaE2E;
      expect(cuerpo.nombre).toBe('Sucursal Nueva');
      expect(cuerpo.direccion).toBe('Calle Nueva 42');
      expect(cuerpo.telefono).toBe('600000000');
      expect(typeof cuerpo.id).toBe('string');
      expect(cuerpo.createdAt).toBeTruthy();
      expect(cuerpo.updatedAt).toBeTruthy();
    });

    it('la respuesta no trae campos inesperados', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({ nombre: 'Sucursal Sin Ruido', direccion: 'Calle 1' })
        .expect(201);

      expect(Object.keys(respuesta.body as object).sort()).toEqual(CAMPOS_SUCURSAL);
    });

    it('el Admin crea una sucursal sin telefono', async () => {
      const creada = await crearSucursalPorHttp(app, admin, {
        nombre: 'Sucursal Sin Telefono',
      });

      expect(creada.telefono).toBeNull();
    });

    it('recorta los espacios de nombre, direccion y telefono', async () => {
      // El recorte tiene que verse ya en la respuesta, no solo al leerla de la
      // base: es el servicio el que lo aplica antes de guardar.
      const creada = await crearSucursalPorHttp(app, admin, {
        nombre: '  Sucursal Recortada  ',
        direccion: '  Calle Recortada 7  ',
        telefono: '  611111111  ',
      });

      expect(creada.nombre).toBe('Sucursal Recortada');
      expect(creada.direccion).toBe('Calle Recortada 7');
      expect(creada.telefono).toBe('611111111');
    });

    it('rechaza un nombre duplicado con 409', async () => {
      await crearSucursalPorHttp(app, admin, { nombre: 'Sucursal Repetida' });

      const respuesta = await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({ nombre: 'Sucursal Repetida', direccion: 'Otra calle' })
        .expect(409);

      expect((respuesta.body as { message: string }).message).toBe(
        'Ya existe una sucursal con ese nombre',
      );
    });

    it('rechaza el mismo nombre con distinta capitalizacion con 409', async () => {
      await crearSucursalPorHttp(app, admin, { nombre: 'Sucursal Repetida' });

      await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({ nombre: 'SUCURSAL REPETIDA', direccion: 'Otra calle' })
        .expect(409);
    });

    it('rechaza el mismo nombre con espacios sobrantes con 409', async () => {
      await crearSucursalPorHttp(app, admin, { nombre: 'Sucursal Repetida' });

      await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({ nombre: '  Sucursal   Repetida  ', direccion: 'Otra calle' })
        .expect(409);
    });

    it('choca con las sucursales del seed tambien', async () => {
      await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({ nombre: 'sucursal centro', direccion: 'Calle 1' })
        .expect(409);
    });

    it('no crea nada cuando el nombre esta repetido', async () => {
      await crearSucursalPorHttp(app, admin, { nombre: 'Sucursal Repetida' });

      await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({ nombre: 'Sucursal Repetida', direccion: 'Otra calle' })
        .expect(409);

      const total = await clientePrueba().sucursal.count();
      // 3 del seed + la que se acaba de crear. Si el POST rechazado hubiera
      // escrito algo, serian 5.
      expect(total).toBe(4);
    });

    it('exige el nombre', async () => {
      await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({ direccion: 'Calle 1' })
        .expect(400);
    });

    it('rechaza un nombre vacio con 400', async () => {
      await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({ nombre: '   ', direccion: 'Calle 1' })
        .expect(400);
    });

    it('rechaza un nombre de un solo caracter con 400', async () => {
      await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({ nombre: ' A ', direccion: 'Calle 1' })
        .expect(400);
    });

    it('exige la direccion', async () => {
      await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({ nombre: 'Sucursal Sin Direccion' })
        .expect(400);
    });

    it('rechaza campos que no existen con 400', async () => {
      await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(admin))
        .send({ nombre: 'Sucursal Con Ruido', direccion: 'Calle 1', activo: true })
        .expect(400);
    });
  });

  // ----------------------------------------------------------------- editar

  describe('PATCH /branches/:id', () => {
    it('el Admin edita y devuelve 200', async () => {
      const creada = await crearSucursalPorHttp(app, admin, {
        nombre: 'Sucursal Editable',
        direccion: 'Calle Vieja 1',
        telefono: '600000000',
      });

      const respuesta = await request(app.getHttpServer())
        .patch(`/api/branches/${creada.id}`)
        .set(...como(admin))
        .send({
          nombre: 'Sucursal Renombrada',
          direccion: 'Calle Nueva 2',
          telefono: '699999999',
        })
        .expect(200);

      const cuerpo = respuesta.body as SucursalRespuestaE2E;
      expect(cuerpo.id).toBe(creada.id);
      expect(cuerpo.nombre).toBe('Sucursal Renombrada');
      expect(cuerpo.direccion).toBe('Calle Nueva 2');
      expect(cuerpo.telefono).toBe('699999999');
    });

    it('la edicion es parcial: lo que no se manda no se toca', async () => {
      const creada = await crearSucursalPorHttp(app, admin, {
        nombre: 'Sucursal Parcial',
        direccion: 'Calle Original 3',
        telefono: '600000000',
      });

      await request(app.getHttpServer())
        .patch(`/api/branches/${creada.id}`)
        .set(...como(admin))
        .send({ direccion: 'Calle Cambiada 4' })
        .expect(200);

      const guardado = await clientePrueba().sucursal.findUnique({
        where: { id: creada.id },
      });
      expect(guardado?.nombre).toBe('Sucursal Parcial');
      expect(guardado?.direccion).toBe('Calle Cambiada 4');
      expect(guardado?.telefono).toBe('600000000');
    });

    it('deja vaciar el telefono con null', async () => {
      const creada = await crearSucursalPorHttp(app, admin, {
        nombre: 'Sucursal Sin Movil',
        telefono: '600000000',
      });

      const respuesta = await request(app.getHttpServer())
        .patch(`/api/branches/${creada.id}`)
        .set(...como(admin))
        .send({ telefono: null })
        .expect(200);

      expect((respuesta.body as SucursalRespuestaE2E).telefono).toBeNull();
    });

    it('conserva el nombre si se reenvia con otra capitalizacion', async () => {
      const creada = await crearSucursalPorHttp(app, admin, {
        nombre: 'Sucursal Misma',
      });

      const respuesta = await request(app.getHttpServer())
        .patch(`/api/branches/${creada.id}`)
        .set(...como(admin))
        .send({ nombre: '  SUCURSAL   MISMA  ' })
        .expect(200);

      // Lo que se guarda es el texto recortado, con su espaciado interior: la
      // regla del campo es "trim", no "colapsar espacios". Lo que ignora mayusculas
      // y espacios sobrantes es la COMPARACION de unicidad, que es la de arriba.
      expect((respuesta.body as SucursalRespuestaE2E).nombre).toBe(
        'SUCURSAL   MISMA',
      );
    });

    it('no puede tomar el nombre de otra sucursal con 409', async () => {
      const creada = await crearSucursalPorHttp(app, admin, {
        nombre: 'Sucursal Imitadora',
      });

      const respuesta = await request(app.getHttpServer())
        .patch(`/api/branches/${creada.id}`)
        .set(...como(admin))
        .send({ nombre: 'Sucursal Norte' })
        .expect(409);

      expect((respuesta.body as { message: string }).message).toBe(
        'Ya existe una sucursal con ese nombre',
      );

      // La sucursal no cambio de nombre.
      const guardado = await clientePrueba().sucursal.findUnique({
        where: { id: creada.id },
      });
      expect(guardado?.nombre).toBe('Sucursal Imitadora');
    });

    it('no puede tomar el nombre de otra ignorando mayusculas con 409', async () => {
      const creada = await crearSucursalPorHttp(app, admin, {
        nombre: 'Sucursal Imitadora',
      });

      await request(app.getHttpServer())
        .patch(`/api/branches/${creada.id}`)
        .set(...como(admin))
        .send({ nombre: '  sucursal sur ' })
        .expect(409);
    });

    it('devuelve 404 si la sucursal no existe', async () => {
      // Un id con formato UUID v7 valido pero que no esta en la base.
      await request(app.getHttpServer())
        .patch('/api/branches/0192f0a0-0000-7000-8000-000000000000')
        .set(...como(admin))
        .send({ nombre: 'Sucursal Fantasma' })
        .expect(404);
    });

    it('valida los campos tambien al editar', async () => {
      const creada = await crearSucursalPorHttp(app, admin, {
        nombre: 'Sucursal Validada',
      });

      await request(app.getHttpServer())
        .patch(`/api/branches/${creada.id}`)
        .set(...como(admin))
        .send({ nombre: '' })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/api/branches/${creada.id}`)
        .set(...como(admin))
        .send({ direccion: '   ' })
        .expect(400);
    });
  });

  // ----------------------------------------------------------- ver listado

  describe('GET /branches', () => {
    it('el Admin ve todas ordenadas por nombre', async () => {
      await crearSucursalPorHttp(app, admin, { nombre: 'Sucursal Alfa' });

      const respuesta = await request(app.getHttpServer())
        .get('/api/branches')
        .set(...como(admin))
        .expect(200);

      const lista = respuesta.body as SucursalRespuestaE2E[];
      expect(lista.map((s) => s.nombre)).toEqual([
        'Sucursal Alfa',
        'Sucursal Centro',
        'Sucursal Norte',
        'Sucursal Sur',
      ]);
    });

    it('un Gerente ve solo su sucursal', async () => {
      const { token } = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Listado',
      );

      const respuesta = await request(app.getHttpServer())
        .get('/api/branches')
        .set(...como(token))
        .expect(200);

      const lista = respuesta.body as SucursalRespuestaE2E[];
      expect(lista).toHaveLength(1);
      expect(lista[0]?.id).toBe(sucursales.centro);
      expect(lista[0]?.nombre).toBe('Sucursal Centro');
    });

    it('un Empleado ve solo su sucursal', async () => {
      const empleado = await crearEmpleado(
        app,
        admin,
        sucursales.norte,
        'Empleado Listado',
      );
      const token = (
        await iniciarSesion(app, empleado.email, PASSWORD_VALIDA_PRUEBAS).expect(200)
      ).body.accessToken as string;

      const respuesta = await request(app.getHttpServer())
        .get('/api/branches')
        .set(...como(token))
        .expect(200);

      const lista = respuesta.body as SucursalRespuestaE2E[];
      expect(lista).toHaveLength(1);
      expect(lista[0]?.id).toBe(sucursales.norte);
    });

    it('el listado no expone campos de mas', async () => {
      const respuesta = await request(app.getHttpServer())
        .get('/api/branches')
        .set(...como(admin))
        .expect(200);

      for (const sucursal of respuesta.body as object[]) {
        expect(Object.keys(sucursal).sort()).toEqual(CAMPOS_SUCURSAL);
      }
    });
  });

  // ------------------------------------------------------ ver una sucursal

  describe('GET /branches/:id', () => {
    it('el Admin obtiene cualquiera', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(`/api/branches/${sucursales.sur}`)
        .set(...como(admin))
        .expect(200);

      const cuerpo = respuesta.body as SucursalRespuestaE2E;
      expect(cuerpo.id).toBe(sucursales.sur);
      expect(cuerpo.nombre).toBe('Sucursal Sur');
    });

    it('un Gerente obtiene la suya', async () => {
      const { token } = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Obtiene',
      );

      const respuesta = await request(app.getHttpServer())
        .get(`/api/branches/${sucursales.centro}`)
        .set(...como(token))
        .expect(200);

      expect((respuesta.body as SucursalRespuestaE2E).id).toBe(sucursales.centro);
    });

    it('un Gerente obtiene 404 al pedir otra sucursal que si existe', async () => {
      const { token } = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Ajeno',
      );

      await request(app.getHttpServer())
        .get(`/api/branches/${sucursales.norte}`)
        .set(...como(token))
        .expect(404);
    });

    it('un Gerente obtiene el mismo 404 con una sucursal inexistente', async () => {
      // Que ambos casos den 404 es lo que evita revelar que la otra existe.
      const { token } = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Fantasma',
      );

      const ajena = await request(app.getHttpServer())
        .get(`/api/branches/${sucursales.norte}`)
        .set(...como(token))
        .expect(404);

      const inexistente = await request(app.getHttpServer())
        .get('/api/branches/0192f0a0-0000-7000-8000-000000000000')
        .set(...como(token))
        .expect(404);

      expect((ajena.body as { message: string }).message).toBe(
        (inexistente.body as { message: string }).message,
      );
    });

    it('un Empleado obtiene la suya', async () => {
      const empleado = await crearEmpleado(
        app,
        admin,
        sucursales.sur,
        'Empleado Obtiene',
      );
      const token = (
        await iniciarSesion(app, empleado.email, PASSWORD_VALIDA_PRUEBAS).expect(200)
      ).body.accessToken as string;

      const respuesta = await request(app.getHttpServer())
        .get(`/api/branches/${sucursales.sur}`)
        .set(...como(token))
        .expect(200);

      expect((respuesta.body as SucursalRespuestaE2E).id).toBe(sucursales.sur);
    });

    it('un Empleado obtiene 404 al pedir otra sucursal', async () => {
      const empleado = await crearEmpleado(
        app,
        admin,
        sucursales.sur,
        'Empleado Ajeno',
      );
      const token = (
        await iniciarSesion(app, empleado.email, PASSWORD_VALIDA_PRUEBAS).expect(200)
      ).body.accessToken as string;

      await request(app.getHttpServer())
        .get(`/api/branches/${sucursales.centro}`)
        .set(...como(token))
        .expect(404);
    });

    it('el Admin obtiene 404 de una sucursal inexistente', async () => {
      await request(app.getHttpServer())
        .get('/api/branches/0192f0a0-0000-7000-8000-000000000000')
        .set(...como(admin))
        .expect(404);
    });
  });

  // ------------------------------------------------------------- permisos

  describe('permisos', () => {
    it('un Gerente no puede crear una sucursal: 403', async () => {
      const { token } = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Creador',
      );

      await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(token))
        .send({ nombre: 'Sucursal Del Gerente', direccion: 'Calle 1' })
        .expect(403);
    });

    it('un Gerente no puede editar una sucursal: 403', async () => {
      const { token } = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Editor',
      );

      await request(app.getHttpServer())
        .patch(`/api/branches/${sucursales.centro}`)
        .set(...como(token))
        .send({ nombre: 'Nombre Cambiado' })
        .expect(403);
    });

    it('un Gerente no puede editar ni siquiera su propia sucursal: 403', async () => {
      // Que la sucursal sea la suya no le da permiso de escritura: el permiso
      // `sucursales.crear_editar` es solo del Admin.
      const { token } = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Suya',
      );

      await request(app.getHttpServer())
        .patch(`/api/branches/${sucursales.centro}`)
        .set(...como(token))
        .send({ telefono: '600000000' })
        .expect(403);
    });

    it('un Empleado no puede crear ni editar: 403', async () => {
      const empleado = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Editor',
      );
      const token = (
        await iniciarSesion(app, empleado.email, PASSWORD_VALIDA_PRUEBAS).expect(200)
      ).body.accessToken as string;

      await request(app.getHttpServer())
        .post('/api/branches')
        .set(...como(token))
        .send({ nombre: 'Sucursal Del Empleado', direccion: 'Calle 1' })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/branches/${sucursales.centro}`)
        .set(...como(token))
        .send({ nombre: 'Nombre Cambiado' })
        .expect(403);
    });

    it('el permiso corta antes que la visibilidad: un Gerente recibe 403, no 404', async () => {
      // Editar exige `sucursales.crear_editar`. El Gerente no lo tiene, así que
      // el guard responde 403 sin llegar a comprobar la visibilidad. No es una
      // fuga de información porque 403 no depende de si la sucursal existe.
      const { token } = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Permiso',
      );

      await request(app.getHttpServer())
        .patch('/api/branches/0192f0a0-0000-7000-8000-000000000000')
        .set(...como(token))
        .send({ nombre: 'Cualquiera' })
        .expect(403);
    });
  });

  // ------------------------------------------------------ formato y acceso

  describe('validacion del id y acceso', () => {
    it('rechaza un id con formato invalido con 400', async () => {
      await request(app.getHttpServer())
        .get('/api/branches/no-es-un-uuid')
        .set(...como(admin))
        .expect(400);

      await request(app.getHttpServer())
        .patch('/api/branches/12345')
        .set(...como(admin))
        .send({ nombre: 'Nombre' })
        .expect(400);
    });

    it('acepta un UUID v7, que es lo que genera la base', async () => {
      // Si el pipe limitase las versiones, el id del seed no pasaria.
      await request(app.getHttpServer())
        .get(`/api/branches/${sucursales.centro}`)
        .set(...como(admin))
        .expect(200);
    });

    it('sin token responde 401 en todas las rutas', async () => {
      await request(app.getHttpServer()).get('/api/branches').expect(401);

      await request(app.getHttpServer())
        .get(`/api/branches/${sucursales.centro}`)
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/branches')
        .send({ nombre: 'Sucursal Sin Token', direccion: 'Calle 1' })
        .expect(401);

      await request(app.getHttpServer())
        .patch(`/api/branches/${sucursales.centro}`)
        .send({ nombre: 'Sucursal Sin Token' })
        .expect(401);
    });

    it('con un token invalido responde 401', async () => {
      await request(app.getHttpServer())
        .get('/api/branches')
        .set(...como('token-falso'))
        .expect(401);
    });
  });
});
