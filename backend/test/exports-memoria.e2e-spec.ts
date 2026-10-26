// Prueba de memoria de la exportacion con muchas filas.
//
// El tope se inyecta desde la app de pruebas: no se depende del tope de
// produccion ni se crean 20 001 ventas para medir memoria. Se exportan 10 000
// eventos de auditoria y se muestrea el heap mientras el CSV se genera.
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
} from './utils/constantes-pruebas';

jest.setTimeout(180_000);

const FILAS = 10_000;
const MB = 1024 * 1024;

type Descarga = {
  status: number;
  buffer: Buffer;
  headers: Record<string, string>;
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

describe('exports: memoria con tope inyectado (e2e)', () => {
  let app: INestApplication;
  let admin: string;

  beforeAll(async () => {
    app = await crearAppDePruebas({
      limitesExport: {
        maxFilasPorConjunto: FILAS,
        maxFilasTotales: FILAS,
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
    const adminId = sesion.body.user.id as string;

    await clientePrueba().$executeRawUnsafe(
      `INSERT INTO auditoria (id, entidad, entidad_id, accion, actor_id, detalle, created_at)
       SELECT md5('a' || g)::uuid,
              'empleado'::auditoria_entidad,
              md5('e' || g)::uuid,
              'empleado_creado'::auditoria_accion,
              $1::uuid,
              '{}'::jsonb,
              NOW() - (g || ' seconds')::interval
       FROM generate_series(1, ${FILAS}) AS g`,
      adminId,
    );
  });

  afterAll(async () => {
    await app.close();
    await cerrarClientePrueba();
  });

  async function descargar(): Promise<Descarga> {
    const respuesta = await request(app.getHttpServer())
      .post('/api/exports')
      .set(...como(admin))
      .send({ conjunto: 'auditoria', formato: 'csv', filtros: {} })
      .buffer(true)
      .parse(parserBinario);

    return {
      status: respuesta.status,
      buffer: respuesta.body as Buffer,
      headers: respuesta.headers as Record<string, string>,
    };
  }

  it(`exporta ${FILAS} filas sin superar un pico de heap holgado`, async () => {
    const antes = process.memoryUsage().heapUsed;
    let pico = antes;

    const muestreo = setInterval(() => {
      pico = Math.max(pico, process.memoryUsage().heapUsed);
    }, 1);

    let descarga: Descarga;
    try {
      descarga = await descargar();
    } finally {
      clearInterval(muestreo);
    }

    const delta = pico - antes;
    // Se reporta el pico real para que quede en la salida de la prueba.
    console.log(
      `[memoria] filas=${FILAS} heapAntes=${(antes / MB).toFixed(1)} MB ` +
        `pico=${(pico / MB).toFixed(1)} MB delta=${(delta / MB).toFixed(1)} MB`,
    );

    expect(descarga.status).toBe(200);
    expect(descarga.headers['content-type']).toBe('text/csv; charset=utf-8');

    const lineas = descarga.buffer
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .trimEnd()
      .split('\r\n');
    expect(lineas).toHaveLength(FILAS + 1);

    // Umbral holgado: el CSV completo se construye en memoria, pero 10 000
    // filas no deben acercarse a cientos de MB.
    expect(pico).toBeLessThan(768 * MB);
    expect(delta).toBeLessThan(256 * MB);
  });
});
