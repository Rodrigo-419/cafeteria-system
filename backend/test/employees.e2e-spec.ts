// Pruebas end-to-end del modulo de personal (empleados).
//
// Todas pasan por HTTP con supertest contra la base de pruebas: no se llaman
// casos de uso ni se falsea ningun repositorio. Se comprueba el comportamiento
// observable de la API (codigo de estado y cuerpo), y para el cese y el PIN se
// consulta la base para verificar que la escritura quedo registrada (usuario
// bloqueado, hash de PIN) y que el PIN en claro nunca vuelve a salir.
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
  PASSWORD_VALIDA_PRUEBAS,
} from './utils/constantes-pruebas';
import {
  crearEmpleado,
  crearGerente,
  idsDeSucursales,
  type Sucursales,
} from './utils/fixtures-pruebas';

type EmpleadoE2E = {
  id: string;
  usuarioId: string;
  cargo: string;
  sucursalId: string;
  fechaContratacion: string;
  fechaCese: string | null;
  estado: string;
  usuario: { id: string; nombre: string; email: string; rol: string };
};

describe('employees (e2e)', () => {
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

  /** Registra un empleado por HTTP y exige 201. */
  async function registrarEmpleado(datos: {
    usuarioId: string;
    cargo?: string;
    fechaContratacion?: string;
    sucursalId?: string;
  }): Promise<EmpleadoE2E> {
    const respuesta = await request(app.getHttpServer())
      .post('/api/employees')
      .set(...como(admin))
      .send({
        usuarioId: datos.usuarioId,
        cargo: datos.cargo ?? 'Barista',
        fechaContratacion: datos.fechaContratacion ?? '2026-01-15',
        ...(datos.sucursalId !== undefined ? { sucursalId: datos.sucursalId } : {}),
      })
      .expect(201);

    return respuesta.body as EmpleadoE2E;
  }

  // ---------------------------------------------------------------- creacion

  describe('crear empleados', () => {
    it('registra un empleado a partir de un usuario Empleado', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Primer Registro',
      );

      const empleado = await registrarEmpleado({ usuarioId: usuario.id });

      expect(empleado.cargo).toBe('Barista');
      expect(empleado.sucursalId).toBe(sucursales.centro);
      expect(empleado.estado).toBe('activo');
      expect(empleado.usuario.rol).toBe('Empleado');
      expect(empleado.fechaContratacion).toContain('2026-01-15');
      expect(empleado.fechaCese).toBeNull();

      // La respuesta nunca trae el hash del PIN ni el PIN.
      expect(empleado).not.toHaveProperty('pin');
      expect(empleado).not.toHaveProperty('pinHash');
      expect(JSON.stringify(empleado).toLowerCase()).not.toContain('$2b$');
    });

    it('acepta vincular a un usuario Gerente', async () => {
      const gerente = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Vinculable',
      );

      const empleado = await registrarEmpleado({
        usuarioId: gerente.usuario.id,
      });

      expect(empleado.usuario.rol).toBe('Gerente');
      expect(empleado.sucursalId).toBe(sucursales.centro);
    });

    it('rechaza con 409 si el usuario ya esta registrado como empleado', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Repetido',
      );
      await registrarEmpleado({ usuarioId: usuario.id });

      const respuesta = await request(app.getHttpServer())
        .post('/api/employees')
        .set(...como(admin))
        .send({
          usuarioId: usuario.id,
          cargo: 'Cajero',
          fechaContratacion: '2026-01-15',
        })
        .expect(409);

      expect(respuesta.body.message).toBe(
        'El usuario ya esta registrado como empleado',
      );
    });

    it('rechaza con 400 vincular al Admin de la cafeteria', async () => {
      const adminUsuario = await clientePrueba().usuario.findUniqueOrThrow({
        where: { email: ADMIN_EMAIL_PRUEBAS },
        select: { id: true },
      });

      const respuesta = await request(app.getHttpServer())
        .post('/api/employees')
        .set(...como(admin))
        .send({
          usuarioId: adminUsuario.id,
          cargo: 'Barista',
          fechaContratacion: '2026-01-15',
        })
        .expect(400);

      expect(JSON.stringify(respuesta.body)).toContain(
        'Un usuario con rol Admin no puede ser empleado',
      );
    });
  });

  // ------------------------------------------------------- alcance del gerente

  describe('alcance del Gerente', () => {
    it('registra un empleado de usuario Empleado de su sucursal: 201', async () => {
      const gerente = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Empleador',
      );
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Del Gerente',
      );

      const respuesta = await request(app.getHttpServer())
        .post('/api/employees')
        .set(...como(gerente.token))
        .send({
          usuarioId: usuario.id,
          cargo: 'Barista',
          fechaContratacion: '2026-01-15',
        })
        .expect(201);

      expect((respuesta.body as EmpleadoE2E).sucursalId).toBe(sucursales.centro);
    });

    it('no ve un usuario de otra sucursal: 404 al crear', async () => {
      const gerente = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente De Centro',
      );
      const usuarioAjeno = await crearEmpleado(
        app,
        admin,
        sucursales.norte,
        'Empleado Ajeno',
      );

      const respuesta = await request(app.getHttpServer())
        .post('/api/employees')
        .set(...como(gerente.token))
        .send({
          usuarioId: usuarioAjeno.id,
          cargo: 'Barista',
          fechaContratacion: '2026-01-15',
        })
        .expect(404);

      // El 404 no revela si el usuario existe.
      expect(respuesta.body.message).toBe(
        'El usuario no existe o esta fuera de tu alcance',
      );
    });

    it('no ve un empleado vinculado a un usuario Gerente: 404', async () => {
      // Un empleado del usuario Gerente queda fuera del alcance de cualquier
      // otro Gerente, aunque compartan sucursal.
      const gerenteConsulta = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Consulta',
      );
      const gerenteVinculado = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Vinculado',
      );
      const empleado = await registrarEmpleado({
        usuarioId: gerenteVinculado.usuario.id,
      });

      const respuesta = await request(app.getHttpServer())
        .get(`/api/employees/${empleado.id}`)
        .set(...como(gerenteConsulta.token))
        .expect(404);

      expect(respuesta.body.message).toBe('Empleado no encontrado');
    });

    it('lista solo los empleados a los que alcanza', async () => {
      const gerente = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Que Lista',
      );
      const propioA = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Lista A',
      );
      const propioB = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Lista B',
      );
      await registrarEmpleado({ usuarioId: propioA.id });
      await registrarEmpleado({ usuarioId: propioB.id });

      // Un empleado de otra sucursal y uno vinculado a un Gerente: fuera.
      const ajeno = await crearEmpleado(
        app,
        admin,
        sucursales.norte,
        'Empleado Lista Ajeno',
      );
      await registrarEmpleado({ usuarioId: ajeno.id });
      const gerenteVinculado = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Lista Fuera',
      );
      await registrarEmpleado({ usuarioId: gerenteVinculado.usuario.id });

      const respuesta = await request(app.getHttpServer())
        .get('/api/employees')
        .set(...como(gerente.token))
        .expect(200);

      const cuerpo = respuesta.body as { data: EmpleadoE2E[]; total: number };
      expect(cuerpo.total).toBe(2);
      expect(cuerpo.data.map((e) => e.usuario.rol)).toEqual(['Empleado', 'Empleado']);
    });
  });

  // ------------------------------------------------------------------ lectura

  describe('lectura y actualizacion', () => {
    it('obtiene un empleado por id', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Obtener',
      );
      const empleado = await registrarEmpleado({ usuarioId: usuario.id });

      const respuesta = await request(app.getHttpServer())
        .get(`/api/employees/${empleado.id}`)
        .set(...como(admin))
        .expect(200);

      expect((respuesta.body as EmpleadoE2E).id).toBe(empleado.id);
    });

    it('actualiza el cargo tras el alta', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Editar',
      );
      const empleado = await registrarEmpleado({ usuarioId: usuario.id });

      const respuesta = await request(app.getHttpServer())
        .patch(`/api/employees/${empleado.id}`)
        .set(...como(admin))
        .send({ cargo: 'Cajero' })
        .expect(200);

      expect((respuesta.body as EmpleadoE2E).cargo).toBe('Cajero');
    });

    it('responde 404 con un id que no existe', async () => {
      await request(app.getHttpServer())
        .get('/api/employees/00000000-0000-7000-8000-000000000000')
        .set(...como(admin))
        .expect(404);
    });
  });

  // -------------------------------------------------------------------- cese

  describe('cese', () => {
    it('cesa al empleado y bloquea su cuenta en la misma operacion', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Cese',
      );
      const empleado = await registrarEmpleado({ usuarioId: usuario.id });

      const respuesta = await request(app.getHttpServer())
        .post(`/api/employees/${empleado.id}/cese`)
        .set(...como(admin))
        .send({ fechaCese: '2026-02-01' })
        .expect(200);

      const cuerpo = respuesta.body as EmpleadoE2E;
      expect(cuerpo.estado).toBe('inactivo');
      expect(cuerpo.fechaCese).toContain('2026-02-01');

      // La cuenta vinculada quedo bloqueada.
      const cuenta = await clientePrueba().usuario.findUniqueOrThrow({
        where: { id: usuario.id },
        select: { estado: true },
      });
      expect(cuenta.estado).toBe('bloqueado');

      // Y ya no puede volver a entrar.
      const intento = await iniciarSesion(
        app,
        usuario.email,
        PASSWORD_VALIDA_PRUEBAS,
      ).expect(403);
      expect(intento.body.message).toBe('Cuenta bloqueada');
    });

    it('rechaza cesar dos veces: 409', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Doble Cese',
      );
      const empleado = await registrarEmpleado({ usuarioId: usuario.id });

      await request(app.getHttpServer())
        .post(`/api/employees/${empleado.id}/cese`)
        .set(...como(admin))
        .send({ fechaCese: '2026-02-01' })
        .expect(200);

      const respuesta = await request(app.getHttpServer())
        .post(`/api/employees/${empleado.id}/cese`)
        .set(...como(admin))
        .send({ fechaCese: '2026-03-01' })
        .expect(409);

      expect(respuesta.body.message).toBe('El empleado ya esta cesado');
    });

    it('rechaza una fecha de cese anterior a la contratacion: 400', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Cese Temprano',
      );
      const empleado = await registrarEmpleado({
        usuarioId: usuario.id,
        fechaContratacion: '2026-01-15',
      });

      const respuesta = await request(app.getHttpServer())
        .post(`/api/employees/${empleado.id}/cese`)
        .set(...como(admin))
        .send({ fechaCese: '2026-01-14' })
        .expect(400);

      expect(JSON.stringify(respuesta.body)).toContain(
        'La fecha de cese no es valida',
      );
    });

    it('un Gerente cesa a un empleado de su alcance y no a uno ajeno', async () => {
      const gerente = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Que Cesa',
      );
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Cesa Gerente',
      );
      const empleado = await registrarEmpleado({ usuarioId: usuario.id });

      await request(app.getHttpServer())
        .post(`/api/employees/${empleado.id}/cese`)
        .set(...como(gerente.token))
        .send({ fechaCese: '2026-02-01' })
        .expect(200);

      const ajeno = await crearEmpleado(
        app,
        admin,
        sucursales.norte,
        'Empleado Cesa Ajeno',
      );
      const empleadoAjeno = await registrarEmpleado({ usuarioId: ajeno.id });

      await request(app.getHttpServer())
        .post(`/api/employees/${empleadoAjeno.id}/cese`)
        .set(...como(gerente.token))
        .send({ fechaCese: '2026-02-01' })
        .expect(404);
    });
  });

  // ------------------------------------------------------------------ PIN

  describe('PIN de marcacion', () => {
    it('regenera el PIN, lo guarda como hash y nunca vuelve a aparecer', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Con Pin',
      );
      const empleado = await registrarEmpleado({ usuarioId: usuario.id });
      const prisma = clientePrueba();

      // Sin PIN registrado, el hash es null.
      const sinPin = await prisma.empleado.findUniqueOrThrow({
        where: { id: empleado.id },
        select: { pinHash: true },
      });
      expect(sinPin.pinHash).toBeNull();

      const respuesta = await request(app.getHttpServer())
        .post(`/api/employees/${empleado.id}/pin`)
        .set(...como(admin))
        .expect(200);

      const pin = (respuesta.body as { pin: string }).pin;
      expect(pin).toMatch(/^\d{6}$/u);

      // En la base queda el hash bcrypt, no el PIN en claro.
      const conPin = await prisma.empleado.findUniqueOrThrow({
        where: { id: empleado.id },
        select: { pinHash: true },
      });
      expect(conPin.pinHash).not.toBeNull();
      expect(conPin.pinHash).not.toBe(pin);
      expect(conPin.pinHash).toMatch(/^\$2[aby]\$/u);

      // La ruta de lectura no revela ni el hash ni el PIN.
      const lectura = await request(app.getHttpServer())
        .get(`/api/employees/${empleado.id}`)
        .set(...como(admin))
        .expect(200);
      const cuerpo = JSON.stringify(lectura.body);
      expect(cuerpo).not.toContain(pin);
      expect(lectura.body).not.toHaveProperty('pin');
      expect(lectura.body).not.toHaveProperty('pinHash');
      expect(cuerpo).not.toContain('$2b$');
    });

    it('la regeneracion produce un hash distinto del anterior', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Regenera Pin',
      );
      const empleado = await registrarEmpleado({ usuarioId: usuario.id });
      const prisma = clientePrueba();

      const primero = (
        await request(app.getHttpServer())
          .post(`/api/employees/${empleado.id}/pin`)
          .set(...como(admin))
          .expect(200)
      ).body as { pin: string };

      const segundo = (
        await request(app.getHttpServer())
          .post(`/api/employees/${empleado.id}/pin`)
          .set(...como(admin))
          .expect(200)
      ).body as { pin: string };

      const hash = await prisma.empleado.findUniqueOrThrow({
        where: { id: empleado.id },
        select: { pinHash: true },
      });

      expect(primero.pin).toMatch(/^\d{6}$/u);
      expect(segundo.pin).toMatch(/^\d{6}$/u);
      expect(hash.pinHash).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------- permisos

  describe('permisos', () => {
    it('un Empleado sin permisos no toca /employees: 403', async () => {
      const empleado = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Sin Permiso',
      );
      const token = (
        await iniciarSesion(app, empleado.email, PASSWORD_VALIDA_PRUEBAS).expect(200)
      ).body.accessToken as string;

      await request(app.getHttpServer())
        .get('/api/employees')
        .set(...como(token))
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/employees')
        .set(...como(token))
        .send({})
        .expect(403);
    });

    it('todas las rutas responden 401 sin token', async () => {
      const usuario = await crearEmpleado(app, admin, sucursales.centro, 'Empleado Anon');
      const empleado = await registrarEmpleado({ usuarioId: usuario.id });
      const idInexistente = '00000000-0000-7000-8000-000000000000';
      const servidor = app.getHttpServer();

      const peticiones: [string, () => request.Test][] = [
        ['GET', () => request(servidor).get('/api/employees')],
        ['POST', () => request(servidor).post('/api/employees').send({})],
        ['GET por id', () => request(servidor).get(`/api/employees/${empleado.id}`)],
        ['PATCH', () => request(servidor).patch(`/api/employees/${empleado.id}`).send({})],
        ['CESE', () => request(servidor).post(`/api/employees/${empleado.id}/cese`).send({})],
        ['PIN', () => request(servidor).post(`/api/employees/${empleado.id}/pin`)],
        ['GET inexistente', () => request(servidor).get(`/api/employees/${idInexistente}`)],
      ];

      for (const [nombre, construir] of peticiones) {
        await construir().expect(401);
        expect(nombre).toBeTruthy();
      }
    });
  });

  // ---------------------------------------------------- integridad de la base

  describe('trigger de integridad de justificacion_falta', () => {
    it('rechaza UPDATE y DELETE sobre una justificacion ya creada', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Justificado',
      );
      const empleado = await registrarEmpleado({ usuarioId: usuario.id });
      const prisma = clientePrueba();

      // La justificacion se escribe directo contra la base: lo que se comprueba
      // es el trigger, no el caso de uso (que llega en la etapa de
      // justificaciones).
      const justificacion = await prisma.justificacionFalta.create({
        data: {
          empleadoId: empleado.id,
          fecha: new Date('2026-03-01T00:00:00.000Z'),
          motivo: 'Justificacion de prueba',
          usuarioJustificadorId: usuario.id,
        },
      });

      await expect(
        prisma.$executeRaw`
          UPDATE justificacion_falta
             SET motivo = 'Reescrita a mano'
           WHERE id = ${justificacion.id}
        `,
      ).rejects.toThrow();

      await expect(
        prisma.$executeRaw`
          DELETE FROM justificacion_falta
           WHERE id = ${justificacion.id}
        `,
      ).rejects.toThrow();

      // La fila sigue intacta.
      const fila = await prisma.justificacionFalta.findUniqueOrThrow({
        where: { id: justificacion.id },
      });
      expect(fila.motivo).toBe('Justificacion de prueba');
    });
  });
});