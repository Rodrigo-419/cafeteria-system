// Pruebas end-to-end del reporte comparativo entre sucursales.
//
// El endpoint es de solo lectura, asi que los datos se preparan UNA vez en
// `beforeAll` escribiendo directamente con Prisma: es la unica forma de fijar
// `created_at` y `fecha_hora` a instantes concretos (por ejemplo, una venta a
// las 23:30 de Lima del ultimo dia del rango) sin depender del reloj. Las
// ventas, movimientos y registros de asistencia son de un periodo pasado, de
// modo que el recorte a "hoy" de las faltas no entra en juego.
//
// El periodo de referencia es 2026-09-01 .. 2026-09-30 (30 dias).
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
  crearEmpleado,
  crearGerente,
  idsDeSucursales,
  type Sucursales,
} from './utils/fixtures-pruebas';
import { idsDeVariantes } from './utils/fixtures-productos-pruebas';
import { PASSWORD_VALIDA_PRUEBAS } from './utils/constantes-pruebas';

const DESDE = '2026-09-01';
const HASTA = '2026-09-30';
const ID_INEXISTENTE = '00000000-0000-7000-8000-000000000000';

type ReporteSucursalE2E = {
  sucursalId: string;
  sucursalNombre: string;
  ventas: {
    total: string;
    cantidad: number;
    ticketPromedio: string | null;
    porMetodoPago: {
      efectivo: { total: string; cantidad: number };
      tarjeta: { total: string; cantidad: number };
    };
    anuladas: { cantidad: number };
  };
  inventario: {
    movimientos: {
      total: number;
      entradas: { cantidad: number; cantidadNeta: string };
      ajustes: { cantidad: number; cantidadNeta: string };
    };
  };
  asistencia: { faltas: number; faltasJustificadas: number };
  estadoActual: {
    insumosConAlertaAbierta: number;
    entradasAbiertas: number;
  };
};

type ReporteE2E = {
  desde: string;
  hasta: string;
  generadoEn: string;
  sucursales: ReporteSucursalE2E[];
};

/** Instante UTC de una hora local de America/Lima (UTC-5 fijo). */
function instanteLima(dia: string, hora: number, minuto = 0): Date {
  const [anio, mes, d] = dia.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(anio, mes - 1, d, hora + 5, minuto));
}

