// Paridad entre el CSV exportado y los listados reales de la API.
//
// Para cada conjunto se recorren TODAS las páginas del endpoint equivalente y
// se transforma la respuesta con las mismas etiquetas/formatos públicos. Después
// se compara fila y columna con el CSV. Los conjuntos por sucursal (carta, stock
// y movimientos) no tienen un listado global: se recorren las sucursales
// visibles y se comparan como multiconjunto, indicándolo en cada caso.
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
import { CONJUNTOS } from '../src/modules/exports/domain/limites';
import {
  ETIQUETA_ACCION_AUDITORIA,
  ETIQUETA_ENTIDAD_AUDITORIA,
  ETIQUETA_ESTADO_ASIGNACION,
  ETIQUETA_ESTADO_EMPLEADO,
  ETIQUETA_ESTADO_EQUIPO,
  ETIQUETA_ESTADO_STOCK,
  ETIQUETA_ESTADO_USUARIO,
  ETIQUETA_ESTADO_VENTA,
  ETIQUETA_METODO_PAGO,
  ETIQUETA_MOVIMIENTO,
  ETIQUETA_OFERTA,
  ETIQUETA_PRESENTACION_INSUMO,
  ETIQUETA_ROL,
  ETIQUETA_TIPO_MARCAJE,
  ETIQUETA_TIPO_TURNO,
  etiquetaDe,
} from '../src/modules/exports/domain/etiquetas';
import { textoFechaHoraLima } from '../src/modules/exports/domain/excel';
import {
  estadoAsignacion,
  formatearDias,
  formatearHorario,
} from '../src/modules/exports/domain/formato';
import { horaADate } from '../src/modules/shifts/domain/horas';
import { fechaLocalDe } from '../src/modules/sales/domain/rules/fechas';

jest.setTimeout(180_000);

type Descarga = {
  status: number;
  buffer: Buffer;
  headers: Record<string, string>;
};

type FilaCsv = Record<string, string>;

const ETIQUETA_ASIGNACION_CALCULADA: Record<string, string> = {
  programada: 'Programada',
  vigente: 'Vigente',
  finalizada: 'Finalizada',
};

function parserBinario(
  respuesta: any,
  callback: (error: Error | null, cuerpo: Buffer) => void,
): void {
  const partes: Buffer[] = [];
  respuesta.on('data', (parte: Buffer | string) => {
    partes.push(Buffer.isBuffer(parte) ? parte : Buffer.from(parte));
  });
  respuesta.on('end', () => callback(null, Buffer.concat(partes)));
  respuesta.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
}

