// Pruebas end-to-end del modulo de asistencia.
//
// Todas pasan por HTTP con supertest contra la base de pruebas. Se cubren los
// caminos delicados: la hora la pone el servidor, el PIN con su ventana de
// fallos, el doble marcaje, la inmutabilidad de `registro_asistencia`, las
// correcciones (incluido el cierre administrativo), las justificaciones y el
// alcance de las lecturas y de las faltas.
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
  type UsuarioCreado,
} from './utils/fixtures-pruebas';

type EmpleadoE2E = {
  id: string;
  usuarioId: string;
  sucursalId: string;
  estado: string;
};

type RegistroE2E = {
  id: string;
  empleadoId: string;
  sucursalId: string;
  tipo: string;
  fechaHora: string;
  metodo: string;
  esCorreccion: boolean;
  registroOriginalId: string | null;
  motivo: string | null;
  usuarioCorrectorId: string | null;
};

type ItemRegistro = {
  id: string;
  empleadoId: string;
  sucursalId: string;
  tipo: string;
  fechaHora: string;
  metodo: string;
  abierta: boolean;
  corregido: boolean;
  empleado: { id: string; nombre: string };
};

type ListaRegistros = {
  items: ItemRegistro[];
  total: number;
  page: number;
  limit: number;
};

type DetalleRegistro = ItemRegistro & {
  correcciones: {
    id: string;
    tipo: string;
    fechaHora: string;
    motivo: string | null;
    usuarioCorrectorId: string | null;
  }[];
};

type TurnoE2E = { id: string; tipo: string; diasSemana: string | null };

type FaltaItem = {
  empleadoId: string;
  empleadoNombre: string;
  sucursalId: string;
  fecha: string;
  turno: { tipo: string; diasSemana: string | null };
};

type ListaFaltas = { items: FaltaItem[]; total: number };

const ID_INEXISTENTE = '00000000-0000-7000-8000-000000000000';

/** Dia `YYYY-MM-DD` en el calendario del negocio (America/Lima, UTC-5 fijo). */
function fechaLocal(desplazamientoDias = 0): string {
  const base = new Date(Date.now() + desplazamientoDias * 86_400_000);
  const lima = new Date(base.getTime() - 5 * 3_600_000);
  return lima.toISOString().slice(0, 10);
}

/** Instante ISO que cae en el dia local indicado, a media manana. */
function instanteEnDia(fecha: string, horaUtc = 15): string {
  return `${fecha}T${String(horaUtc).padStart(2, '0')}:00:00.000Z`;
}