describe('reports (e2e)', () => {
  let app: INestApplication;
  let admin: string;
  let sucursales: Sucursales;

  /** Reporte de referencia, pedido una vez en `beforeAll`. */
  let reporte: ReporteE2E;

  beforeAll(async () => {
    app = await crearAppDePruebas();
    await resetDatabase(clientePrueba());
    admin = await tokenDeAdmin(app);
    sucursales = await idsDeSucursales();

    const prisma = clientePrueba();
    const gerente = await crearGerente(
      app,
      admin,
      sucursales.centro,
      'Gerente Reporte',
    );
    const idUsuario = gerente.usuario.id;

    // --------------------------------------------------------------- catalogo
    const variantes = await idsDeVariantes();
    const categoria = await prisma.categoriaProducto.create({
      data: { nombre: 'Categoria Reporte' },
    });
    const producto = await prisma.producto.create({
      data: { nombre: 'Producto Reporte', categoriaId: categoria.id },
    });
    const psvCentro = await prisma.productoSucursalVariante.create({
      data: {
        productoId: producto.id,
        sucursalId: sucursales.centro,
        varianteId: variantes.unica,
        precio: '10.00',
      },
      select: { id: true },
    });
    const psvNorte = await prisma.productoSucursalVariante.create({
      data: {
        productoId: producto.id,
        sucursalId: sucursales.norte,
        varianteId: variantes.unica,
        precio: '10.00',
      },
      select: { id: true },
    });

    /** Venta de una sola linea con `created_at` fijo. */
    async function crearVenta(datos: {
      sucursalId: string;
      psvId: string;
      metodoPago: 'efectivo' | 'tarjeta';
      subtotal: string;
      createdAt: Date;
      estado?: 'completada' | 'anulada';
    }): Promise<void> {
      const estado = datos.estado ?? 'completada';
      await prisma.venta.create({
        data: {
          sucursalId: datos.sucursalId,
          usuarioId: idUsuario,
          metodoPago: datos.metodoPago,
          estado,
          createdAt: datos.createdAt,
          ...(estado === 'anulada'
            ? {
                fechaAnulacion: datos.createdAt,
                usuarioAnuladorId: idUsuario,
                motivoAnulacion: 'Prueba de reporte',
              }
            : {}),
          detalles: {
            create: [
              {
                productoSucursalVarianteId: datos.psvId,
                cantidad: 1,
                precioUnitarioSnapshot: datos.subtotal,
                subtotal: datos.subtotal,
              },
            ],
          },
        },
      });
    }

    // Centro: efectivo 12.50 + 7.00 + 1.00 (borde) = 20.50, tarjeta 99.90.
    await crearVenta({
      sucursalId: sucursales.centro,
      psvId: psvCentro.id,
      metodoPago: 'efectivo',
      subtotal: '12.50',
      createdAt: instanteLima('2026-09-05', 12),
    });
    await crearVenta({
      sucursalId: sucursales.centro,
      psvId: psvCentro.id,
      metodoPago: 'efectivo',
      subtotal: '7.00',
      createdAt: instanteLima('2026-09-06', 12),
    });
    await crearVenta({
      sucursalId: sucursales.centro,
      psvId: psvCentro.id,
      metodoPago: 'tarjeta',
      subtotal: '99.90',
      createdAt: instanteLima('2026-09-07', 12),
    });
    // Borde: 23:30 de Lima del ultimo dia entra en el rango.
    await crearVenta({
      sucursalId: sucursales.centro,
      psvId: psvCentro.id,
      metodoPago: 'efectivo',
      subtotal: '1.00',
      createdAt: instanteLima('2026-09-30', 23, 30),
    });
    // Fuera: 00:30 de Lima del dia siguiente no entra.
    await crearVenta({
      sucursalId: sucursales.centro,
      psvId: psvCentro.id,
      metodoPago: 'efectivo',
      subtotal: '555.00',
      createdAt: instanteLima('2026-10-01', 0, 30),
    });
    // Anuladas: una dentro y otra fuera del rango.
    await crearVenta({
      sucursalId: sucursales.centro,
      psvId: psvCentro.id,
      metodoPago: 'efectivo',
      subtotal: '3.00',
      createdAt: instanteLima('2026-09-08', 12),
      estado: 'anulada',
    });
    await crearVenta({
      sucursalId: sucursales.centro,
      psvId: psvCentro.id,
      metodoPago: 'efectivo',
      subtotal: '4.00',
      createdAt: instanteLima('2026-10-01', 0, 30),
      estado: 'anulada',
    });

    // Norte: efectivo 5.00, tarjeta 2.25.
    await crearVenta({
      sucursalId: sucursales.norte,
      psvId: psvNorte.id,
      metodoPago: 'efectivo',
      subtotal: '5.00',
      createdAt: instanteLima('2026-09-03', 12),
    });
    await crearVenta({
      sucursalId: sucursales.norte,
      psvId: psvNorte.id,
      metodoPago: 'tarjeta',
      subtotal: '2.25',
      createdAt: instanteLima('2026-09-04', 12),
    });

    // ------------------------------------------------------------- inventario
    const insumo = await prisma.insumo.create({
      data: { nombre: 'Insumo Reporte', presentacion: 'unidad' },
    });
    const stockCentro = await prisma.insumoSucursal.create({
      data: {
        insumoId: insumo.id,
        sucursalId: sucursales.centro,
        stockActual: '100.00',
        stockMinimo: '0.00',
      },
      select: { id: true },
    });
    const stockNorte = await prisma.insumoSucursal.create({
      data: {
        insumoId: insumo.id,
        sucursalId: sucursales.norte,
        stockActual: '100.00',
        stockMinimo: '0.00',
      },
      select: { id: true },
    });

    async function crearMovimiento(datos: {
      insumoSucursalId: string;
      tipo: 'entrada' | 'ajuste';
      cantidad: string;
      createdAt: Date;
    }): Promise<void> {
      await prisma.movimientoInventario.create({
        data: {
          insumoSucursalId: datos.insumoSucursalId,
          tipo: datos.tipo,
          cantidad: datos.cantidad,
          usuarioId: idUsuario,
          motivo: 'Prueba de reporte',
          createdAt: datos.createdAt,
        },
      });
    }

    await crearMovimiento({
      insumoSucursalId: stockCentro.id,
      tipo: 'entrada',
      cantidad: '10.00',
      createdAt: instanteLima('2026-09-02', 12),
    });
    await crearMovimiento({
      insumoSucursalId: stockCentro.id,
      tipo: 'entrada',
      cantidad: '5.50',
      createdAt: instanteLima('2026-09-03', 12),
    });
    await crearMovimiento({
      insumoSucursalId: stockCentro.id,
      tipo: 'ajuste',
      cantidad: '-2.00',
      createdAt: instanteLima('2026-09-04', 12),
    });
    await crearMovimiento({
      insumoSucursalId: stockCentro.id,
      tipo: 'entrada',
      cantidad: '99.00',
      createdAt: instanteLima('2026-10-01', 0, 30),
    });
    await crearMovimiento({
      insumoSucursalId: stockNorte.id,
      tipo: 'ajuste',
      cantidad: '-1.25',
      createdAt: instanteLima('2026-09-05', 12),
    });

    // Una alerta abierta en Centro y una resuelta (que no debe contar).
    await prisma.alertaStock.create({
      data: { insumoSucursalId: stockCentro.id, estado: 'abierta' },
    });
    await prisma.alertaStock.create({
      data: {
        insumoSucursalId: stockNorte.id,
        estado: 'resuelta',
        fechaResuelta: instanteLima('2026-09-06', 12),
      },
    });

    // ------------------------------------------------------------- asistencia
    const usuarioFijo = await crearEmpleado(
      app,
      admin,
      sucursales.centro,
      'Fijo Reporte',
    );
    const empleadoFijo = (
      await request(app.getHttpServer())
        .post('/api/employees')
        .set(...como(admin))
        .send({
          usuarioId: usuarioFijo.id,
          cargo: 'Barista',
          fechaContratacion: '2020-01-01',
        })
        .expect(201)
    ).body as { id: string; sucursalId: string };

    // Turno fijo que exige los SIETE dias de la semana, vigente desde antes del
    // rango: asi cada dia del periodo es falta salvo entrada o justificacion.
    const turno = (
      await request(app.getHttpServer())
        .post('/api/shifts')
        .set(...como(admin))
        .send({
          sucursalId: sucursales.centro,
          tipo: 'fijo',
          horaInicio: '08:00',
          horaFin: '16:00',
          diasSemana: '1,2,3,4,5,6,7',
        })
        .expect(201)
    ).body as { id: string };
    await request(app.getHttpServer())
      .post('/api/assignments')
      .set(...como(admin))
      .send({ empleadoId: empleadoFijo.id, turnoId: turno.id, fechaInicio: '2026-01-01' })
      .expect(201);

    // Entrada y salida efectivas el 2026-09-10 (dia cubierto, no es falta).
    await prisma.registroAsistencia.create({
      data: {
        empleadoId: empleadoFijo.id,
        sucursalId: empleadoFijo.sucursalId,
        tipo: 'entrada',
        fechaHora: instanteLima('2026-09-10', 10),
        metodo: 'pin',
        esCorreccion: false,
      },
    });
    await prisma.registroAsistencia.create({
      data: {
        empleadoId: empleadoFijo.id,
        sucursalId: empleadoFijo.sucursalId,
        tipo: 'salida',
        fechaHora: instanteLima('2026-09-10', 17),
        metodo: 'pin',
        esCorreccion: false,
      },
    });
    // Entrada abierta de hoy: cuenta en el estado actual de Centro.
    await prisma.registroAsistencia.create({
      data: {
        empleadoId: empleadoFijo.id,
        sucursalId: empleadoFijo.sucursalId,
        tipo: 'entrada',
        fechaHora: new Date(Date.now() - 60_000),
        metodo: 'pin',
        esCorreccion: false,
      },
    });

    // Dos justificaciones dentro del periodo.
    for (const dia of ['2026-09-15', '2026-09-16']) {
      await prisma.justificacionFalta.create({
        data: {
          empleadoId: empleadoFijo.id,
          fecha: new Date(`${dia}T00:00:00.000Z`),
          motivo: 'Prueba de reporte',
          usuarioJustificadorId: idUsuario,
        },
      });
    }

    // --------------------------------------------------------------- reporte
    reporte = (
      await request(app.getHttpServer())
        .get('/api/reports/comparativo')
        .query({ desde: DESDE, hasta: HASTA })
        .set(...como(admin))
        .expect(200)
    ).body as ReporteE2E;
  });

  afterAll(async () => {
    await app.close();
    await cerrarClientePrueba();
  });

  function sucursalDe(conjunto: ReporteE2E, nombre: string): ReporteSucursalE2E {
    const fila = conjunto.sucursales.find((s) => s.sucursalNombre === nombre);
    if (!fila) {
      throw new Error(`El reporte no incluye "${nombre}"`);
    }
    return fila;
  }

  function pedir(query: Record<string, string>, token?: string): request.Test {
    const peticion = request(app.getHttpServer())
      .get('/api/reports/comparativo')
      .query(query);
    return token === undefined ? peticion : peticion.set(...como(token));
  }

  // --------------------------------------------------------------- autorizacion

  describe('autorizacion', () => {
    it('sin token responde 401', async () => {
      await pedir({ desde: DESDE, hasta: HASTA }).expect(401);
    });

    it('un Gerente responde 403', async () => {
      const gerente = await crearGerente(
        app,
        admin,
        sucursales.centro,
        'Gerente Sin Reporte',
      );
      await pedir({ desde: DESDE, hasta: HASTA }, gerente.token).expect(403);
    });

    it('un Empleado responde 403', async () => {
      const usuario = await crearEmpleado(
        app,
        admin,
        sucursales.centro,
        'Empleado Sin Reporte',
      );
      const token = (
        await iniciarSesion(app, usuario.email, PASSWORD_VALIDA_PRUEBAS).expect(
          200,
        )
      ).body.accessToken as string;

      await pedir({ desde: DESDE, hasta: HASTA }, token).expect(403);
    });
  });

  // ------------------------------------------------------------------ contrato

  describe('contrato del reporte', () => {
    it('devuelve el rango pedido y las tres sucursales ordenadas por nombre', () => {
      expect(reporte.desde).toBe(DESDE);
      expect(reporte.hasta).toBe(HASTA);
      expect(Number.isNaN(Date.parse(reporte.generadoEn))).toBe(false);
      expect(reporte.sucursales.map((s) => s.sucursalNombre)).toEqual([
        'Sucursal Centro',
        'Sucursal Norte',
        'Sucursal Sur',
      ]);
    });
  });

  // -------------------------------------------------------------------- ventas

  describe('ventas', () => {
    it('Centro suma completadas por metodo, ticket promedio y anuladas', () => {
      const centro = sucursalDe(reporte, 'Sucursal Centro');

      expect(centro.ventas.porMetodoPago.efectivo).toEqual({
        total: '20.50',
        cantidad: 3,
      });
      expect(centro.ventas.porMetodoPago.tarjeta).toEqual({
        total: '99.90',
        cantidad: 1,
      });
      expect(centro.ventas.total).toBe('120.40');
      expect(centro.ventas.cantidad).toBe(4);
      expect(centro.ventas.ticketPromedio).toBe('30.10');
      expect(centro.ventas.anuladas.cantidad).toBe(1);
    });

    it('el borde de fin de rango entra a las 23:30 de Lima y se excluye a las 00:30', () => {
      // La venta de 1.00 a las 23:30 del 30 de septiembre esta incluida; la de
      // 555.00 a las 00:30 del 1 de octubre no. Si la de 555 hubiera entrado,
      // el total seria 675.40.
      expect(sucursalDe(reporte, 'Sucursal Centro').ventas.total).toBe('120.40');
    });

    it('Norte redondea el ticket promedio half-up', () => {
      const norte = sucursalDe(reporte, 'Sucursal Norte');

      expect(norte.ventas.total).toBe('7.25');
      expect(norte.ventas.cantidad).toBe(2);
      // 7.25 / 2 = 3.625 -> 3.63
      expect(norte.ventas.ticketPromedio).toBe('3.63');
    });

    it('una sucursal sin ventas devuelve ceros y ticket nulo', () => {
      const sur = sucursalDe(reporte, 'Sucursal Sur');

      expect(sur.ventas.total).toBe('0.00');
      expect(sur.ventas.cantidad).toBe(0);
      expect(sur.ventas.ticketPromedio).toBeNull();
      expect(sur.ventas.porMetodoPago.efectivo).toEqual({
        total: '0.00',
        cantidad: 0,
      });
      expect(sur.ventas.anuladas.cantidad).toBe(0);
    });
  });

  // --------------------------------------------------------------- inventario

  describe('inventario', () => {
    it('Centro cuenta entradas y ajustes con su variacion neta', () => {
      const centro = sucursalDe(reporte, 'Sucursal Centro');

      expect(centro.inventario.movimientos.total).toBe(3);
      expect(centro.inventario.movimientos.entradas).toEqual({
        cantidad: 2,
        cantidadNeta: '15.50',
      });
      expect(centro.inventario.movimientos.ajustes).toEqual({
        cantidad: 1,
        cantidadNeta: '-2.00',
      });
    });

    it('el movimiento fuera de rango no cuenta', () => {
      // La entrada de 99.00 a las 00:30 del 1 de octubre queda fuera: si
      // entrara, las entradas serian 3 y la cantidad neta 114.50.
      expect(
        sucursalDe(reporte, 'Sucursal Centro').inventario.movimientos.entradas
          .cantidad,
      ).toBe(2);
    });

    it('Norte rellena el tipo sin movimientos con cero', () => {
      const norte = sucursalDe(reporte, 'Sucursal Norte');

      expect(norte.inventario.movimientos.total).toBe(1);
      expect(norte.inventario.movimientos.entradas).toEqual({
        cantidad: 0,
        cantidadNeta: '0.00',
      });
      expect(norte.inventario.movimientos.ajustes).toEqual({
        cantidad: 1,
        cantidadNeta: '-1.25',
      });
    });
  });

  // ------------------------------------------------------------- estado actual

  describe('estado actual', () => {
    it('cuenta las alertas abiertas y las entradas sin cerrar', () => {
      const centro = sucursalDe(reporte, 'Sucursal Centro');
      expect(centro.estadoActual.insumosConAlertaAbierta).toBe(1);
      expect(centro.estadoActual.entradasAbiertas).toBe(1);

      const norte = sucursalDe(reporte, 'Sucursal Norte');
      expect(norte.estadoActual.insumosConAlertaAbierta).toBe(0);
      expect(norte.estadoActual.entradasAbiertas).toBe(0);
    });
  });

  // --------------------------------------------------------------- asistencia

  describe('asistencia', () => {
    it('Centro cuenta faltas del periodo y sus justificaciones', () => {
      const centro = sucursalDe(reporte, 'Sucursal Centro');

      // 30 dias exigidos por el turno fijo; uno con entrada efectiva y dos
      // justificados -> 27 faltas.
      expect(centro.asistencia.faltas).toBe(27);
      expect(centro.asistencia.faltasJustificadas).toBe(2);
    });

    it('las faltas del reporte coinciden con GET /attendance/absences', async () => {
      const absences = (
        await request(app.getHttpServer())
          .get('/api/attendance/absences')
          .query({ desde: DESDE, hasta: HASTA })
          .set(...como(admin))
          .expect(200)
      ).body as { total: number };

      const totalReporte = reporte.sucursales.reduce(
        (suma, sucursal) => suma + sucursal.asistencia.faltas,
        0,
      );

      expect(totalReporte).toBe(absences.total);
      expect(absences.total).toBe(27);
    });
  });

  // -------------------------------------------------------------- validaciones

  describe('validaciones', () => {
    it('rechaza hasta anterior a desde con 400', async () => {
      await pedir({ desde: HASTA, hasta: DESDE }, admin).expect(400);
    });

    it('rechaza un rango mayor de 92 dias con 400', async () => {
      await pedir({ desde: '2026-07-01', hasta: '2026-10-01' }, admin).expect(
        400,
      );
    });

    it('exige desde y hasta con 400', async () => {
      await pedir({ hasta: HASTA }, admin).expect(400);
      await pedir({ desde: DESDE }, admin).expect(400);
    });

    it('con sucursalId devuelve solo esa sucursal', async () => {
      const cuerpo = (
        await pedir(
          { desde: DESDE, hasta: HASTA, sucursalId: sucursales.norte },
          admin,
        ).expect(200)
      ).body as ReporteE2E;

      expect(cuerpo.sucursales).toHaveLength(1);
      expect(cuerpo.sucursales[0]?.sucursalId).toBe(sucursales.norte);
    });

    it('con una sucursal inexistente responde 404', async () => {
      await pedir(
        { desde: DESDE, hasta: HASTA, sucursalId: ID_INEXISTENTE },
        admin,
      ).expect(404);
    });
  });
});