/** Parser CSV suficiente para los valores que produce el exportador. */
function parsearCsv(texto: string): string[][] {
  let contenido = texto;
  if (contenido.startsWith('\uFEFF')) {
    contenido = contenido.slice(1);
  }

  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let enComillas = false;

  for (let indice = 0; indice < contenido.length; indice += 1) {
    const caracter = contenido[indice]!;

    if (enComillas) {
      if (caracter === '"') {
        if (contenido[indice + 1] === '"') {
          campo += '"';
          indice += 1;
        } else {
          enComillas = false;
        }
      } else {
        campo += caracter;
      }
      continue;
    }

    if (caracter === '"') {
      enComillas = true;
    } else if (caracter === ',') {
      fila.push(campo);
      campo = '';
    } else if (caracter === '\n') {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else if (caracter !== '\r') {
      campo += caracter;
    }
  }

  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  return filas.filter(
    (actual) => actual.length > 1 || (actual[0] ?? '') !== '',
  );
}

function aObjetos(filas: string[][]): FilaCsv[] {
  const [cabecera, ...cuerpo] = filas;
  if (cabecera === undefined) {
    return [];
  }

  return cuerpo.map((fila) =>
    Object.fromEntries(
      cabecera.map((columna, indice) => [columna, fila[indice] ?? '']),
    ),
  );
}

/** Orden estable por contenido, para los listados que la API da por sucursal. */
function ordenarPorContenido(filas: FilaCsv[]): FilaCsv[] {
  return filas
    .map((fila) => JSON.stringify(fila))
    .sort()
    .map((fila) => JSON.parse(fila) as FilaCsv);
}

const texto = (valor: unknown): string =>
  valor === null || valor === undefined ? '' : String(valor);

const soloFecha = (valor: unknown): string =>
  valor === null || valor === undefined
    ? ''
    : new Date(valor as string | Date).toISOString().slice(0, 10);

/**
 * El CSV prefija con `'` los valores que Excel interpretaría como fórmula. Para
 * comparar con la API se revierte ese prefijo; la prueba de formatos comprueba
 * por separado que el prefijo existe.
 */
function desprotegerFormula(valor: string): string {
  if (
    valor.startsWith("'") &&
    ['=', '+', '-', '@', '\t', '\r'].includes(valor[1] ?? '')
  ) {
    return valor.slice(1);
  }
  return valor;
}

function desprotegerFila(fila: FilaCsv): FilaCsv {
  return Object.fromEntries(
    Object.entries(fila).map(([columna, valor]) => [
      columna,
      desprotegerFormula(valor),
    ]),
  );
}

describe('exports: paridad con las APIs (e2e)', () => {
  let app: INestApplication;
  let admin: string;
  let adminId: string;
  let gerente: string;
  let gerenteSucursalId: string;
  let sucursales: Sucursales;
  let hoy: string;
  let prisma: ReturnType<typeof clientePrueba>;

  let nombresSucursalAdmin = new Map<string, string>();
  let nombresSucursalGerente = new Map<string, string>();

  async function pedir<T>(
    token: string,
    ruta: string,
    query: Record<string, unknown> = {},
  ): Promise<T> {
    const respuesta = await request(app.getHttpServer())
      .get(ruta)
      .query(query)
      .set(...como(token))
      .expect(200);

    return respuesta.body as T;
  }

  async function paginas<T>(
    token: string,
    ruta: string,
    query: Record<string, unknown> = {},
    clave: 'data' | 'items' | 'eventos' = 'data',
  ): Promise<T[]> {
    const salida: T[] = [];
    let page = 1;
    let totalPaginas = 1;

    do {
      const cuerpo = await pedir<any>(token, ruta, {
        ...query,
        page,
        limit: 100,
      });
      salida.push(...((cuerpo[clave] ?? []) as T[]));
      totalPaginas = Number(cuerpo.totalPaginas ?? 1);
      page += 1;
    } while (page <= totalPaginas);

    return salida;
  }

  async function descargar(
    ruta: string,
    token: string,
    body: unknown,
  ): Promise<Descarga> {
    const respuesta = await request(app.getHttpServer())
      .post(ruta)
      .set(...como(token))
      .send(body as object)
      .buffer(true)
      .parse(parserBinario);

    return {
      status: respuesta.status,
      buffer: respuesta.body as Buffer,
      headers: respuesta.headers as Record<string, string>,
    };
  }

  function cuerpoDe(conjunto: string): Record<string, unknown> {
    const exigeRango = [
      'ventas',
      'movimientos',
      'asistencia',
      'faltas',
      'reporte',
    ].includes(conjunto);

    return {
      conjunto,
      formato: 'csv',
      ...(exigeRango ? { filtros: { desde: hoy, hasta: hoy } } : { filtros: {} }),
    };
  }

  async function csvDe(
    token: string,
    conjunto: string,
  ): Promise<FilaCsv[]> {
    const descarga = await descargar('/api/exports', token, cuerpoDe(conjunto));
    expect(descarga.status).toBe(200);
    expect(descarga.headers['content-type']).toContain('text/csv');
    expect(descarga.headers['content-disposition']).toContain(
      `filename="${conjunto}-${hoy}.csv"`,
    );
    expect(descarga.buffer.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(descarga.buffer.toString('utf8')).toContain('\r\n');

    return aObjetos(parsearCsv(descarga.buffer.toString('utf8'))).map(
      desprotegerFila,
    );
  }

  async function mapaDeSucursales(token: string): Promise<Map<string, string>> {
    const filas = await pedir<Array<{ id: string; nombre: string }>>(
      token,
      '/api/branches',
    );
    return new Map(filas.map((fila) => [fila.id, fila.nombre]));
  }

  async function stockApi(token: string): Promise<any[]> {
    const filas: any[] = [];
    for (const sucursalId of nombresSucursalDe(token).keys()) {
      filas.push(
        ...(await paginas<any>(
          token,
          `/api/inventario/sucursales/${sucursalId}/stock`,
        )),
      );
    }
    return filas;
  }

  function nombresSucursalDe(token: string): Map<string, string> {
    return token === admin ? nombresSucursalAdmin : nombresSucursalGerente;
  }

  function nombreSucursal(token: string, id: string | null): string {
    return nombresSucursalDe(token).get(id ?? '') ?? '';
  }

  async function filasApi(
    token: string,
    conjunto: string,
  ): Promise<FilaCsv[]> {
    switch (conjunto) {
      case 'ventas': {
        const filas = await paginas<any>(token, '/api/sales', { fecha: hoy });
        return filas.map((fila) => ({
          Fecha: textoFechaHoraLima(fila.createdAt),
          Sucursal: fila.sucursal.nombre,
          Vendedor: fila.vendedor.nombre,
          Método: etiquetaDe(ETIQUETA_METODO_PAGO, fila.metodoPago),
          Estado: etiquetaDe(ETIQUETA_ESTADO_VENTA, fila.estado),
          Total: fila.total,
        }));
      }

      case 'carta': {
        const filas: any[] = [];
        for (const sucursalId of nombresSucursalDe(token).keys()) {
          const carta = await pedir<any[]>(
            token,
            `/api/branches/${sucursalId}/products`,
          );
          filas.push(
            ...carta.map((fila) => ({ ...fila, sucursalId })),
          );
        }
        return ordenarPorContenido(
          filas.map((fila) => ({
            Sucursal: nombreSucursal(token, fila.sucursalId),
            Producto: fila.producto.nombre,
            Categoría: fila.producto.categoria.nombre,
            Variante: fila.variante.nombre,
            Precio: fila.precio,
            Estado: etiquetaDe(ETIQUETA_OFERTA, fila.estado),
          })),
        );
      }

      case 'stock': {
        const filas = await stockApi(token);
        return ordenarPorContenido(
          filas.map((fila) => ({
            Sucursal: nombreSucursal(token, fila.sucursalId),
            Insumo: fila.insumo.nombre,
            Presentación: etiquetaDe(
              ETIQUETA_PRESENTACION_INSUMO,
              fila.insumo.presentacion,
            ),
            'Stock actual': fila.stockActual,
            'Stock mínimo': fila.stockMinimo,
            Estado: etiquetaDe(ETIQUETA_ESTADO_STOCK, fila.estado),
          })),
        );
      }

      case 'movimientos': {
        const stock = await stockApi(token);
        const stockPorId = new Map(stock.map((fila) => [fila.id, fila]));
        const inicio = new Date(`${hoy}T00:00:00-05:00`).toISOString();
        const fin = new Date(`${hoy}T23:59:59.999-05:00`).toISOString();
        const filas: any[] = [];

        for (const sucursalId of nombresSucursalDe(token).keys()) {
          filas.push(
            ...(await paginas<any>(
              token,
              `/api/inventario/sucursales/${sucursalId}/movimientos`,
              { desde: inicio, hasta: fin },
            )),
          );
        }

        return ordenarPorContenido(
          filas.map((fila) => {
            const filaStock = stockPorId.get(fila.insumoSucursalId);
            return {
              'Fecha y hora': textoFechaHoraLima(fila.createdAt),
              Sucursal: nombreSucursal(token, filaStock?.sucursalId ?? null),
              // El listado de movimientos solo devuelve el id de insumo_sucursal;
              // el nombre se resuelve con el endpoint de stock (referencia).
              Insumo: filaStock?.insumo?.nombre ?? '',
              Tipo: etiquetaDe(ETIQUETA_MOVIMIENTO, fila.tipo),
              Cantidad: fila.cantidad,
              Motivo: fila.motivo,
            };
          }),
        );
      }

      case 'empleados': {
        const filas = await paginas<any>(token, '/api/employees');
        return filas.map((fila) => ({
          Nombre: fila.usuario.nombre,
          Usuario: fila.usuario.nombreUsuario,
          Cargo: fila.cargo,
          Sucursal: nombreSucursal(token, fila.sucursalId),
          Estado: etiquetaDe(ETIQUETA_ESTADO_EMPLEADO, fila.estado),
        }));
      }

      case 'turnos': {
        const filas = await paginas<any>(token, '/api/shifts');
        return filas.map((fila) => ({
          Sucursal: nombreSucursal(token, fila.sucursalId),
          Tipo: etiquetaDe(ETIQUETA_TIPO_TURNO, fila.tipo),
          Horario: formatearHorario(fila.horaInicio, fila.horaFin),
          Días: formatearDias(fila.diasSemana),
        }));
      }

      case 'asignaciones': {
        const filas = await paginas<any>(token, '/api/assignments');
        return filas.map((fila) => {
          const estado = estadoAsignacion(
            {
              fechaInicio: new Date(fila.fechaInicio),
              fechaFin:
                fila.fechaFin === null ? null : new Date(fila.fechaFin),
            },
            hoy,
          );
          return {
            Empleado: fila.empleado.usuario.nombre,
            Cargo: fila.empleado.cargo,
            Sucursal: nombreSucursal(token, fila.empleado.sucursalId),
            Horario: formatearHorario(
              fila.turno.horaInicio,
              fila.turno.horaFin,
            ),
            Desde: soloFecha(fila.fechaInicio),
            Hasta: soloFecha(fila.fechaFin),
            Estado:
              ETIQUETA_ASIGNACION_CALCULADA[estado] ??
              etiquetaDe(ETIQUETA_ESTADO_ASIGNACION, estado),
          };
        });
      }

      case 'asistencia': {
        const filas = await paginas<any>(
          token,
          '/api/attendance/records',
          { desde: hoy, hasta: hoy },
          'items',
        );
        return filas.map((fila) => ({
          'Fecha y hora': textoFechaHoraLima(fila.fechaHora),
          Empleado: fila.empleado.nombre,
          Tipo: etiquetaDe(ETIQUETA_TIPO_MARCAJE, fila.tipo),
          Estado: fila.abierta ? 'Abierta' : 'Cerrada',
          Corrección: fila.corregido ? 'Sí' : 'No',
        }));
      }

      case 'faltas': {
        const respuesta = await pedir<any>(token, '/api/attendance/absences', {
          desde: hoy,
          hasta: hoy,
        });
        return (respuesta.items as any[]).map((fila) => ({
          Fecha: fila.fecha,
          Empleado: fila.empleadoNombre,
          Sucursal: nombreSucursal(token, fila.sucursalId),
          'Días de turno': formatearDias(fila.turno.diasSemana),
        }));
      }

      case 'equipos': {
        const filas = await paginas<any>(token, '/api/equipment');
        return filas.map((fila) => ({
          Sucursal: nombreSucursal(token, fila.sucursalId),
          Equipo: fila.nombre,
          Tipo: fila.tipo,
          Estado: etiquetaDe(ETIQUETA_ESTADO_EQUIPO, fila.estado),
          Observaciones: fila.observaciones ?? '',
        }));
      }

      case 'usuarios': {
        const filas = await paginas<any>(token, '/api/users');
        return filas.map((fila) => ({
          Nombre: fila.nombre,
          Usuario: fila.nombreUsuario,
          Rol: etiquetaDe(ETIQUETA_ROL, String(fila.rol).toLowerCase()),
          Sucursal: nombreSucursal(token, fila.sucursalId),
          Estado: etiquetaDe(ETIQUETA_ESTADO_USUARIO, fila.estado),
        }));
      }

      case 'sucursales': {
        const filas = await pedir<any[]>(token, '/api/branches');
        return filas.map((fila) => ({
          Nombre: fila.nombre,
          Dirección: fila.direccion,
          Teléfono: fila.telefono ?? '',
        }));
      }

      case 'reporte': {
        const respuesta = await pedir<any>(token, '/api/reports/comparativo', {
          desde: hoy,
          hasta: hoy,
          ...(token === gerente ? { sucursalId: gerenteSucursalId } : {}),
        });
        return (respuesta.sucursales as any[]).map((sucursal) => ({
          Sucursal: sucursal.sucursalNombre,
          Ventas: sucursal.ventas.total,
          Tickets: texto(sucursal.ventas.cantidad),
          'Ticket promedio': texto(sucursal.ventas.ticketPromedio),
          Anuladas: texto(sucursal.ventas.anuladas.cantidad),
          Movimientos: texto(sucursal.inventario.movimientos.total),
          Faltas: texto(sucursal.asistencia.faltas),
          'Faltas justificadas': texto(
            sucursal.asistencia.faltasJustificadas,
          ),
          'Insumos con alerta': texto(
            sucursal.estadoActual.insumosConAlertaAbierta,
          ),
          'Entradas abiertas': texto(sucursal.estadoActual.entradasAbiertas),
        }));
      }

      case 'auditoria': {
        const filas = await paginas<any>(
          token,
          '/api/auditoria',
          {},
          'eventos',
        );
        return filas.map((fila) => ({
          'Fecha y hora': textoFechaHoraLima(fila.fecha),
          Acción: etiquetaDe(ETIQUETA_ACCION_AUDITORIA, fila.accion),
          Entidad: etiquetaDe(ETIQUETA_ENTIDAD_AUDITORIA, fila.entidad),
          Nombre: fila.entidadId,
          Usuario: fila.actor.nombre,
        }));
      }

      default:
        throw new Error(`Conjunto sin API de paridad: ${conjunto}`);
    }
  }

  beforeAll(async () => {
    app = await crearAppDePruebas({
      limitesExport: { maxPorMinuto: 1_000 },
    });
    await resetDatabase(clientePrueba());
    prisma = clientePrueba();

    const sesion = await iniciarSesion(
      app,
      ADMIN_USUARIO_PRUEBAS,
      ADMIN_PASSWORD_PRUEBAS,
    ).expect(200);
    admin = sesion.body.accessToken as string;
    adminId = sesion.body.user.id as string;
    sucursales = await idsDeSucursales();

    const gerenteCreado = await crearGerente(
      app,
      admin,
      sucursales.centro,
      'Gerente Paridad',
    );
    gerente = gerenteCreado.token;
    gerenteSucursalId = sucursales.centro;

    const permisoReporte = await prisma.permiso.findUniqueOrThrow({
      where: { codigo: 'reportes.comparativos.ver' },
    });
    await prisma.usuarioPermiso.create({
      data: {
        usuarioId: gerenteCreado.usuario.id,
        permisoId: permisoReporte.id,
        tipo: 'concedido',
      },
    });

    hoy = fechaLocalDe(new Date());
    const fecha = new Date(`${hoy}T00:00:00.000Z`);
    const ahora = new Date();

    async function ficha(
      sucursalId: string,
      nombre: string,
      cargo: string,
    ): Promise<{ usuario: any; empleado: any }> {
      const usuario = await crearEmpleado(app, admin, sucursalId, nombre);
      const empleado = await prisma.empleado.create({
        data: {
          usuarioId: usuario.id,
          cargo,
          sucursalId,
          fechaContratacion: fecha,
        },
      });
      return { usuario, empleado };
    }

    const ana = await ficha(sucursales.centro, 'Ana Paridad', 'Cajera');
    const beto = await ficha(sucursales.centro, 'Beto Paridad', 'Cocinero');
    const carla = await ficha(sucursales.centro, 'Carla Paridad', 'Almacén');
    const diego = await ficha(sucursales.norte, 'Diego Paridad', 'Cajero');

    // Catálogo y carta en las dos sucursales.
    const categoria = await prisma.categoriaProducto.create({
      data: { nombre: 'Categoría Paridad' },
    });
    const variante = await prisma.variante.findFirstOrThrow({
      where: { nombre: 'Única' },
    });
    const producto = await prisma.producto.create({
      data: { nombre: 'Café Paridad', categoriaId: categoria.id },
    });
    const ofertaCentro = await prisma.productoSucursalVariante.create({
      data: {
        productoId: producto.id,
        sucursalId: sucursales.centro,
        varianteId: variante.id,
        precio: '12.50',
        estado: 'activo',
      },
    });
    await prisma.productoSucursalVariante.create({
      data: {
        productoId: producto.id,
        sucursalId: sucursales.norte,
        varianteId: variante.id,
        precio: '13.00',
        estado: 'inactivo',
      },
    });

    // Inventario: stock, movimiento y alerta abierta en Centro.
    const insumo = await prisma.insumo.create({
      data: { nombre: 'Leche Paridad', presentacion: 'caja' },
    });
    const stockCentro = await prisma.insumoSucursal.create({
      data: {
        insumoId: insumo.id,
        sucursalId: sucursales.centro,
        stockActual: '8.00',
        stockMinimo: '10.00',
        estado: 'activo',
      },
    });
    const stockNorte = await prisma.insumoSucursal.create({
      data: {
        insumoId: insumo.id,
        sucursalId: sucursales.norte,
        stockActual: '20.00',
        stockMinimo: '5.00',
        estado: 'activo',
      },
    });
    await prisma.movimientoInventario.createMany({
      data: [
        {
          insumoSucursalId: stockCentro.id,
          tipo: 'entrada',
          cantidad: '5.00',
          usuarioId: adminId,
          motivo: 'Compra paridad',
          createdAt: ahora,
        },
        {
          insumoSucursalId: stockNorte.id,
          tipo: 'ajuste',
          cantidad: '-1.50',
          usuarioId: adminId,
          motivo: 'Ajuste paridad',
          createdAt: new Date(ahora.getTime() - 1_000),
        },
      ],
    });
    await prisma.alertaStock.create({
      data: { insumoSucursalId: stockCentro.id, estado: 'abierta' },
    });

    // Venta del día en Centro.
    await prisma.venta.create({
      data: {
        sucursalId: sucursales.centro,
        usuarioId: adminId,
        metodoPago: 'efectivo',
        estado: 'completada',
        createdAt: ahora,
        updatedAt: ahora,
        detalles: {
          create: {
            productoSucursalVarianteId: ofertaCentro.id,
            cantidad: 2,
            precioUnitarioSnapshot: '12.50',
            subtotal: '25.00',
          },
        },
      },
    });

    // Turnos y asignaciones: Centro para Ana/Beto/Carla y Norte para Diego.
    const turnoCentro = await prisma.turno.create({
      data: {
        sucursalId: sucursales.centro,
        tipo: 'fijo',
        horaInicio: horaADate('08:00'),
        horaFin: horaADate('16:00'),
        diasSemana: '1,2,3,4,5,6,7',
      },
    });
    const turnoNorte = await prisma.turno.create({
      data: {
        sucursalId: sucursales.norte,
        tipo: 'fijo',
        horaInicio: horaADate('09:00'),
        horaFin: horaADate('17:00'),
        diasSemana: '1,2,3,4,5,6,7',
      },
    });
    for (const empleado of [ana.empleado, beto.empleado, carla.empleado]) {
      await prisma.asignacionTurno.create({
        data: {
          empleadoId: empleado.id,
          turnoId: turnoCentro.id,
          fechaInicio: fecha,
        },
      });
    }
    await prisma.asignacionTurno.create({
      data: {
        empleadoId: diego.empleado.id,
        turnoId: turnoNorte.id,
        fechaInicio: fecha,
      },
    });

    // Asistencia: Ana con corrección y entrada abierta; Beto cerrado; Carla y
    // Diego sin marcación (faltas del día).
    const entradaAna = await prisma.registroAsistencia.create({
      data: {
        empleadoId: ana.empleado.id,
        sucursalId: sucursales.centro,
        tipo: 'entrada',
        fechaHora: new Date(`${hoy}T08:00:00-05:00`),
        metodo: 'pin',
      },
    });
    await prisma.registroAsistencia.create({
      data: {
        empleadoId: ana.empleado.id,
        sucursalId: sucursales.centro,
        tipo: 'entrada',
        fechaHora: new Date(`${hoy}T09:00:00-05:00`),
        metodo: 'pin',
        esCorreccion: true,
        registroOriginalId: entradaAna.id,
        motivo: 'Corrección paridad',
        usuarioCorrectorId: adminId,
      },
    });
    await prisma.registroAsistencia.createMany({
      data: [
        {
          empleadoId: beto.empleado.id,
          sucursalId: sucursales.centro,
          tipo: 'entrada',
          fechaHora: new Date(`${hoy}T08:00:00-05:00`),
          metodo: 'pin',
        },
        {
          empleadoId: beto.empleado.id,
          sucursalId: sucursales.centro,
          tipo: 'salida',
          fechaHora: new Date(`${hoy}T17:00:00-05:00`),
          metodo: 'pin',
        },
      ],
    });

    await prisma.equipo.createMany({
      data: [
        {
          sucursalId: sucursales.centro,
          nombre: 'Caja Paridad',
          tipo: 'Caja registradora',
          estado: 'funcionando',
          createdAt: new Date(ahora.getTime() - 2_000),
        },
        {
          sucursalId: sucursales.norte,
          nombre: 'Horno Paridad',
          tipo: 'Horno',
          estado: 'en_mantenimiento',
          observaciones: 'Revisión',
          createdAt: new Date(ahora.getTime() - 3_000),
        },
      ],
    });

    // Auditoría visible por persona, por sucursal y global (el Gerente no debe
    // ver la global).
    await prisma.auditoria.createMany({
      data: [
        {
          entidad: 'empleado',
          entidadId: ana.empleado.id,
          accion: 'empleado_creado',
          actorId: adminId,
          usuarioAfectadoId: ana.usuario.id,
          sucursalAfectadaId: sucursales.centro,
          detalle: {},
          createdAt: new Date(ahora.getTime() - 4_000),
        },
        {
          entidad: 'equipo',
          entidadId: '01920000-0000-7000-8000-000000000001',
          accion: 'equipo_creado',
          actorId: adminId,
          sucursalAfectadaId: sucursales.centro,
          detalle: {},
          createdAt: new Date(ahora.getTime() - 5_000),
        },
        {
          entidad: 'categoria',
          entidadId: categoria.id,
          accion: 'categoria_creada',
          actorId: adminId,
          detalle: {},
          createdAt: new Date(ahora.getTime() - 6_000),
        },
      ],
    });

    nombresSucursalAdmin = await mapaDeSucursales(admin);
    nombresSucursalGerente = await mapaDeSucursales(gerente);
  });

  afterAll(async () => {
    await app.close();
    await cerrarClientePrueba();
  });

  const conjuntosPorSucursal = new Set(['carta', 'stock', 'movimientos']);

  describe.each([
    ['Admin', () => admin],
    ['Gerente', () => gerente],
  ])('%s: CSV igual al listado API', (_rol, tokenDe) => {
    it.each([...CONJUNTOS])('conjunto %s', async (conjunto) => {
      const token = tokenDe();
      // Para auditoría se lee la API ANTES del export: el propio export añade un
      // evento que no puede estar en el CSV que ya se generó. Las demás APIs no
      // cambian durante la prueba.
      const esperadas = await filasApi(token, conjunto);
      const csv = await csvDe(token, conjunto);

      if (conjuntosPorSucursal.has(conjunto)) {
        expect(ordenarPorContenido(csv)).toEqual(ordenarPorContenido(esperadas));
      } else {
        expect(csv).toEqual(esperadas);
      }
    });
  });
});
