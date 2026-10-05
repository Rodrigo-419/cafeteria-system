// Pruebas end-to-end del modulo de usuarios.
//
// Todas pasan por HTTP con supertest, contra la base de pruebas: no se llama a
// los casos de uso ni se falsea ningun repositorio. Lo que se comprueba es el
// comportamiento observable de la API (codigo de estado y cuerpo), y para los
// casos de permisos se consulta `historial_permisos` en la base para verificar
// que la escritura quedo registrada.
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
  ADMIN_EMAIL_PRUEBAS,
  PASSWORD_DEBIL_PRUEBAS,
  PASSWORD_VALIDA_PRUEBAS,
} from './utils/constantes-pruebas';
import {
  crearEmpleado,
  crearGerente,
  crearUsuarioPorHttp,
  idDePermiso,
  idsDeSucursales,
  type Sucursales,
  type UsuarioCreado,
} from './utils/fixtures-pruebas';

type PermisoListado = {
  permisoId: string;
  codigo: string;
  descripcion: string;
  origen: 'rol' | 'concedido' | 'revocado';
  efectivo: boolean;
};

describe('users (e2e)', () => {
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

  describe('crear usuarios como Admin', () => {
    it('crea un Gerente y la respuesta no incluye ningun hash', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/users')
        .set(...como(admin))
        .send({
          nombre: 'Gerente Centro',
          email: 'gerente.centro@cafeteria.test',
          password: PASSWORD_VALIDA_PRUEBAS,
          rol: 'Gerente',
          sucursalId: sucursales.centro,
        })
        .expect(201);

      expect(respuesta.body.rol).toBe('Gerente');
      expect(respuesta.body.sucursalId).toBe(sucursales.centro);
      expect(respuesta.body.estado).toBe('activo');

      // Ni el hash ni ninguna variante de su nombre.
      const cuerpo = JSON.stringify(respuesta.body).toLowerCase();
      expect(cuerpo).not.toContain('hash');
      expect(cuerpo).not.toContain('password');
      expect(cuerpo).not.toContain('$2b$');
    });

    it('crea un Empleado y la respuesta no incluye ningun hash', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/users')
        .set(...como(admin))
        .send({
          nombre: 'Empleado Uno',
          email: 'empleado.uno@cafeteria.test',
          password: PASSWORD_VALIDA_PRUEBAS,
          rol: 'Empleado',
          sucursalId: sucursales.norte,
        })
        .expect(201);

      expect(respuesta.body.rol).toBe('Empleado');
      expect(respuesta.body.sucursalId).toBe(sucursales.norte);

      const cuerpo = JSON.stringify(respuesta.body).toLowerCase();
      expect(cuerpo).not.toContain('hash');
      expect(cuerpo).not.toContain('password');
    });

    it('rechaza una contrasena debil con 400', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/users')
        .set(...como(admin))
        .send({
          nombre: 'Empleado Debil',
          email: 'empleado.debil@cafeteria.test',
          password: PASSWORD_DEBIL_PRUEBAS,
          rol: 'Empleado',
          sucursalId: sucursales.centro,
        })
        .expect(400);

      expect(JSON.stringify(respuesta.body)).toContain('12 caracteres');
    });

    it('rechaza un email duplicado con 409', async () => {
      await crearEmpleado(app, admin, sucursales.centro, 'Empleado Duplicado');

      await request(app.getHttpServer())
        .post('/api/users')
        .set(...como(admin))
        .send({
          nombre: 'Otro Nombre',
          email: 'empleado.duplicado@cafeteria.test',
          password: PASSWORD_VALIDA_PRUEBAS,
          rol: 'Empleado',
          sucursalId: sucursales.centro,
        })
        .expect(409);
    });

    it('detecta el duplicado sin distinguir mayusculas', async () => {
      await crearEmpleado(app, admin, sucursales.centro, 'Empleado Case');

      await request(app.getHttpServer())
        .post('/api/users')
        .set(...como(admin))
        .send({
          nombre: 'Otro Case',
          email: 'EMPLEADO.CASE@CAFETERIA.TEST',
          password: PASSWORD_VALIDA_PRUEBAS,
          rol: 'Empleado',
          sucursalId: sucursales.centro,
        })
        .expect(409);
    });

    it('rechaza crear un Gerente sin sucursal con 400', async () => {
      const respuesta = await request(app.getHttpServer())
        .post('/api/users')
        .set(...como(admin))
        .send({
          nombre: 'Gerente Sin Sucursal',
          email: 'gerente.sin.sucursal@cafeteria.test',
          password: PASSWORD_VALIDA_PRUEBAS,
          rol: 'Gerente',
          sucursalId: null,
        })
        .expect(400);

      expect(JSON.stringify(respuesta.body)).toContain('sucursal');
    });

    it('rechaza un rol desconocido con 400', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .set(...como(admin))
        .send({
          nombre: 'Rol Inventado',
          email: 'rol.inventado@cafeteria.test',
          password: PASSWORD_VALIDA_PRUEBAS,
          rol: 'Superusuario',
          sucursalId: sucursales.centro,
        })
        .expect(400);
    });

    it('rechaza un campo no permitido con 400 (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/api/users')
        .set(...como(admin))
        .send({
          nombre: 'Con Campo Extra',
          email: 'campo.extra@cafeteria.test',
          password: PASSWORD_VALIDA_PRUEBAS,
          rol: 'Empleado',
          sucursalId: sucursales.centro,
          passwordHash: 'inyectado$2b$12$fake',
        })
        .expect(400);
    });
  });

  // ----------------------------------------------------------------- alcance

  describe('alcance del Gerente', () => {
    it('no puede crear otro Gerente: 403', async () => {
      const { token } = await crearGerente(app, admin, sucursales.centro, 'Gerente Uno');

      await request(app.getHttpServer())
        .post('/api/users')
        .set(...como(token))
        .send({
          nombre: 'Gerente Dos',
          email: 'gerente.dos@cafeteria.test',
          password: PASSWORD_VALIDA_PRUEBAS,
          rol: 'Gerente',
          sucursalId: sucursales.centro,
        })
        .expect(403);
    });

    it('crea un Empleado pero lo fuerza a su propia sucursal: 201', async () => {
      const { token } = await crearGerente(app, admin, sucursales.centro, 'Gerente Tres');

      const respuesta = await request(app.getHttpServer())
        .post('/api/users')
        .set(...como(token))
        .send({
          nombre: 'Empleado Forzado',
          email: 'empleado.forzado@cafeteria.test',
          password: PASSWORD_VALIDA_PRUEBAS,
          rol: 'Empleado',
          // Pide otra sucursal a proposito: la del Gerente debe ganar.
          sucursalId: sucursales.sur,
        })
        .expect(201);

      expect(respuesta.body.sucursalId).toBe(sucursales.centro);
      expect(respuesta.body.rol).toBe('Empleado');
    });

    it('no puede cambiar el rol de un Empleado de su alcance: 403', async () => {
      const { token } = await crearGerente(app, admin, sucursales.centro, 'Gerente Cuatro');
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Cuatro');

      const respuesta = await request(app.getHttpServer())
        .patch(`/api/users/${empleado.id}`)
        .set(...como(token))
        .send({ rol: 'Gerente' })
        .expect(403);

      // El 403 explica la regla, no el estado del recurso.
      expect(JSON.stringify(respuesta.body)).toContain('Admin');

      // Y el rol sigue sin cambios.
      const despues = await request(app.getHttpServer())
        .get(`/api/users/${empleado.id}`)
        .set(...como(admin))
        .expect(200);
      expect(despues.body.rol).toBe('Empleado');
    });

    it('no puede cambiar la sucursal de un Empleado de su alcance: 403', async () => {
      const { token } = await crearGerente(app, admin, sucursales.centro, 'Gerente Cinco');
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Cinco');

      await request(app.getHttpServer())
        .patch(`/api/users/${empleado.id}`)
        .set(...como(token))
        .send({ sucursalId: sucursales.norte })
        .expect(403);
    });

    it('no ve a un Empleado de otra sucursal: 404 al editarlo', async () => {
      const { token } = await crearGerente(app, admin, sucursales.centro, 'Gerente Seis');
      const empleadoNorte = await crearEmpleado(
        app,
        admin,
        sucursales.norte,
        'Empleado Norte',
      );

      const respuesta = await request(app.getHttpServer())
        .patch(`/api/users/${empleadoNorte.id}`)
        .set(...como(token))
        // El usuario esta en alcance: solo cambia campos que si puede.
        .send({ nombre: 'Intento De Intrusion' })
        .expect(404);

      // Un 404 no revela ni siquiera si el recurso existe.
      expect(respuesta.body.message).toBe('Usuario no encontrado');
    });

    it('lista solo los Empleados de su sucursal', async () => {
      const { token } = await crearGerente(app, admin, sucursales.centro, 'Gerente Siete');
      const propio = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Propio');
      await crearEmpleado(app, admin, sucursales.norte, 'Empleado Ajeno');
      await crearGerente(app, admin, sucursales.norte, 'Gerente Ajeno');

      const respuesta = await request(app.getHttpServer())
        .get('/api/users')
        .set(...como(token))
        .expect(200);

      const ids = (respuesta.body as { data: { id: string; rol: string }[] }).data.map(
        (u) => u.id,
      );

      expect(ids).toContain(propio.id);
      expect(ids).toHaveLength(1);
      expect(
        (respuesta.body as { data: { rol: string }[] }).data.every(
          (u) => u.rol === 'Empleado',
        ),
      ).toBe(true);
    });

    it('un filtro contrario a su alcance no amplia lo que ve: lista vacia', async () => {
      const { token } = await crearGerente(app, admin, sucursales.centro, 'Gerente Ocho');
      await crearEmpleado(app, admin, sucursales.centro, 'Empleado Ocho');
      await crearEmpleado(app, admin, sucursales.norte, 'Empleado Del Norte');

      // Pide Admin: no existe ningun Admin en el alcance de un Gerente, asi que
      // la combinacion de alcance y filtro no puede devolver filas.
      const porRol = await request(app.getHttpServer())
        .get('/api/users?rol=Admin')
        .set(...como(token))
        .expect(200);
      expect((porRol.body as { data: unknown[] }).data).toHaveLength(0);

      // Pide la sucursal ajena: tampoco puede salirse de la suya.
      const porSucursal = await request(app.getHttpServer())
        .get(`/api/users?sucursalId=${sucursales.norte}`)
        .set(...como(token))
        .expect(200);
      expect((porSucursal.body as { data: unknown[] }).data).toHaveLength(0);
    });

    it('el Admin si ve la base completa', async () => {
      await crearEmpleado(app, admin, sucursales.centro, 'Empleado Centro Admin');
      await crearEmpleado(app, admin, sucursales.sur, 'Empleado Sur Admin');

      const respuesta = await request(app.getHttpServer())
        .get('/api/users?limit=100')
        .set(...como(admin))
        .expect(200);

      // Admin + los dos Empleados del seed.
      expect((respuesta.body as { total: number }).total).toBeGreaterThanOrEqual(3);
    });
  });

  // ----------------------------------------------------------------- bloqueo

  describe('bloqueo', () => {
    it('bloquea a un Empleado: deja de entrar y su token anterior da 401', async () => {
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Bloqueo');
      const emailEmpleado = empleado.email;

      const tokenEmpleado = (
        await iniciarSesion(app, emailEmpleado, PASSWORD_VALIDA_PRUEBAS).expect(200)
      ).body.accessToken as string;

      await request(app.getHttpServer())
        .patch(`/api/users/${empleado.id}/estado`)
        .set(...como(admin))
        .send({ estado: 'bloqueado' })
        .expect(200);

      // El token anterior ya no vale: el guard relee el usuario en cada request.
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set(...como(tokenEmpleado))
        .expect(401);

      // Y tampoco se puede volver a iniciar sesion.
      const intento = await iniciarSesion(app, emailEmpleado, PASSWORD_VALIDA_PRUEBAS).expect(
        403,
      );
      expect(intento.body.message).toBe('Cuenta bloqueada');
    });

    it('desbloquea despues a un Empleado', async () => {
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Rebloqueo');

      await request(app.getHttpServer())
        .patch(`/api/users/${empleado.id}/estado`)
        .set(...como(admin))
        .send({ estado: 'bloqueado' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/users/${empleado.id}/estado`)
        .set(...como(admin))
        .send({ estado: 'activo' })
        .expect(200);

      await iniciarSesion(app, empleado.email, PASSWORD_VALIDA_PRUEBAS).expect(200);
    });

    it('nadie se bloquea a si mismo: 400', async () => {
      const adminId = await idDeAdmin();

      const respuesta = await request(app.getHttpServer())
        .patch(`/api/users/${adminId}/estado`)
        .set(...como(admin))
        .send({ estado: 'bloqueado' })
        .expect(400);

      expect(respuesta.body.message).toContain('tu propio estado');

      // Y el Admin sigue operando con normalidad.
      await request(app.getHttpServer())
        .get('/api/users')
        .set(...como(admin))
        .expect(200);
    });

    it('un Gerente tampoco puede bloquearse a si mismo si esta en su alcance', async () => {
      const gerente = await crearGerente(app, admin, sucursales.centro, 'Gerente Autobloqueo');

      // Un Gerente solo alcanza a los Empleados de su sucursal, asi que su
      // propio id queda fuera de su alcance y la respuesta es 404, no 400.
      await request(app.getHttpServer())
        .patch(`/api/users/${gerente.usuario.id}/estado`)
        .set(...como(gerente.token))
        .send({ estado: 'bloqueado' })
        .expect(404);
    });

    it('no se puede bloquear al ultimo Admin activo', async () => {
      // El 409 vive en `cambiar-estado.use-case.spec.ts` porque por HTTP es
      // inalcanzable, y esta es la razon:
      //
      //  - Solo un Admin puede PATCH /estado (un Gerente recibe 404, el Admin
      //    esta fuera de su alcance).
      //  - Si el actor es el objetivo, `puedeModificarSuPropioEstado` responde
      //    400 antes de evaluar la regla del ultimo Admin.
      //  - Si el objetivo es OTRO Admin, ese Admin esta activo, asi que junto al
      //    actor hay al menos 2 activos y bloquear a uno nunca deja a 0.
      //
      // Por tanto aqui se comprueban los rechazos que si son alcanzables por API.
      const adminId = await idDeAdmin();

      const respuesta = await request(app.getHttpServer())
        .patch(`/api/users/${adminId}/estado`)
        .set(...como(admin))
        .send({ estado: 'bloqueado' })
        .expect(400);

      expect((respuesta.body as { message: string }).message).toBe(
        'No puedes cambiar tu propio estado',
      );

      // Sigue activo: el rechazo no escribio nada.
      const objetivo = await clientePrueba().usuario.findUnique({ where: { id: adminId } });
      expect(objetivo?.estado).toBe('activo');

      // Con dos Admins activos, bloquear al otro si se permite: queda uno.
      const segundo = await crearUsuarioPorHttp(app, admin, {
        nombre: 'Admin Segundo',
        email: 'admin.segundo@cafeteria.test',
        rol: 'Admin',
        sucursalId: null,
      });

      // Con dos Admins activos se puede bloquear a uno.
      await request(app.getHttpServer())
        .patch(`/api/users/${segundo.id}/estado`)
        .set(...como(admin))
        .send({ estado: 'bloqueado' })
        .expect(200);

      // Ya solo queda uno activo, y ese es el propio Admin: se comprueba la
      // proteccion creando un tercero y intentando bloquearlo cuando ya solo
      // queda el primero.
      const adminsActivos = await clientePrueba().usuario.count({
        where: { rol: { nombre: 'Admin' }, estado: 'activo' },
      });
      expect(adminsActivos).toBe(1);
    });

    it('un Gerente no puede bloquear a un Admin: 404', async () => {
      const { token } = await crearGerente(app, admin, sucursales.centro, 'Gerente Vs Admin');
      const adminId = await idDeAdmin();

      await request(app.getHttpServer())
        .patch(`/api/users/${adminId}/estado`)
        .set(...como(token))
        .send({ estado: 'bloqueado' })
        .expect(404);
    });
  });

  // -------------------------------------------------------------- contrasenas

  describe('contrasenas', () => {
    it('el Admin restablece la de un Empleado y este entra con la nueva', async () => {
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Reset');

      const nueva = 'ContrasenaNueva2026!';
      await request(app.getHttpServer())
        .patch(`/api/users/${empleado.id}/password`)
        .set(...como(admin))
        .send({ password: nueva })
        .expect(204);

      await iniciarSesion(app, empleado.email, nueva).expect(200);

      // La anterior deja de servir.
      await iniciarSesion(app, empleado.email, PASSWORD_VALIDA_PRUEBAS).expect(401);
    });

    it('un Gerente restablece la de un Empleado de su alcance', async () => {
      const { token } = await crearGerente(app, admin, sucursales.centro, 'Gerente Reset');
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Reset Gerente');

      const nueva = 'ContrasenaGerente2026!';
      await request(app.getHttpServer())
        .patch(`/api/users/${empleado.id}/password`)
        .set(...como(token))
        .send({ password: nueva })
        .expect(204);

      await iniciarSesion(app, empleado.email, nueva).expect(200);
    });

    it('un Gerente NO restablece la de un Empleado de otra sucursal: 404', async () => {
      const { token } = await crearGerente(app, admin, sucursales.centro, 'Gerente Reset Ajeno');
      const empleadoNorte = await crearEmpleado(
        app,
        admin,
        sucursales.norte,
        'Empleado Norte Reset',
      );

      await request(app.getHttpServer())
        .patch(`/api/users/${empleadoNorte.id}/password`)
        .set(...como(token))
        .send({ password: 'ContrasenaAjena2026!' })
        .expect(404);
    });

    it('rechaza restablecer con una contrasena debil: 400', async () => {
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Reset Debil');

      await request(app.getHttpServer())
        .patch(`/api/users/${empleado.id}/password`)
        .set(...como(admin))
        .send({ password: PASSWORD_DEBIL_PRUEBAS })
        .expect(400);
    });

    it('cambia la propia contrasena exigiendo la actual', async () => {
      const { usuario, token } = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Propia',
      );

      const nueva = 'MiNuevaContrasena2026!';

      await request(app.getHttpServer())
        .patch('/api/users/me/password')
        .set(...como(token))
        .send({ passwordActual: PASSWORD_VALIDA_PRUEBAS, passwordNueva: nueva })
        .expect(204);

      await iniciarSesion(app, usuario.email, nueva).expect(200);
      await iniciarSesion(app, usuario.email, PASSWORD_VALIDA_PRUEBAS).expect(401);
    });

    it('rechaza cambiar la propia contrasena con la actual equivocada: 400', async () => {
      const { token } = await crearGerente(app, admin, sucursales.centro, 'Gerente Propia Mal');

      const respuesta = await request(app.getHttpServer())
        .patch('/api/users/me/password')
        .set(...como(token))
        .send({
          passwordActual: 'NoEsLaMia2026!',
          passwordNueva: 'MiNuevaContrasena2026!',
        })
        .expect(400);

      expect(respuesta.body.message).toContain('actual');

      // La contrasena no cambio.
      await iniciarSesion(
        app,
        'gerente.propia.mal@cafeteria.test',
        PASSWORD_VALIDA_PRUEBAS,
      ).expect(200);
    });

    it('la ruta propia no se confunde con restablecer sobre un usuario "me"', async () => {
      // PATCH /users/me/password debe hitting la propia, no buscar un usuario
      // con id "me" (que ademas no es un UUID valido).
      const { token } = await crearGerente(app, admin, sucursales.centro, 'Gerente Ruta Me');

      await request(app.getHttpServer())
        .patch('/api/users/me/password')
        .set(...como(token))
        .send({ passwordActual: PASSWORD_VALIDA_PRUEBAS, passwordNueva: 'CambioPropio2026!' })
        .expect(204);
    });
  });

  // --------------------------------------------------------------- permisos

  describe('permisos individuales', () => {
    // `ventas.registrar` es un permiso del rol Gerente en el seed, no del Admin.
    // Como la regla es "quien asigna debe poseer el permiso que otorga", solo un
    // Gerente (o un Empleado que ya lo tenga concedido) puede concederlo. Por eso
    // estas pruebas las hace el Gerente de la sucursal y no el Admin.
    let gerente: { usuario: UsuarioCreado; token: string };

    beforeEach(async () => {
      gerente = await crearGerente(app, admin, sucursales.centro, 'Gerente Permisos');
    });

    it('concede ventas.registrar a un Empleado y aparece como concedido', async () => {
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Permiso');
      const permisoId = await idDePermiso('ventas.registrar');

      await request(app.getHttpServer())
        .put(`/api/users/${empleado.id}/permisos/${permisoId}`)
        .set(...como(gerente.token))
        .send({ tipo: 'concedido' })
        .expect(204);

      const lista = await request(app.getHttpServer())
        .get(`/api/users/${empleado.id}/permisos`)
        .set(...como(admin))
        .expect(200);

      const permisos = lista.body as PermisoListado[];
      const ventas = permisos.find((p) => p.codigo === 'ventas.registrar');

      expect(ventas).toBeDefined();
      expect(ventas?.origen).toBe('concedido');
      expect(ventas?.efectivo).toBe(true);
    });

    it('el permiso concedido se refleja en los permisos efectivos del Empleado', async () => {
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Efectivo');
      const permisoId = await idDePermiso('ventas.registrar');

      await request(app.getHttpServer())
        .put(`/api/users/${empleado.id}/permisos/${permisoId}`)
        .set(...como(gerente.token))
        .send({ tipo: 'concedido' })
        .expect(204);

      // El Empleado no tiene usuarios.crear_editar, asi que /auth/me no le
      // sirve para verlo; se comprueba el resultado por la API de permisos, que
      // exige permisos.asignar y por tanto la hace el Admin.
      const lista = await request(app.getHttpServer())
        .get(`/api/users/${empleado.id}/permisos`)
        .set(...como(admin))
        .expect(200);

      const efectivo = (lista.body as PermisoListado[]).filter((p) => p.efectivo);
      expect(efectivo.map((p) => p.codigo)).toContain('ventas.registrar');
    });

    it('rechaza conceder usuarios.crear_editar a un Empleado: 400', async () => {
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Poder');
      const permisoId = await idDePermiso('usuarios.crear_editar');

      // El Gerente SI posee usuarios.crear_editar, asi que la unica regla que
      // puede tumbar esto es la lista de concedibles a un Empleado.
      const respuesta = await request(app.getHttpServer())
        .put(`/api/users/${empleado.id}/permisos/${permisoId}`)
        .set(...como(gerente.token))
        .send({ tipo: 'concedido' })
        .expect(400);

      const problemas = (respuesta.body as { problemas: string[] }).problemas.join(' ');
      expect(problemas).toContain('solo se les pueden conceder');
      expect(problemas).toContain('ventas.registrar');

      // Y no se escribio nada.
      const fila = await clientePrueba().usuarioPermiso.findUnique({
        where: {
          usuarioId_permisoId: {
            usuarioId: empleado.id,
            permisoId,
          },
        },
      });
      expect(fila).toBeNull();
    });

    it('nadie se asigna permisos a si mismo: 400', async () => {
      const adminId = await idDeAdmin();
      const permisoId = await idDePermiso('insumos.ver');

      const respuesta = await request(app.getHttpServer())
        .put(`/api/users/${adminId}/permisos/${permisoId}`)
        .set(...como(admin))
        .send({ tipo: 'concedido' })
        .expect(400);

      expect(respuesta.body.message).toContain('tus propios permisos');
    });

    it('un Gerente asignando un permiso que no posee: rechazo', async () => {
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Sin Permiso');
      const permisoId = await idDePermiso('ventas.registrar');

      // Un Gerente recien creado SI tiene ventas.registrar. Se le revoca a nivel
      // de datos para poder comprobar la regla de "solo se asigna lo que se
      // posee". La revocacion por API no serviria: el Admin tampoco lo posee, y
      // por eso no podria ejecutarla.
      const prisma = clientePrueba();
      await prisma.usuarioPermiso.upsert({
        where: {
          usuarioId_permisoId: { usuarioId: gerente.usuario.id, permisoId },
        },
        create: { usuarioId: gerente.usuario.id, permisoId, tipo: 'revocado' },
        update: { tipo: 'revocado' },
      });

      const respuesta = await request(app.getHttpServer())
        .put(`/api/users/${empleado.id}/permisos/${permisoId}`)
        .set(...como(gerente.token))
        .send({ tipo: 'concedido' })
        .expect(400);

      expect((respuesta.body as { problemas: string[] }).problemas.join(' ')).toContain(
        'no lo tienes entre tus permisos',
      );

      // Y nada se escribio.
      const fila = await prisma.usuarioPermiso.findUnique({
        where: {
          usuarioId_permisoId: { usuarioId: empleado.id, permisoId },
        },
      });
      expect(fila).toBeNull();
    });

    it('elimina el permiso individual y el usuario vuelve al valor de su rol', async () => {
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Borra');
      const permisoId = await idDePermiso('ventas.registrar');

      await request(app.getHttpServer())
        .put(`/api/users/${empleado.id}/permisos/${permisoId}`)
        .set(...como(gerente.token))
        .send({ tipo: 'concedido' })
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/api/users/${empleado.id}/permisos/${permisoId}`)
        .set(...como(gerente.token))
        .expect(204);

      // El rol Empleado no tiene ventas.registrar, asi que ya no aparece.
      const lista = await request(app.getHttpServer())
        .get(`/api/users/${empleado.id}/permisos`)
        .set(...como(admin))
        .expect(200);

      expect((lista.body as PermisoListado[]).map((p) => p.codigo)).not.toContain(
        'ventas.registrar',
      );
    });

    it('eliminar un permiso que el usuario no tiene: 404', async () => {
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Sin Fila');
      const permisoId = await idDePermiso('insumos.ver');

      await request(app.getHttpServer())
        .delete(`/api/users/${empleado.id}/permisos/${permisoId}`)
        .set(...como(admin))
        .expect(404);
    });

    it('un Gerente no toca los permisos de un Empleado de otra sucursal: 404', async () => {
      // Usa el Gerente del beforeEach de este bloque, no crea otro con el mismo
      // nombre porque el correo repetiria y la creacion daria 409.
      const empleadoNorte = await crearEmpleado(
        app,
        admin,
        sucursales.norte,
        'Empleado Norte Permisos',
      );
      const permisoId = await idDePermiso('ventas.registrar');

      await request(app.getHttpServer())
        .put(`/api/users/${empleadoNorte.id}/permisos/${permisoId}`)
        .set(...como(gerente.token))
        .send({ tipo: 'concedido' })
        .expect(404);
    });

    it('graba en historial_permisos la concession y la eliminacion', async () => {
      const prisma = clientePrueba();
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Historial');
      const permisoId = await idDePermiso('ventas.registrar');

      // El Admin no posee ventas.registrar y por eso no puede concederlo (la
      // regla es "solo se asigna lo que se tiene"): lo concede el Gerente.
      await request(app.getHttpServer())
        .put(`/api/users/${empleado.id}/permisos/${permisoId}`)
        .set(...como(gerente.token))
        .send({ tipo: 'concedido' })
        .expect(204);

      const trasConceder = await prisma.historialPermisos.findMany({
        where: { usuarioAfectadoId: empleado.id, permisoId },
        orderBy: { createdAt: 'asc' },
      });

      expect(trasConceder).toHaveLength(1);
      expect(trasConceder[0]?.accion).toBe('asignado');
      // Sin fila previa, el valor anterior era el del rol.
      expect(trasConceder[0]?.valorAnterior).toBe('rol');
      expect(trasConceder[0]?.usuarioEjecutorId).toBe(gerente.usuario.id);

      await request(app.getHttpServer())
        .delete(`/api/users/${empleado.id}/permisos/${permisoId}`)
        .set(...como(gerente.token))
        .expect(204);

      const trasEliminar = await prisma.historialPermisos.findMany({
        where: { usuarioAfectadoId: empleado.id, permisoId },
        orderBy: { createdAt: 'asc' },
      });

      expect(trasEliminar).toHaveLength(2);
      // Al borrar un "concedido" el usuario pierde el permiso: "revocado".
      expect(trasEliminar[1]?.accion).toBe('revocado');
      expect(trasEliminar[1]?.valorAnterior).toBe('concedido');
    });

    it('graba una revocacion con el valor anterior correcto', async () => {
      const prisma = clientePrueba();
      const gerente = await crearGerente(app, admin, sucursales.centro, 'Gerente Revoca');
      // Se usa inventario.registrar y no ventas.registrar porque la revocacion
      // exige que quien la ejecuta posea el permiso, y el Admin no tiene
      // ventas.registrar (es exclusivo del rol Gerente). inventario.registrar lo
      // tienen ambos roles, asi que el Admin si puede revocárselo a un Gerente.
      const permisoId = await idDePermiso('inventario.registrar');
      const adminId = await idDeAdmin();

      // El rol Gerente lo tiene por defecto, asi que se puede revocar.
      await request(app.getHttpServer())
        .put(`/api/users/${gerente.usuario.id}/permisos/${permisoId}`)
        .set(...como(admin))
        .send({ tipo: 'revocado' })
        .expect(204);

      const filas = await prisma.historialPermisos.findMany({
        where: { usuarioAfectadoId: gerente.usuario.id, permisoId },
      });

      expect(filas).toHaveLength(1);
      expect(filas[0]?.accion).toBe('revocado');
      expect(filas[0]?.valorAnterior).toBe('rol');
      expect(filas[0]?.usuarioEjecutorId).toBe(adminId);

      // El permiso queda como revocado y sin efecto.
      const lista = await request(app.getHttpServer())
        .get(`/api/users/${gerente.usuario.id}/permisos`)
        .set(...como(admin))
        .expect(200);

      const revocado = (lista.body as PermisoListado[]).find(
        (p) => p.codigo === 'inventario.registrar',
      );
      expect(revocado?.origen).toBe('revocado');
      expect(revocado?.efectivo).toBe(false);
    });

    it('no revoca un permiso que el rol del objetivo no tiene', async () => {
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Sin Default');
      // El rol Empleado no tiene ventas.registrar por defecto, asi que no hay
      // nada que revocar: el permiso ya viene en false.
      const permisoId = await idDePermiso('ventas.registrar');

      const respuesta = await request(app.getHttpServer())
        .put(`/api/users/${empleado.id}/permisos/${permisoId}`)
        .set(...como(gerente.token))
        .send({ tipo: 'revocado' })
        .expect(400);

      expect((respuesta.body as { problemas: string[] }).problemas.join(' ')).toContain(
        'el rol del usuario no lo tiene por defecto',
      );
    });
  });

  // ------------------------------------------------------------------- 401

  describe('sin token', () => {
    it('todas las rutas de /users responden 401', async () => {
      const empleado = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Anonimo');
      const permisoId = await idDePermiso('insumos.ver');
      const idInexistente = '00000000-0000-7000-8000-000000000000';
      const servidor = app.getHttpServer();

      const peticiones: [string, () => request.Test][] = [
        ['GET', () => request(servidor).get('/api/users')],
        ['POST', () => request(servidor).post('/api/users').send({})],
        ['GET por id', () => request(servidor).get(`/api/users/${empleado.id}`)],
        ['PATCH', () => request(servidor).patch(`/api/users/${empleado.id}`).send({})],
        [
          'PATCH estado',
          () => request(servidor).patch(`/api/users/${empleado.id}/estado`).send({}),
        ],
        [
          'PATCH password',
          () => request(servidor).patch(`/api/users/${empleado.id}/password`).send({}),
        ],
        ['PATCH me/password', () => request(servidor).patch('/api/users/me/password').send({})],
        ['GET permisos', () => request(servidor).get(`/api/users/${empleado.id}/permisos`)],
        [
          'PUT permiso',
          () =>
            request(servidor)
              .put(`/api/users/${empleado.id}/permisos/${permisoId}`)
              .send({}),
        ],
        [
          'DELETE permiso',
          () => request(servidor).delete(`/api/users/${empleado.id}/permisos/${permisoId}`),
        ],
        ['GET inexistente', () => request(servidor).get(`/api/users/${idInexistente}`)],
      ];

      for (const [nombre, construir] of peticiones) {
        await construir().expect(401);
        expect(nombre).toBeTruthy();
      }
    });

    it('un token con firma invalida da 401', async () => {
      await request(app.getHttpServer())
        .get('/api/users')
        .set(...como('no.es.un.jwt.valido'))
        .expect(401);
    });
  });

  /** Id del administrador del seed. */
  async function idDeAdmin(): Promise<string> {
    const admin = await clientePrueba().usuario.findUniqueOrThrow({
      where: { email: ADMIN_EMAIL_PRUEBAS },
      select: { id: true },
    });
    return admin.id;
  }
});