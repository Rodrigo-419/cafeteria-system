// Prueba de memoria de la exportacion con muchas filas.
//
// Mide heap y RSS antes del pico con:
//   * 10 000 ventas (defaults del codigo: 10 000 / 20 000; Render usa
//     3000 / 6000 en render.yaml);
//   * un libro completo con 10 000 ventas y 9 000 eventos de auditoria;
//   * 20 000 ventas con topes inyectados de 20 000 / 20 000.
//
// El caso de 20 000 ventas necesita inyectar el tope porque el default corta en
// 10 000 por conjunto. Antes de inyectarlo se comprueba que el tope real
// responde 413. Las filas se insertan por SQL para no convertir la prueba en
// 20 000 llamadas HTTP.
//
// El heap de partida depende de las suites anteriores en el mismo proceso de
// Jest. Por eso se aserta solo el delta de cada escenario y el RSS se registra
// como informacion, sin techos absolutos.
import type { INestApplication } from '@nestjs/common';
import ExcelJS from 'exceljs';
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
} from './utils/constantes-pruebas';

jest.setTimeout(180_000);

const VENTAS_INICIALES = 10_000;
const VENTAS_TOTALES = 20_000;
const AUDITORIAS = 9_000;
const MB = 1024 * 1024;
// El mayor delta observado fue ~87 MB; 256 MB detecta un crecimiento desbocado
// sin depender de la memoria que hayan dejado las suites anteriores.
const MAX_DELTA_HEAP = 256 * MB;

type Descarga = {
  status: number;
  buffer: Buffer;
  headers: Record<string, string>;
};

type MuestraMemoria = {
  heapAntes: number;
  rssAntes: number;
  heapPico: number;
  rssPico: number;
  heapDespues: number;
  rssDespues: number;
};

function parserBinario(
  respuesta: any,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const partes: Buffer[] = [];
  respuesta.on('data', (parte: Buffer | string) => {
    partes.push(Buffer.isBuffer(parte) ? parte : Buffer.from(parte));
  });
  respuesta.on('end', () => callback(null, Buffer.concat(partes)));
  respuesta.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
}

/** Dia local America/Lima, desplazado en dias. */
function fechaLocal(desplazamientoDias = 0): string {
  const fecha = new Date(Date.now() + desplazamientoDias * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
  }).format(fecha);
}

function mb(bytes: number): string {
  return (bytes / MB).toFixed(1);
}

