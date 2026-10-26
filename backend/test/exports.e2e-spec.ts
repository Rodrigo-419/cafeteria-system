// Pruebas end-to-end de la exportacion.
//
// Cubren lo que ve el usuario por HTTP: autenticacion, permisos, alcance por
// sucursal, contenido del libro completo, auditoria de exito y de fallo, y que
// ningun secreto acabe dentro de un archivo.
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { crearAppDePruebas } from './utils/crear-app-pruebas';
import {
  cerrarClientePrueba,
  clientePrueba,
  resetDatabase,
} from './utils/reset-database';
import { como, iniciarSesion } from './utils/http-pruebas';
import {
  crearEmpleado,
  crearGerente,
  idsDeSucursales,
  type Sucursales,
} from './utils/fixtures-pruebas';
import {
  ADMIN_PASSWORD_PRUEBAS,
  ADMIN_USUARIO_PRUEBAS,
  PASSWORD_VALIDA_PRUEBAS,
} from './utils/constantes-pruebas';
import { textoFechaHoraLima } from '../src/modules/exports/domain/excel';

type EventoAuditoria = {
  id: string;
  entidad: string;
  accion: string;
  actor: { id: string; nombre: string; nombreUsuario: string };
  detalle: any;
  fecha: string;
};

type PaginaAuditoria = {
  eventos: EventoAuditoria[];
  total: number;
};

type Descarga = {
  status: number;
  buffer: Buffer;
  headers: Record<string, string>;
};

/** Parser binario: supertest no interpreta xlsx ni csv por su cuenta. */
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

/** Fecha local de hoy (America/Lima) en formato YYYY-MM-DD. */
function hoyLocal(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
  }).format(new Date());
}

/** Valor de celda como texto, sin depender del tipo que devuelva exceljs. */
function valorTexto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') {
    return String(valor);
  }
  if (valor instanceof Date) return valor.toISOString();
  return JSON.stringify(valor);
}

/** Filas de una hoja como texto (incluye la cabecera). */
function filasDeHoja(hoja: ExcelJS.Worksheet): string[][] {
  const filas: string[][] = [];

  hoja.eachRow({ includeEmpty: false }, (fila) => {
    const valores: string[] = [];
    fila.eachCell({ includeEmpty: true }, (celda) => {
      valores.push(valorTexto(celda.value));
    });
    filas.push(valores);
  });

  return filas;
}

/** Todas las celdas del libro, con el nombre de su hoja. */
function celdasDelLibro(
  libro: ExcelJS.Workbook,
): Array<{ hoja: string; valor: string }> {
  const celdas: Array<{ hoja: string; valor: string }> = [];

  libro.eachSheet((hoja) => {
    hoja.eachRow({ includeEmpty: false }, (fila) => {
      fila.eachCell({ includeEmpty: false }, (celda) => {
        celdas.push({ hoja: hoja.name, valor: valorTexto(celda.value) });
      });
    });
  });

  return celdas;
}

