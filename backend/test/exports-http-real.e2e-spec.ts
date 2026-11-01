// Exportaciones por HTTP real (sin supertest).
//
// Supertest comparte proceso con la app y consume la respuesta como un cliente
// ideal, por eso las suites existentes no reprodujeron el cuelgue que si ve el
// navegador. Aqui se levanta la app con `listen(0)` y se pide con `fetch` de
// Node contra la direccion TCP, leyendo el cuerpo completo como haria el
// navegador. Todo tiene un plazo de 30 s: si la respuesta no termina, la prueba
// falla en vez de quedarse colgada.
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import ExcelJS from 'exceljs';
import { crearAppDePruebas } from './utils/crear-app-pruebas';
import {
  cerrarClientePrueba,
  clientePrueba,
  resetDatabase,
} from './utils/reset-database';
import { idsDeSucursales } from './utils/fixtures-pruebas';
import {
  ADMIN_PASSWORD_PRUEBAS,
  ADMIN_USUARIO_PRUEBAS,
} from './utils/constantes-pruebas';

/** Plazo de cada peticion. Un cuelgue se convierte en un fallo visible. */
const ESPERA_MAXIMA_MS = 30_000;

type EventoAuditoria = {
  accion: string;
  detalle: Record<string, unknown>;
};

type PaginaAuditoria = {
  eventos: EventoAuditoria[];
};

function plazo(): AbortSignal {
  return AbortSignal.timeout(ESPERA_MAXIMA_MS);
}

/** Arranca la app en un puerto efimero y devuelve su URL base. */
async function arrancar(
  opciones: Parameters<typeof crearAppDePruebas>[0] = {},
): Promise<{ app: INestApplication; base: string }> {
  const app = await crearAppDePruebas(opciones);
  const direccion = app.getHttpServer().address() as AddressInfo;
  return { app, base: `http://127.0.0.1:${direccion.port}` };
}

/** Login por HTTP real y token de acceso. */
async function iniciarSesionReal(base: string): Promise<string> {
  const respuesta = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombreUsuario: ADMIN_USUARIO_PRUEBAS,
      password: ADMIN_PASSWORD_PRUEBAS,
    }),
    signal: plazo(),
  });
  expect(respuesta.status).toBe(200);
  const cuerpo = (await respuesta.json()) as { accessToken: string };
  return cuerpo.accessToken;
}