describe('exports: memoria con ventas y libro completo (e2e)', () => {
  let app: INestApplication;
  let admin: string;
  let adminId: string;
  let sucursalId: string;
  let ofertaId: string;

  beforeAll(async () => {
    app = await crearAppDePruebas({
      limitesExport: {
        maxFilasPorConjunto: 10_000,
        maxFilasTotales: 20_000,
        maxPorMinuto: 1_000,
      },
    });
    await resetDatabase(clientePrueba());

    const sesion = await iniciarSesion(
      app,
      ADMIN_USUARIO_PRUEBAS,
      ADMIN_PASSWORD_PRUEBAS,
    ).expect(200);
    admin = sesion.body.accessToken as string;
    adminId = sesion.body.user.id as string;

    const prisma = clientePrueba();
    const sucursal = await prisma.sucursal.findFirstOrThrow({
      orderBy: { nombre: 'asc' },
    });
    sucursalId = sucursal.id;

    const categoria = await prisma.categoriaProducto.create({
      data: { nombre: `Categoria Memoria ${Date.now()}` },
    });
    const variante = await prisma.variante.findFirstOrThrow({
      where: { nombre: 'Única' },
    });
    const producto = await prisma.producto.create({
      data: { nombre: 'Producto Memoria', categoriaId: categoria.id },
    });
    const oferta = await prisma.productoSucursalVariante.create({
      data: {
        productoId: producto.id,
        sucursalId,
        varianteId: variante.id,
        precio: '12.50',
        estado: 'activo',
      },
    });
    ofertaId = oferta.id;

    await sembrarVentas(1, VENTAS_INICIALES);
    await sembrarAuditorias(AUDITORIAS);
  });

  afterAll(async () => {
    await app.close();
    await cerrarClientePrueba();
  });

  async function sembrarVentas(desde: number, hasta: number): Promise<void> {
    const prisma = clientePrueba();
    await prisma.$executeRawUnsafe(
      `INSERT INTO venta
         (id, sucursal_id, usuario_id, metodo_pago, estado, created_at, updated_at)
       SELECT md5('memoria-venta-' || g)::uuid,
              $1::uuid,
              $2::uuid,
              'efectivo'::venta_metodo_pago,
              'completada'::venta_estado,
              NOW(),
              NOW()
       FROM generate_series($3::int, $4::int) AS g
       ON CONFLICT (id) DO NOTHING`,
      sucursalId,
      adminId,
      desde,
      hasta,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO venta_detalle
         (id, venta_id, producto_sucursal_variante_id, cantidad,
          precio_unitario_snapshot, subtotal, created_at)
       SELECT md5('memoria-detalle-' || g)::uuid,
              md5('memoria-venta-' || g)::uuid,
              $1::uuid,
              1,
              12.50,
              12.50,
              NOW()
       FROM generate_series($2::int, $3::int) AS g
       ON CONFLICT (id) DO NOTHING`,
      ofertaId,
      desde,
      hasta,
    );
  }

  async function sembrarAuditorias(cantidad: number): Promise<void> {
    await clientePrueba().$executeRawUnsafe(
      `INSERT INTO auditoria
         (id, entidad, entidad_id, accion, actor_id, detalle, created_at)
       SELECT md5('memoria-auditoria-' || g)::uuid,
              'empleado'::auditoria_entidad,
              md5('memoria-empleado-' || g)::uuid,
              'empleado_creado'::auditoria_accion,
              $1::uuid,
              '{}'::jsonb,
              NOW() - (g || ' seconds')::interval
       FROM generate_series(1, $2::int) AS g`,
      adminId,
      cantidad,
    );
  }

  async function descargar(
    cuerpo: Record<string, unknown>,
    ruta = '/api/exports',
  ): Promise<Descarga> {
    const respuesta = await request(app.getHttpServer())
      .post(ruta)
      .set(...como(admin))
      .send(cuerpo)
      .buffer(true)
      .parse(parserBinario);

    return {
      status: respuesta.status,
      buffer: respuesta.body as Buffer,
      headers: respuesta.headers as Record<string, string>,
    };
  }

  async function medir(
    etiqueta: string,
    ejecutar: () => Promise<Descarga>,
  ): Promise<{ descarga: Descarga; memoria: MuestraMemoria }> {
    const antes = process.memoryUsage();
    let heapPico = antes.heapUsed;
    let rssPico = antes.rss;

    const muestreo = setInterval(() => {
      const actual = process.memoryUsage();
      heapPico = Math.max(heapPico, actual.heapUsed);
      rssPico = Math.max(rssPico, actual.rss);
    }, 1);

    let descarga: Descarga;
    try {
      descarga = await ejecutar();
    } finally {
      clearInterval(muestreo);
    }

    const despues = process.memoryUsage();
    const memoria: MuestraMemoria = {
      heapAntes: antes.heapUsed,
      rssAntes: antes.rss,
      heapPico,
      rssPico,
      heapDespues: despues.heapUsed,
      rssDespues: despues.rss,
    };

    // Se reporta el pico real para que quede en la salida de la prueba.
    console.log(
      `[memoria] ${etiqueta} ` +
        `heapAntes=${mb(memoria.heapAntes)} MB ` +
        `heapPico=${mb(memoria.heapPico)} MB ` +
        `deltaHeap=${mb(memoria.heapPico - memoria.heapAntes)} MB ` +
        `rssAntes=${mb(memoria.rssAntes)} MB ` +
        `rssPico=${mb(memoria.rssPico)} MB ` +
        `deltaRss=${mb(memoria.rssPico - memoria.rssAntes)} MB ` +
        `heapDespues=${mb(memoria.heapDespues)} MB ` +
        `rssDespues=${mb(memoria.rssDespues)} MB`,
    );

    return { descarga, memoria };
  }

  function lineasCsv(descarga: Descarga): string[] {
    return descarga.buffer
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .trimEnd()
      .split('\r\n');
  }

  it('mide 10 000 ventas con los topes por defecto del codigo', async () => {
    const { descarga, memoria } = await medir('ventas=10000', () =>
      descargar({
        conjunto: 'ventas',
        formato: 'csv',
        filtros: { desde: fechaLocal(-1), hasta: fechaLocal() },
      }),
    );

    expect(descarga.status).toBe(200);
    expect(descarga.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(lineasCsv(descarga)).toHaveLength(VENTAS_INICIALES + 1);

    // El proceso de Jest incluye Nest, Prisma, Supertest y el propio Jest: el
    // heap de partida depende de las suites anteriores. Por eso solo se aserta
    // el delta del propio escenario; el RSS se registra como informacion.
    expect(memoria.heapPico - memoria.heapAntes).toBeLessThan(MAX_DELTA_HEAP);
  });

  it('mide el libro completo con ventas y auditoria', async () => {
    const { descarga, memoria } = await medir(
      'libro-completo=10000-ventas+9000-auditorias',
      () => descargar({}, '/api/exports/full'),
    );

    expect(descarga.status).toBe(200);
    expect(descarga.headers['content-type']).toContain(
      'spreadsheetml.sheet',
    );

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(descarga.buffer as any);

    // El Admin tiene los 14 conjuntos: 14 hojas de datos + Metadatos.
    expect(libro.worksheets).toHaveLength(15);
    expect(libro.getWorksheet('Ventas')!.rowCount).toBe(
      VENTAS_INICIALES + 1,
    );
    expect(libro.getWorksheet('Auditoría')!.rowCount).toBeGreaterThanOrEqual(
      AUDITORIAS + 1,
    );

    expect(memoria.heapPico - memoria.heapAntes).toBeLessThan(MAX_DELTA_HEAP);
  });

  it('responde 413 con 20 000 ventas antes de inyectar el tope', async () => {
    await sembrarVentas(VENTAS_INICIALES + 1, VENTAS_TOTALES);

    const descarga = await descargar({
      conjunto: 'ventas',
      formato: 'csv',
      filtros: { desde: fechaLocal(-1), hasta: fechaLocal() },
    });

    expect(descarga.status).toBe(413);
    const cuerpo = descarga.buffer.toString('utf8');
    expect(cuerpo).toContain('10000');
    expect(cuerpo).toContain('20000');
    expect(cuerpo).toContain('Acota el rango de fechas.');
  });

  it('mide 20 000 ventas con un tope inyectado de 20 000', async () => {
    // Si la prueba se ejecuta sola (por ejemplo con `-t`), la tanda anterior no
    // se ejecuto: se completa hasta 20 000 sin duplicar ids.
    await sembrarVentas(1, VENTAS_TOTALES);

    // Se cierra la app con los defaults del codigo para no sumar su memoria a
    // la medicion. El token sigue siendo valido: la base y el secreto no cambian.
    await app.close();
    app = await crearAppDePruebas({
      limitesExport: {
        maxFilasPorConjunto: 20_000,
        maxFilasTotales: 20_000,
        maxPorMinuto: 1_000,
      },
    });

    const { descarga, memoria } = await medir('ventas=20000', () =>
      descargar({
        conjunto: 'ventas',
        formato: 'csv',
        filtros: { desde: fechaLocal(-1), hasta: fechaLocal() },
      }),
    );

    expect(descarga.status).toBe(200);
    expect(lineasCsv(descarga)).toHaveLength(VENTAS_TOTALES + 1);

    expect(memoria.heapPico - memoria.heapAntes).toBeLessThan(MAX_DELTA_HEAP);
  });
});