describe('exports (e2e)', () => {
  let app: INestApplication;
  let admin: string;
  let adminId: string;
  let sucursales: Sucursales;

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
  });

  afterAll(async () => {
    await app.close();
    await cerrarClientePrueba();
  });

  /** POST binario (xlsx/csv) sin que supertest intente parsearlo como JSON. */
  async function descargar(
    ruta: string,
    token: string | null,
    body?: unknown,
  ): Promise<Descarga> {
    let peticion = request(app.getHttpServer()).post(ruta);

    if (token !== null) {
      peticion = peticion.set(...como(token));
    }
    if (body !== undefined) {
      peticion = peticion.send(body as object);
    }

    const respuesta = await peticion.buffer(true).parse(parserBinario);

    return {
      status: respuesta.status,
      buffer: respuesta.body as Buffer,
      headers: respuesta.headers as Record<string, string>,
    };
  }

  async function leerLibro(buffer: Buffer): Promise<ExcelJS.Workbook> {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buffer as any);
    return libro;
  }

  async function eventos(
    token: string,
    query: string,
  ): Promise<EventoAuditoria[]> {
    const respuesta = await request(app.getHttpServer())
      .get(`/api/auditoria?limit=100&${query}`)
      .set(...como(token))
      .expect(200);

    return (respuesta.body as PaginaAuditoria).eventos;
  }

  // ------------------------------------------------------------ acceso

  it('sin token responde 401 en las dos rutas de exportación', async () => {
    await request(app.getHttpServer())
      .post('/api/exports')
      .send({ conjunto: 'ventas', formato: 'xlsx' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/exports/full')
      .expect(401);
  });

  it('un Empleado sin usuarios.crear_editar recibe 403 en las dos rutas', async () => {
    const empleado = await crearEmpleado(
      app,
      admin,
      sucursales.centro,
      'Empleado Sin Exportar',
    );
    const sesion = await iniciarSesion(
      app,
      empleado.nombreUsuario,
      PASSWORD_VALIDA_PRUEBAS,
    ).expect(200);
    const token = sesion.body.accessToken as string;

    await request(app.getHttpServer())
      .post('/api/exports')
      .set(...como(token))
      .send({ conjunto: 'usuarios', formato: 'csv' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/exports/full')
      .set(...como(token))
      .expect(403);
  });

  it('un Gerente sin el permiso de lectura del conjunto recibe 403', async () => {
    const gerente = await crearGerente(
      app,
      admin,
      sucursales.centro,
      'Gerente Sin Reporte',
    );

    // `reporte` exige reportes.comparativos.ver, que es exclusivo del Admin.
    await request(app.getHttpServer())
      .post('/api/exports')
      .set(...como(gerente.token))
      .send({
        conjunto: 'reporte',
        formato: 'csv',
        filtros: { desde: hoyLocal(), hasta: hoyLocal() },
      })
      .expect(403);
  });

  // ------------------------------------------------------- libro completo

  it('el libro completo omite los conjuntos sin permiso y lo indica en Metadatos', async () => {
    const gerente = await crearGerente(
      app,
      admin,
      sucursales.centro,
      'Gerente Libro Completo',
    );

    const descarga = await descargar('/api/exports/full', gerente.token);
    expect(descarga.status).toBe(200);
    expect(descarga.headers['content-type']).toContain(
      'spreadsheetml.sheet',
    );
    expect(descarga.headers['content-disposition']).toMatch(
      /^attachment; filename="libro-completo-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );

    const libro = await leerLibro(descarga.buffer);
    const metadatos = libro.getWorksheet('Metadatos');
    expect(metadatos).toBeDefined();

    const filas = filasDeHoja(metadatos!);
    const porCampo = new Map(
      filas.slice(1).map((fila) => [fila[0], fila[1] ?? '']),
    );

    expect(porCampo.get('Conjuntos omitidos')).toBe('Reporte comparativo');
    expect(porCampo.get('Conjuntos incluidos')).toContain('Ventas');
    expect(porCampo.get('Conjuntos incluidos')).toContain('Usuarios');
    expect(porCampo.get('Conjuntos incluidos')).not.toContain(
      'Reporte comparativo',
    );
    expect(porCampo.get('Usuario')).toBe(gerente.usuario.nombreUsuario);
    expect(porCampo.get('Fecha y hora')).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
    );
    expect(porCampo.get('Filtros')).toContain('ninguno');
    expect(porCampo.get('Filas: Usuarios')).toBe('0');
    expect(porCampo.get('Filas totales')).toBe('1');

    // La hoja omitida no existe y Metadatos no explica el motivo.
    expect(libro.getWorksheet('Reporte comparativo')).toBeUndefined();
    const textoMetadatos = celdasDelLibro(libro)
      .filter((celda) => celda.hoja === 'Metadatos')
      .map((celda) => celda.valor.toLowerCase())
      .join(' ');
    expect(textoMetadatos).not.toContain('permiso');
  });

  // ------------------------------------------------------------- alcance

  it('un Gerente solo exporta los usuarios de su sucursal y el Admin los de todas', async () => {
    const gerenteCentro = await crearGerente(
      app,
      admin,
      sucursales.centro,
      'Gerente Alcance Export',
    );
    await crearEmpleado(
      app,
      admin,
      sucursales.centro,
      'Empleado Centro Export',
    );
    await crearEmpleado(
      app,
      admin,
      sucursales.norte,
      'Empleado Norte Export',
    );

    const comoGerente = await descargar('/api/exports', gerenteCentro.token, {
      conjunto: 'usuarios',
      formato: 'csv',
    });
    expect(comoGerente.status).toBe(200);

    const csvGerente = comoGerente.buffer.toString('utf8');
    expect(csvGerente).toContain('Empleado Centro Export');
    expect(csvGerente).not.toContain('Empleado Norte Export');
    expect(csvGerente).not.toContain('Administrador');

    const comoAdmin = await descargar('/api/exports', admin, {
      conjunto: 'usuarios',
      formato: 'csv',
    });
    expect(comoAdmin.status).toBe(200);

    const csvAdmin = comoAdmin.buffer.toString('utf8');
    expect(csvAdmin).toContain('Empleado Centro Export');
    expect(csvAdmin).toContain('Empleado Norte Export');
    expect(csvAdmin).toContain('Administrador');
  });

  // ----------------------------------------------------------- auditoria

  it('audita el éxito con actor, conjuntos, formato, filtros y filas, antes de terminar la respuesta y sin datos', async () => {
    const gerente = await crearGerente(
      app,
      admin,
      sucursales.centro,
      'Gerente Auditado Export',
    );
    const empleado = await crearEmpleado(
      app,
      admin,
      sucursales.centro,
      'Fila Secreta Export',
    );

    const antes = new Date();
    const descarga = await descargar('/api/exports', gerente.token, {
      conjunto: 'usuarios',
      formato: 'csv',
    });
    const despues = new Date();

    expect(descarga.status).toBe(200);

    const encontrados = await eventos(
      admin,
      `entidad=exportacion&accion=exportacion_generada&actorId=${gerente.usuario.id}`,
    );
    expect(encontrados).toHaveLength(1);

    const evento = encontrados[0]!;
    expect(evento.actor.id).toBe(gerente.usuario.id);
    expect(evento.detalle.conjuntos).toEqual(['usuarios']);
    expect(evento.detalle.formato).toBe('csv');
    expect(evento.detalle.filtros).toEqual({});
    // El Gerente solo ve Empleados de su sucursal: su propio usuario no cuenta.
    expect(evento.detalle.filasPorConjunto).toEqual({ usuarios: 1 });

    const fechaEvento = new Date(evento.fecha).getTime();
    expect(fechaEvento).toBeGreaterThanOrEqual(antes.getTime() - 5);
    expect(fechaEvento).toBeLessThanOrEqual(despues.getTime());

    expect(Object.keys(evento.detalle).sort()).toEqual([
      'conjuntos',
      'filasPorConjunto',
      'filtros',
      'formato',
    ]);
    expect(JSON.stringify(evento.detalle)).not.toContain(
      'Fila Secreta Export',
    );
    expect(JSON.stringify(evento.detalle)).not.toContain(empleado.id);
  });

  it('registra exportacion_fallida cuando la generación falla a mitad', async () => {
    // 20 001 ventas: una mas que el tope por conjunto. El fallo ocurre tras
    // autenticar y validar, cuando la generacion ya empezo a leer datos.
    await clientePrueba().$executeRawUnsafe(
      `INSERT INTO venta (id, sucursal_id, usuario_id, metodo_pago, estado, created_at, updated_at)
       SELECT md5(random()::text || clock_timestamp()::text)::uuid,
              $1::uuid,
              $2::uuid,
              'efectivo'::venta_metodo_pago,
              'completada'::venta_estado,
              NOW(),
              NOW()
       FROM generate_series(1, 20001)`,
      sucursales.centro,
      adminId,
    );

    const respuesta = await request(app.getHttpServer())
      .post('/api/exports')
      .set(...como(admin))
      .send({
        conjunto: 'ventas',
        formato: 'csv',
        filtros: { desde: hoyLocal(), hasta: hoyLocal() },
      })
      .expect(413);

    expect(JSON.stringify(respuesta.body)).toContain('20000');
    expect(JSON.stringify(respuesta.body)).toContain('20001');

    const encontrados = await eventos(
      admin,
      `entidad=exportacion&accion=exportacion_fallida&actorId=${adminId}`,
    );
    expect(encontrados).toHaveLength(1);
    expect(encontrados[0]!.detalle).toMatchObject({
      conjuntos: ['ventas'],
      formato: 'csv',
      filtros: { desde: hoyLocal(), hasta: hoyLocal() },
      filasPorConjunto: { ventas: 20_001 },
      motivo: expect.stringContaining('20000'),
    });
  });

  // --------------------------------------------------------------- formatos

  it('el CSV usa BOM, CRLF, comillas escapadas y prefijo anti-fórmula', async () => {
    const nombres = ['=SUMA(1,2)', '+1', '-1', '@riesgo', '\tTab', '\rCR'];
    await clientePrueba().equipo.createMany({
      data: [
        ...nombres.map((nombre) => ({
          sucursalId: sucursales.centro,
          nombre,
          tipo: 'Equipo de prueba',
          estado: 'funcionando' as const,
        })),
        {
          sucursalId: sucursales.centro,
          nombre: 'Equipo "A", especial',
          tipo: 'Equipo de prueba',
          estado: 'funcionando' as const,
        },
      ],
    });

    const descarga = await descargar('/api/exports', admin, {
      conjunto: 'equipos',
      formato: 'csv',
    });

    expect(descarga.status).toBe(200);
    expect(descarga.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(descarga.headers['content-disposition']).toBe(
      `attachment; filename="equipos-${hoyLocal()}.csv"`,
    );
    expect(descarga.buffer.subarray(0, 3)).toEqual(
      Buffer.from([0xef, 0xbb, 0xbf]),
    );

    const texto = descarga.buffer.toString('utf8');
    expect(texto.endsWith('\r\n')).toBe(true);
    // No hay saltos de linea sueltos: todos los separadores de fila son CRLF.
    expect(texto.replace(/\r\n/g, '')).not.toContain('\n');

    for (const nombre of nombres) {
      expect(texto).toContain(`'${nombre}`);
    }
    expect(texto).toContain('"Equipo ""A"", especial"');

    const filas = texto
      .replace(/^\uFEFF/, '')
      .split('\r\n')
      .filter((fila) => fila.length > 0);
    expect(filas).toHaveLength(1 + nombres.length + 1);
  });

  it('XLSX escribe importes numéricos, fechas de Lima como texto y Metadatos con filas por hoja', async () => {
    const prisma = clientePrueba();
    const creadaEn = new Date();
    const categoria = await prisma.categoriaProducto.create({
      data: { nombre: 'Categoría Formato' },
    });
    const variante = await prisma.variante.findFirstOrThrow({
      where: { nombre: 'Única' },
    });
    const producto = await prisma.producto.create({
      data: { nombre: 'Producto Formato', categoriaId: categoria.id },
    });
    const oferta = await prisma.productoSucursalVariante.create({
      data: {
        productoId: producto.id,
        sucursalId: sucursales.centro,
        varianteId: variante.id,
        precio: '12.50',
        estado: 'activo',
      },
    });
    await prisma.venta.create({
      data: {
        sucursalId: sucursales.centro,
        usuarioId: adminId,
        metodoPago: 'efectivo',
        estado: 'completada',
        createdAt: creadaEn,
        updatedAt: creadaEn,
        detalles: {
          create: {
            productoSucursalVarianteId: oferta.id,
            cantidad: 2,
            precioUnitarioSnapshot: '12.50',
            subtotal: '25.00',
          },
        },
      },
    });

    const descarga = await descargar('/api/exports/full', admin);
    expect(descarga.status).toBe(200);
    expect(descarga.headers['content-type']).toContain(
      'spreadsheetml.sheet',
    );
    expect(descarga.headers['content-disposition']).toMatch(
      /^attachment; filename="libro-completo-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );

    const libro = await leerLibro(descarga.buffer);
    const ventas = libro.getWorksheet('Ventas');
    expect(ventas).toBeDefined();

    const cabecera = (ventas!.getRow(1).values as ExcelJS.CellValue[])
      .slice(1)
      .map((valor) => valorTexto(valor));
    const columna = (nombre: string): number => {
      const indice = cabecera.indexOf(nombre);
      expect(indice).toBeGreaterThanOrEqual(0);
      return indice + 1;
    };

    const fila = ventas!.getRow(2);
    const celdaTotal = fila.getCell(columna('Total'));
    expect(typeof celdaTotal.value).toBe('number');
    expect(celdaTotal.value).toBe(25);
    expect(celdaTotal.numFmt).toBe('0.00');

    const celdaFecha = fila.getCell(columna('Fecha'));
    expect(typeof celdaFecha.value).toBe('string');
    expect(celdaFecha.value).toBe(textoFechaHoraLima(creadaEn));

    expect(typeof fila.getCell(columna('Sucursal')).value).toBe('string');

    const metadatos = libro.getWorksheet('Metadatos');
    expect(metadatos).toBeDefined();
    const filasMetadatos = filasDeHoja(metadatos!);
    const porCampo = new Map(
      filasMetadatos
        .slice(1)
        .map((filaMeta) => [filaMeta[0] ?? '', filaMeta[1] ?? '']),
    );

    expect(porCampo.get('Usuario')).toBe(ADMIN_USUARIO_PRUEBAS);
    expect(porCampo.get('Fecha y hora')).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
    );
    expect(porCampo.get('Filtros')).toBe('ninguno (libro completo)');

    const hojasDatos = libro.worksheets.filter(
      (hoja) => hoja.name !== 'Metadatos',
    );
    let totalFilas = 0;
    for (const hoja of hojasDatos) {
      const filas = filasDeHoja(hoja);
      const datos = Math.max(0, filas.length - 1);
      totalFilas += datos;
      expect(porCampo.get(`Filas: ${hoja.name}`)).toBe(String(datos));
    }
    expect(porCampo.get('Filas totales')).toBe(String(totalFilas));
  });

  // -------------------------------------------------------------- secretos

  it('ningún conjunto exporta contraseñas, hashes ni PIN', async () => {
    const empleado = await crearEmpleado(
      app,
      admin,
      sucursales.centro,
      'Empleado Con Secreto',
    );

    const hashFalso = '$2b$12$hashquenodebesalirenexportacion';
    const pinFalso = '987654';

    await clientePrueba().empleado.create({
      data: {
        usuarioId: empleado.id,
        cargo: 'Cajero',
        sucursalId: sucursales.centro,
        fechaContratacion: new Date('2026-01-01T00:00:00.000Z'),
        pinHash: hashFalso,
      },
    });

    const descarga = await descargar('/api/exports/full', admin);
    expect(descarga.status).toBe(200);

    const libro = await leerLibro(descarga.buffer);
    const celdas = celdasDelLibro(libro);

    // El Admin tiene los 14 conjuntos: 14 hojas de datos + Metadatos.
    expect(libro.worksheets).toHaveLength(15);

    for (const celda of celdas) {
      expect(celda.valor).not.toContain(hashFalso);
      expect(celda.valor).not.toContain(pinFalso);
      expect(celda.valor).not.toMatch(/\$2[aby]\$\d{2}\$/);
      expect(celda.valor.toLowerCase()).not.toContain('passwordhash');
      expect(celda.valor.toLowerCase()).not.toContain('pinhash');
    }

    const cabeceras = libro.worksheets.flatMap((hoja) => {
      const filas = filasDeHoja(hoja);
      return filas.length > 0 ? filas[0]! : [];
    });

    for (const cabecera of cabeceras) {
      expect(cabecera).not.toMatch(/password|contraseña|hash|pin|token/i);
    }

    // Cada conjunto incluye al menos su fila de cabecera.
    for (const hoja of libro.worksheets) {
      const filas = filasDeHoja(hoja);
      expect(filas.length).toBeGreaterThan(0);
      expect(filas[0]!.length).toBeGreaterThan(0);
    }
  });
});