async function eventosDe(
  base: string,
  token: string,
  consulta: string,
): Promise<EventoAuditoria[]> {
  const respuesta = await fetch(`${base}/api/auditoria?limit=100&${consulta}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: plazo(),
  });
  expect(respuesta.status).toBe(200);
  return ((await respuesta.json()) as PaginaAuditoria).eventos;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

describe('exports por HTTP real (sin supertest)', () => {
  let app: INestApplication;
  let base: string;
  let token: string;
  let sucursalId: string;

  beforeAll(async () => {
    ({ app, base } = await arrancar({
      limitesExport: { maxPorMinuto: 1000 },
    }));
  });

  beforeEach(async () => {
    await resetDatabase(clientePrueba());
    token = await iniciarSesionReal(base);
    sucursalId = (await idsDeSucursales()).centro;
  });

  afterAll(async () => {
    await app.close();
    await cerrarClientePrueba();
  });

  it('el CSV de un conjunto pequeno termina y llega completo', async () => {
    const inicio = Date.now();
    const respuesta = await fetch(`${base}/api/exports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conjunto: 'carta', formato: 'csv' }),
      signal: plazo(),
    });

    const texto = await respuesta.text();
    const transcurrido = Date.now() - inicio;

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('content-type')).toBe(
      'text/csv; charset=utf-8',
    );
    expect(texto.length).toBeGreaterThan(0);
    expect(transcurrido).toBeLessThan(ESPERA_MAXIMA_MS);

    // Se informa el tiempo para dejar constancia en la salida de la prueba.
    console.log(`[http-real] CSV termino en ${transcurrido} ms`);
  });

  it('el XLSX de un conjunto pequeno termina y es un libro valido', async () => {
    await clientePrueba().equipo.createMany({
      data: Array.from({ length: 50 }, (_, indice) => ({
        sucursalId,
        nombre: `Equipo HTTP ${indice}`,
        tipo: 'Equipo de prueba',
      })),
    });

    const inicio = Date.now();
    const respuesta = await fetch(`${base}/api/exports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conjunto: 'equipos', formato: 'xlsx' }),
      signal: plazo(),
    });

    const binario = await respuesta.arrayBuffer();
    const transcurrido = Date.now() - inicio;

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('content-type')).toContain(
      'spreadsheetml.sheet',
    );
    expect(binario.byteLength).toBeGreaterThan(0);

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(binario as any);
    expect(libro.getWorksheet('Equipos')).toBeDefined();
    expect(transcurrido).toBeLessThan(ESPERA_MAXIMA_MS);
    console.log(`[http-real] XLSX termino en ${transcurrido} ms`);
  });

  it('el libro completo termina y trae Metadatos', async () => {
    const inicio = Date.now();
    const respuesta = await fetch(`${base}/api/exports/full`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: plazo(),
    });

    const binario = await respuesta.arrayBuffer();
    const transcurrido = Date.now() - inicio;

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('content-disposition')).toMatch(
      /^attachment; filename="libro-completo-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(binario as any);
    expect(libro.getWorksheet('Metadatos')).toBeDefined();
    expect(transcurrido).toBeLessThan(ESPERA_MAXIMA_MS);
    console.log(`[http-real] libro completo termino en ${transcurrido} ms`);
  });

  it('el libro completo con miles de filas termina y se puede leer entero', async () => {
    await clientePrueba().equipo.createMany({
      data: Array.from({ length: 9_900 }, (_, indice) => ({
        sucursalId,
        nombre: `Equipo Grande ${indice}`,
        tipo: 'Equipo de prueba',
      })),
    });

    const inicio = Date.now();
    const respuesta = await fetch(`${base}/api/exports/full`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: plazo(),
    });

    const binario = await respuesta.arrayBuffer();
    const transcurrido = Date.now() - inicio;

    expect(respuesta.status).toBe(200);
    expect(binario.byteLength).toBeGreaterThan(0);

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(binario as any);
    const equipos = libro.getWorksheet('Equipos');
    expect(equipos).toBeDefined();
    expect(equipos!.rowCount).toBe(9_901);
    expect(transcurrido).toBeLessThan(ESPERA_MAXIMA_MS);
    console.log(`[http-real] libro grande termino en ${transcurrido} ms`);
  });

  it('libera la ranura cuando el cliente corta la descarga a mitad', async () => {
    // Un libro completo con miles de filas garantiza que la respuesta sigue
    // escribiendose cuando el cliente se desconecta tras el primer trozo.
    await clientePrueba().equipo.createMany({
      data: Array.from({ length: 9_900 }, (_, indice) => ({
        sucursalId,
        nombre: `Equipo Corte ${indice}`,
        tipo: 'Equipo de prueba',
      })),
    });

    const control = new AbortController();
    const respuesta = await fetch(`${base}/api/exports/full`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: control.signal,
    });
    expect(respuesta.status).toBe(200);

    const lector = respuesta.body!.getReader();
    const primerTrozo = await lector.read();
    expect(primerTrozo.done).toBe(false);
    control.abort();
    lector.releaseLock();

    // Se reintenta la exportacion pequena hasta que la ranura quede libre.
    // Antes del arreglo la ranura no se libera y todas las respuestas son 429.
    const inicio = Date.now();
    let estado = 0;
    let ultimoMensaje = '';
    while (Date.now() - inicio < 5_000) {
      const segunda = await fetch(`${base}/api/exports`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conjunto: 'carta', formato: 'csv' }),
        signal: plazo(),
      });
      estado = segunda.status;
      if (estado === 200) {
        await segunda.arrayBuffer();
        break;
      }
      ultimoMensaje = await segunda.text();
      await esperar(100);
    }

    expect({ estado, ultimoMensaje }).toEqual({
      estado: 200,
      ultimoMensaje: '',
    });

    const fallidas = await eventosDe(
      base,
      token,
      'entidad=exportacion&accion=exportacion_fallida',
    );
    expect(fallidas).toHaveLength(1);
    expect(String(fallidas[0]!.detalle.motivo)).toContain('cliente');
  });

  it('una exportacion que supera el tiempo maximo responde 503 y deja el evento', async () => {
    // App aparte con un plazo de generacion corto para no esperar 60 s.
    const lenta = await arrancar({
      limitesExport: { maxPorMinuto: 1000, tiempoMaximoMs: 300 },
    });

    try {
      const tokenLento = await iniciarSesionReal(lenta.base);

      // Un LOCK de otra conexion deja la lectura de "equipo" esperando: la
      // generacion no puede terminar dentro del plazo.
      let liberarLock: () => void = () => undefined;
      const lockLiberado = new Promise<void>((resolver) => {
        liberarLock = resolver;
      });
      let lockTomado: () => void = () => undefined;
      const lockAdquirido = new Promise<void>((resolver) => {
        lockTomado = resolver;
      });

      const transaccion = clientePrueba().$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(
            'LOCK TABLE equipo IN ACCESS EXCLUSIVE MODE',
          );
          lockTomado();
          await lockLiberado;
        },
        { timeout: 60_000 },
      );
      await lockAdquirido;

      try {
        const respuesta = await fetch(`${lenta.base}/api/exports`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenLento}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ conjunto: 'equipos', formato: 'csv' }),
          // Antes del arreglo esta peticion no recibe nada: se corta a los 5 s
          // para que la prueba falle rapido. El plazo real del backend es 300 ms.
          signal: AbortSignal.timeout(5_000),
        });

        expect(respuesta.status).toBe(503);
        const cuerpo = (await respuesta.json()) as { message?: string };
        expect(cuerpo.message).toContain('tiempo máximo');
        expect(cuerpo.message).toContain('0,3 s');
      } finally {
        liberarLock();
        await transaccion;
      }

      const fallidas = await eventosDe(
        lenta.base,
        tokenLento,
        'entidad=exportacion&accion=exportacion_fallida',
      );
      expect(fallidas).toHaveLength(1);
      expect(String(fallidas[0]!.detalle.motivo)).toContain('tiempo máximo');
    } finally {
      await lenta.app.close();
    }
  });
});