describe('attendance (e2e)', () => {
  let app: INestApplication;
  let admin: string;
  let sucursales: Sucursales;
  let gerenteCentro: { usuario: UsuarioCreado; token: string };

  beforeAll(async () => {
    app = await crearAppDePruebas();
  });

  beforeEach(async () => {
    await resetDatabase(clientePrueba());
    admin = await tokenDeAdmin(app);
    sucursales = await idsDeSucursales();
    gerenteCentro = await crearGerente(
      app,
      admin,
      sucursales.centro,
      'Gerente Centro Asistencia',
    );
  });

  afterAll(async () => {
    await app.close();
    await cerrarClientePrueba();
  });

  // ------------------------------------------------------------------ helpers

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

  /** Genera el PIN de un empleado y lo devuelve. */
  async function generarPin(empleadoId: string): Promise<string> {
    const respuesta = await request(app.getHttpServer())
      .post(`/api/employees/${empleadoId}/pin`)
      .set(...como(admin))
      .expect(200);

    return (respuesta.body as { pin: string }).pin;
  }

  /** Empleado completo (usuario + empleado + PIN) en una sucursal. */
  async function empleadoConPin(
    sucursalId: string,
    nombre: string,
  ): Promise<{
    usuario: UsuarioCreado;
    empleado: EmpleadoE2E;
    pin: string;
    token: string;
  }> {
    const usuario = await crearEmpleado(app, admin, sucursalId, nombre);
    const empleado = await registrarEmpleado(usuario.id);
    const pin = await generarPin(empleado.id);
    const token = (
      await iniciarSesion(app, usuario.email, PASSWORD_VALIDA_PRUEBAS).expect(200)
    ).body.accessToken as string;

    return { usuario, empleado, pin, token };
  }

  /** Marca la asistencia de un empleado; devuelve la peticion sin esperarla. */
  function marcar(
    token: string,
    datos: {
      empleadoId: string;
      tipo: 'entrada' | 'salida';
      pin: string;
      fechaHora?: string;
    },
  ): request.Test {
    return request(app.getHttpServer())
      .post('/api/attendance/mark')
      .set(...como(token))
      .send(datos);
  }

  function corregir(
    token: string,
    id: string,
    datos: { motivo: string; fechaHora: string; tipo?: 'entrada' | 'salida' },
  ): request.Test {
    return request(app.getHttpServer())
      .post(`/api/attendance/records/${id}/correct`)
      .set(...como(token))
      .send(datos);
  }

  function justificar(
    token: string,
    datos: { empleadoId: string; fecha: string; motivo: string },
  ): request.Test {
    return request(app.getHttpServer())
      .post('/api/attendance/absences/justify')
      .set(...como(token))
      .send(datos);
  }

  function listarRegistros(
    token: string,
    query: Record<string, string> = {},
  ): request.Test {
    return request(app.getHttpServer())
      .get('/api/attendance/records')
      .query(query)
      .set(...como(token));
  }

  async function crearTurnoFijo(
    sucursalId: string,
    diasSemana = '1,2,3,4,5,6,7',
  ): Promise<TurnoE2E> {
    const respuesta = await request(app.getHttpServer())
      .post('/api/shifts')
      .set(...como(admin))
      .send({
        sucursalId,
        tipo: 'fijo',
        horaInicio: '08:00',
        horaFin: '16:00',
        diasSemana,
      })
      .expect(201);

    return respuesta.body as TurnoE2E;
  }

  async function crearTurnoVariable(sucursalId: string): Promise<TurnoE2E> {
    const respuesta = await request(app.getHttpServer())
      .post('/api/shifts')
      .set(...como(admin))
      .send({ sucursalId, tipo: 'variable' })
      .expect(201);

    return respuesta.body as TurnoE2E;
  }

  async function asignarTurno(
    empleadoId: string,
    turnoId: string,
    fechaInicio: string,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/assignments')
      .set(...como(admin))
      .send({ empleadoId, turnoId, fechaInicio })
      .expect(201);
  }

  /** Inserta directamente una entrada original abierta (tabla solo-INSERT). */
  async function insertarEntradaDirecta(
    empleado: EmpleadoE2E,
    fechaHora: Date,
  ): Promise<string> {
    const fila = await clientePrueba().registroAsistencia.create({
      data: {
        empleadoId: empleado.id,
        sucursalId: empleado.sucursalId,
        tipo: 'entrada',
        fechaHora,
        metodo: 'pin',
        esCorreccion: false,
      },
      select: { id: true },
    });

    return fila.id;
  }

  // --------------------------------------------------------------- marcacion

  describe('marcacion', () => {
    it('registra una entrada con PIN correcto y pone la hora el servidor', async () => {
      const { empleado, pin } = await empleadoConPin(
        sucursales.centro,
        'Marca Entrada',
      );

      const antes = Date.now();
      const respuesta = await marcar(gerenteCentro.token, {
        empleadoId: empleado.id,
        tipo: 'entrada',
        pin,
      }).expect(201);

      const registro = respuesta.body as RegistroE2E;
      expect(registro.tipo).toBe('entrada');
      expect(registro.metodo).toBe('pin');
      expect(registro.esCorreccion).toBe(false);
      expect(registro.sucursalId).toBe(sucursales.centro);

      const instante = new Date(registro.fechaHora).getTime();
      expect(instante).toBeGreaterThanOrEqual(antes - 1000);
      expect(instante).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('ignora la fecha que intente fijar el cliente', async () => {
      const { empleado, pin } = await empleadoConPin(
        sucursales.centro,
        'Marca Ignora Fecha',
      );

      const respuesta = await marcar(gerenteCentro.token, {
        empleadoId: empleado.id,
        tipo: 'entrada',
        pin,
        fechaHora: '2000-01-01T00:00:00.000Z',
      }).expect(201);

      const registro = respuesta.body as RegistroE2E;
      expect(new Date(registro.fechaHora).getUTCFullYear()).toBeGreaterThan(2020);
    });

    it('rechaza un PIN incorrecto con 403', async () => {
      const { empleado } = await empleadoConPin(sucursales.centro, 'Pin Malo');

      await marcar(gerenteCentro.token, {
        empleadoId: empleado.id,
        tipo: 'entrada',
        pin: '000000',
      }).expect(403);
    });

    it('rechaza con 403 a un empleado que no tiene PIN', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Sin Pin Empleado',
      );
      const empleado = await registrarEmpleado(usuario.id);

      await marcar(gerenteCentro.token, {
        empleadoId: empleado.id,
        tipo: 'entrada',
        pin: '123456',
      }).expect(403);
    });

    it('bloquea con 429 tras cinco fallos, incluso con el PIN correcto', async () => {
      const { empleado, pin } = await empleadoConPin(
        sucursales.centro,
        'Pin Bloqueado',
      );

      for (let intento = 0; intento < 5; intento += 1) {
        await marcar(gerenteCentro.token, {
          empleadoId: empleado.id,
          tipo: 'entrada',
          pin: '000000',
        }).expect(403);
      }

      await marcar(gerenteCentro.token, {
        empleadoId: empleado.id,
        tipo: 'entrada',
        pin,
      }).expect(429);
    });

    it('el Admin sin sucursal no puede marcar: 403', async () => {
      const { empleado, pin } = await empleadoConPin(
        sucursales.centro,
        'Admin No Marca',
      );

      await marcar(admin, {
        empleadoId: empleado.id,
        tipo: 'entrada',
        pin,
      }).expect(403);
    });

    it('un empleado de otra sucursal responde 404', async () => {
      const { empleado, pin } = await empleadoConPin(
        sucursales.norte,
        'Empleado Norte',
      );

      await marcar(gerenteCentro.token, {
        empleadoId: empleado.id,
        tipo: 'entrada',
        pin,
      }).expect(404);
    });

    it('un empleado inactivo responde 404', async () => {
      const { empleado, pin } = await empleadoConPin(
        sucursales.centro,
        'Empleado Inactivo',
      );
      await clientePrueba().empleado.update({
        where: { id: empleado.id },
        data: { estado: 'inactivo' },
      });

      await marcar(gerenteCentro.token, {
        empleadoId: empleado.id,
        tipo: 'entrada',
        pin,
      }).expect(404);
    });

    it('rechaza una doble entrada el mismo dia con 409', async () => {
      const { empleado, pin } = await empleadoConPin(
        sucursales.centro,
        'Doble Entrada',
      );

      await marcar(gerenteCentro.token, {
        empleadoId: empleado.id,
        tipo: 'entrada',
        pin,
      }).expect(201);

      await marcar(gerenteCentro.token, {
        empleadoId: empleado.id,
        tipo: 'entrada',
        pin,
      }).expect(409);
    });

    it('rechaza una salida sin entrada abierta con 409', async () => {
      const { empleado, pin } = await empleadoConPin(
        sucursales.centro,
        'Salida Suelta',
      );

      await marcar(gerenteCentro.token, {
        empleadoId: empleado.id,
        tipo: 'salida',
        pin,
      }).expect(409);
    });

    it('permite una entrada nueva con una abierta de ayer y la deja abierta', async () => {
      const { empleado, pin } = await empleadoConPin(
        sucursales.centro,
        'Entrada Ayer',
      );
      const idAyer = await insertarEntradaDirecta(
        empleado,
        new Date(instanteEnDia(fechaLocal(-1))),
      );

      await marcar(gerenteCentro.token, {
        empleadoId: empleado.id,
        tipo: 'entrada',
        pin,
      }).expect(201);

      const detalle = (
        await request(app.getHttpServer())
          .get(`/api/attendance/records/${idAyer}`)
          .set(...como(gerenteCentro.token))
          .expect(200)
      ).body as DetalleRegistro;

      expect(detalle.abierta).toBe(true);
    });

    it('la tabla registro_asistencia rechaza UPDATE y DELETE directos', async () => {
      const { empleado, pin } = await empleadoConPin(
        sucursales.centro,
        'Inmutable',
      );
      const registro = (
        await marcar(gerenteCentro.token, {
          empleadoId: empleado.id,
          tipo: 'entrada',
          pin,
        }).expect(201)
      ).body as RegistroE2E;

      await expect(
        clientePrueba().$executeRawUnsafe(
          `UPDATE registro_asistencia SET metodo = 'hack' WHERE id = '${registro.id}'`,
        ),
      ).rejects.toThrow();

      await expect(
        clientePrueba().$executeRawUnsafe(
          `DELETE FROM registro_asistencia WHERE id = '${registro.id}'`,
        ),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------- correccion

  describe('correccion', () => {
    it('una correccion crea fila nueva y deja el original intacto', async () => {
      const { empleado, pin } = await empleadoConPin(
        sucursales.centro,
        'Corregir Original',
      );
      const original = (
        await marcar(gerenteCentro.token, {
          empleadoId: empleado.id,
          tipo: 'entrada',
          pin,
        }).expect(201)
      ).body as RegistroE2E;

      const corregida = new Date(Date.now() - 60_000).toISOString();
      const respuesta = await corregir(gerenteCentro.token, original.id, {
        motivo: 'El empleado llego antes',
        fechaHora: corregida,
      }).expect(201);

      const filaCorreccion = respuesta.body as RegistroE2E;
      expect(filaCorreccion.esCorreccion).toBe(true);
      expect(filaCorreccion.registroOriginalId).toBe(original.id);
      expect(filaCorreccion.usuarioCorrectorId).toBe(gerenteCentro.usuario.id);
      expect(filaCorreccion.motivo).toBe('El empleado llego antes');

      const detalle = (
        await request(app.getHttpServer())
          .get(`/api/attendance/records/${original.id}`)
          .set(...como(gerenteCentro.token))
          .expect(200)
      ).body as DetalleRegistro;
      expect(new Date(detalle.fechaHora).toISOString()).toBe(corregida);
      expect(detalle.corregido).toBe(true);

      const originalEnBase = await clientePrueba().registroAsistencia.findUnique({
        where: { id: original.id },
        select: { metodo: true, fechaHora: true, esCorreccion: true },
      });
      expect(originalEnBase?.metodo).toBe('pin');
      expect(originalEnBase?.esCorreccion).toBe(false);
      expect(originalEnBase?.fechaHora.toISOString()).toBe(
        original.fechaHora,
      );
    });

    it('rechaza una segunda correccion del mismo par con 409', async () => {
      const { empleado, pin } = await empleadoConPin(
        sucursales.centro,
        'Par Duplicado',
      );
      const original = (
        await marcar(gerenteCentro.token, {
          empleadoId: empleado.id,
          tipo: 'entrada',
          pin,
        }).expect(201)
      ).body as RegistroE2E;

      const fecha = new Date(Date.now() - 60_000).toISOString();
      await corregir(gerenteCentro.token, original.id, {
        motivo: 'Primera',
        fechaHora: fecha,
      }).expect(201);

      await corregir(gerenteCentro.token, original.id, {
        motivo: 'Segunda',
        fechaHora: fecha,
      }).expect(409);
    });

    it('el cierre administrativo de una entrada abierta la deja cerrada', async () => {
      const { empleado } = await empleadoConPin(
        sucursales.centro,
        'Cierre Administrativo',
      );
      const idEntrada = await insertarEntradaDirecta(
        empleado,
        new Date(instanteEnDia(fechaLocal(-1))),
      );

      await corregir(gerenteCentro.token, idEntrada, {
        motivo: 'Olvido marcar la salida',
        fechaHora: new Date(Date.now() - 60_000).toISOString(),
        tipo: 'salida',
      }).expect(201);

      const detalle = (
        await request(app.getHttpServer())
          .get(`/api/attendance/records/${idEntrada}`)
          .set(...como(gerenteCentro.token))
          .expect(200)
      ).body as DetalleRegistro;

      expect(detalle.abierta).toBe(false);
    });

    it('rechaza un cierre anterior a la entrada con 400', async () => {
      const { empleado } = await empleadoConPin(
        sucursales.centro,
        'Cierre Invalido',
      );
      const idEntrada = await insertarEntradaDirecta(
        empleado,
        new Date(instanteEnDia(fechaLocal(-1))),
      );

      await corregir(gerenteCentro.token, idEntrada, {
        motivo: 'Cierre antes de la entrada',
        fechaHora: new Date(instanteEnDia(fechaLocal(-2))).toISOString(),
        tipo: 'salida',
      }).expect(400);
    });

    it('rechaza corregir un registro de otra sucursal con 404', async () => {
      const { empleado } = await empleadoConPin(
        sucursales.norte,
        'Registro Norte',
      );
      const idRegistro = await insertarEntradaDirecta(
        empleado,
        new Date(Date.now() - 3_600_000),
      );

      await corregir(gerenteCentro.token, idRegistro, {
        motivo: 'Fuera de alcance',
        fechaHora: new Date(Date.now() - 60_000).toISOString(),
      }).expect(404);
    });

    it('el Admin intentando corregir responde 403', async () => {
      const { empleado, pin } = await empleadoConPin(
        sucursales.centro,
        'Admin Corrige',
      );
      const original = (
        await marcar(gerenteCentro.token, {
          empleadoId: empleado.id,
          tipo: 'entrada',
          pin,
        }).expect(201)
      ).body as RegistroE2E;

      await corregir(admin, original.id, {
        motivo: 'Admin sin permiso',
        fechaHora: new Date(Date.now() - 60_000).toISOString(),
      }).expect(403);
    });

    it('un Gerente no puede corregir sus propios registros: 403', async () => {
      const empleadoDelGerente = await registrarEmpleado(
        gerenteCentro.usuario.id,
      );
      const pin = await generarPin(empleadoDelGerente.id);

      const original = (
        await marcar(gerenteCentro.token, {
          empleadoId: empleadoDelGerente.id,
          tipo: 'entrada',
          pin,
        }).expect(201)
      ).body as RegistroE2E;

      await corregir(gerenteCentro.token, original.id, {
        motivo: 'Mi propio registro',
        fechaHora: new Date(Date.now() - 60_000).toISOString(),
      }).expect(403);
    });
  });

  // ---------------------------------------------------------- justificaciones

  describe('justificacion de faltas', () => {
    it('justifica una falta: 201', async () => {
      const { empleado } = await empleadoConPin(
        sucursales.centro,
        'Justificar Falta',
      );

      const respuesta = await justificar(gerenteCentro.token, {
        empleadoId: empleado.id,
        fecha: fechaLocal(-1),
        motivo: 'Cita medica',
      }).expect(201);

      const cuerpo = respuesta.body as {
        empleadoId: string;
        fecha: string;
        usuarioJustificadorId: string;
      };
      expect(cuerpo.empleadoId).toBe(empleado.id);
      expect(cuerpo.usuarioJustificadorId).toBe(gerenteCentro.usuario.id);
    });

    it('rechaza una falta ya justificada con 409', async () => {
      const { empleado } = await empleadoConPin(
        sucursales.centro,
        'Falta Repetida',
      );

      await justificar(gerenteCentro.token, {
        empleadoId: empleado.id,
        fecha: fechaLocal(-1),
        motivo: 'Primera',
      }).expect(201);

      await justificar(gerenteCentro.token, {
        empleadoId: empleado.id,
        fecha: fechaLocal(-1),
        motivo: 'Segunda',
      }).expect(409);
    });

    it('rechaza justificar un dia con entrada efectiva con 409', async () => {
      const { empleado, pin } = await empleadoConPin(
        sucursales.centro,
        'Falta Con Entrada',
      );
      await marcar(gerenteCentro.token, {
        empleadoId: empleado.id,
        tipo: 'entrada',
        pin,
      }).expect(201);

      await justificar(gerenteCentro.token, {
        empleadoId: empleado.id,
        fecha: fechaLocal(0),
        motivo: 'No deberia',
      }).expect(409);
    });

    it('rechaza una fecha futura con 400', async () => {
      const { empleado } = await empleadoConPin(
        sucursales.centro,
        'Falta Futura',
      );

      await justificar(gerenteCentro.token, {
        empleadoId: empleado.id,
        fecha: fechaLocal(1),
        motivo: 'Futuro',
      }).expect(400);
    });

    it('rechaza un empleado fuera de alcance con 404', async () => {
      const { empleado } = await empleadoConPin(
        sucursales.norte,
        'Falta Fuera Alcance',
      );

      await justificar(gerenteCentro.token, {
        empleadoId: empleado.id,
        fecha: fechaLocal(-1),
        motivo: 'Fuera',
      }).expect(404);
    });
  });

  // ---------------------------------------------------------------- lecturas

  describe('lecturas de registros', () => {
    it('una entrada abierta aparece y se cierra con la salida', async () => {
      const { empleado, pin } = await empleadoConPin(
        sucursales.centro,
        'Abierta Y Cerrada',
      );

      await marcar(gerenteCentro.token, {
        empleadoId: empleado.id,
        tipo: 'entrada',
        pin,
      }).expect(201);

      const abiertas = (
        await listarRegistros(gerenteCentro.token, {
          empleadoId: empleado.id,
          abierta: 'true',
        }).expect(200)
      ).body as ListaRegistros;
      expect(abiertas.items).toHaveLength(1);
      expect(abiertas.items[0]?.abierta).toBe(true);

      await marcar(gerenteCentro.token, {
        empleadoId: empleado.id,
        tipo: 'salida',
        pin,
      }).expect(201);

      const trasCerrar = (
        await listarRegistros(gerenteCentro.token, {
          empleadoId: empleado.id,
          abierta: 'true',
        }).expect(200)
      ).body as ListaRegistros;
      expect(trasCerrar.items).toHaveLength(0);
    });

    it('un Empleado solo ve sus propios registros', async () => {
      const propio = await empleadoConPin(sucursales.centro, 'Ve Los Suyos');
      const ajeno = await empleadoConPin(sucursales.centro, 'Ve Los Ajenos');

      await marcar(gerenteCentro.token, {
        empleadoId: propio.empleado.id,
        tipo: 'entrada',
        pin: propio.pin,
      }).expect(201);
      await marcar(gerenteCentro.token, {
        empleadoId: ajeno.empleado.id,
        tipo: 'entrada',
        pin: ajeno.pin,
      }).expect(201);

      const lista = (
        await listarRegistros(propio.token).expect(200)
      ).body as ListaRegistros;

      expect(lista.items.length).toBeGreaterThan(0);
      expect(lista.items.every((item) => item.empleadoId === propio.empleado.id))
        .toBe(true);
    });

    it('el Admin ve registros de todas las sucursales', async () => {
      const centro = await empleadoConPin(sucursales.centro, 'Admin Ve Centro');
      const norte = await empleadoConPin(sucursales.norte, 'Admin Ve Norte');
      await insertarEntradaDirecta(centro.empleado, new Date());
      await insertarEntradaDirecta(norte.empleado, new Date());

      const lista = (
        await listarRegistros(admin).expect(200)
      ).body as ListaRegistros;

      const sucursalesVistas = new Set(lista.items.map((item) => item.sucursalId));
      expect(sucursalesVistas.has(sucursales.centro)).toBe(true);
      expect(sucursalesVistas.has(sucursales.norte)).toBe(true);
    });

    it('un Gerente de otra sucursal obtiene 404 al filtrar por empleado', async () => {
      const { empleado } = await empleadoConPin(
        sucursales.centro,
        'Filtro Fuera',
      );

      await listarRegistros(gerenteCentro.token, {
        empleadoId: ID_INEXISTENTE,
      }).expect(404);

      // El mismo filtro pero con un id real de su sucursal si funciona.
      await listarRegistros(gerenteCentro.token, {
        empleadoId: empleado.id,
      }).expect(200);

      const gerenteNorte = await crearGerente(
        app,
        admin,
        sucursales.norte,
        'Gerente Norte Filtro',
      );
      await listarRegistros(gerenteNorte.token, {
        empleadoId: empleado.id,
      }).expect(404);
    });

    it('obtener un registro de otra sucursal responde 404', async () => {
      const { empleado } = await empleadoConPin(
        sucursales.centro,
        'Detalle Fuera',
      );
      const id = await insertarEntradaDirecta(empleado, new Date());
      const gerenteNorte = await crearGerente(
        app,
        admin,
        sucursales.norte,
        'Gerente Norte Detalle',
      );

      await request(app.getHttpServer())
        .get(`/api/attendance/records/${id}`)
        .set(...como(gerenteNorte.token))
        .expect(404);
    });
  });

  // ------------------------------------------------------------------ faltas

  describe('faltas', () => {
    it('un turno fijo genera falta y un turno variable no', async () => {
      const fijo = await empleadoConPin(sucursales.centro, 'Falta Fija');
      const variable = await empleadoConPin(sucursales.centro, 'Falta Variable');

      const turnoFijo = await crearTurnoFijo(sucursales.centro);
      const turnoVariable = await crearTurnoVariable(sucursales.centro);
      await asignarTurno(fijo.empleado.id, turnoFijo.id, fechaLocal(-10));
      await asignarTurno(
        variable.empleado.id,
        turnoVariable.id,
        fechaLocal(-10),
      );

      const respuesta = (
        await request(app.getHttpServer())
          .get('/api/attendance/absences')
          .query({ desde: fechaLocal(-3), hasta: fechaLocal(0) })
          .set(...como(gerenteCentro.token))
          .expect(200)
      ).body as ListaFaltas;

      expect(respuesta.items.some((item) => item.empleadoId === fijo.empleado.id))
        .toBe(true);
      expect(
        respuesta.items.every(
          (item) => item.empleadoId !== variable.empleado.id,
        ),
      ).toBe(true);
    });

    it('un dia con entrada efectiva no es falta', async () => {
      const empleado = await empleadoConPin(sucursales.centro, 'Falta Con Marca');
      const turno = await crearTurnoFijo(sucursales.centro);
      await asignarTurno(empleado.empleado.id, turno.id, fechaLocal(-10));

      await marcar(gerenteCentro.token, {
        empleadoId: empleado.empleado.id,
        tipo: 'entrada',
        pin: empleado.pin,
      }).expect(201);

      const respuesta = (
        await request(app.getHttpServer())
          .get('/api/attendance/absences')
          .query({ desde: fechaLocal(0), hasta: fechaLocal(0) })
          .set(...como(gerenteCentro.token))
          .expect(200)
      ).body as ListaFaltas;

      expect(
        respuesta.items.some(
          (item) => item.empleadoId === empleado.empleado.id,
        ),
      ).toBe(false);
    });

    it('rechaza un rango mayor de 92 dias con 400', async () => {
      await request(app.getHttpServer())
        .get('/api/attendance/absences')
        .query({ desde: fechaLocal(-93), hasta: fechaLocal(0) })
        .set(...como(gerenteCentro.token))
        .expect(400);
    });

    it('exige el rango desde-hasta con 400', async () => {
      await request(app.getHttpServer())
        .get('/api/attendance/absences')
        .query({ hasta: fechaLocal(0) })
        .set(...como(gerenteCentro.token))
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/attendance/absences')
        .query({ desde: fechaLocal(-3) })
        .set(...como(gerenteCentro.token))
        .expect(400);
    });
  });

  // ---------------------------------------------------------------- terminal

  describe('terminal', () => {
    it('lista solo los empleados activos de la sucursal del actor', async () => {
      const activo1 = await empleadoConPin(sucursales.centro, 'Activo Uno');
      const activo2 = await empleadoConPin(sucursales.centro, 'Activo Dos');
      const inactivo = await empleadoConPin(sucursales.centro, 'Inactivo Uno');
      await clientePrueba().empleado.update({
        where: { id: inactivo.empleado.id },
        data: { estado: 'inactivo' },
      });
      await empleadoConPin(sucursales.norte, 'Activo Norte');

      const lista = (
        await request(app.getHttpServer())
          .get('/api/attendance/terminal/employees')
          .set(...como(gerenteCentro.token))
          .expect(200)
      ).body as { id: string; nombre: string }[];

      const ids = lista.map((item) => item.id);
      expect(ids).toContain(activo1.empleado.id);
      expect(ids).toContain(activo2.empleado.id);
      expect(ids).not.toContain(inactivo.empleado.id);
    });

    it('el Admin sin sucursal no puede listar el terminal: 403', async () => {
      await request(app.getHttpServer())
        .get('/api/attendance/terminal/employees')
        .set(...como(admin))
        .expect(403);
    });
  });
});