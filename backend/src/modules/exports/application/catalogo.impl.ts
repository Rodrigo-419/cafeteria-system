// Catalogo de conjuntos exportables.
//
// Cada conjunto declara su etiqueta, sus columnas en español, el permiso de
// lectura que exige y una funcion que devuelve las filas ya normalizadas.
//
// Reglas comunes a todos los conjuntos:
//
//   * El servidor aplica el alcance: el Admin ve todas las sucursales y un
//     Gerente solo la suya. Nunca se confia en un `sucursalId` que mande el
//     cliente.
//   * Solo se seleccionan columnas de negocio: ni `passwordHash`, ni `pinHash`,
//     ni ningun otro secreto llega al archivo.
//   * El total se cuenta antes de leer. Si supera el tope por conjunto se
//     devuelve sin filas para que el servicio responda 413 sin cargar la
//     memoria con una tabla enorme.
import { Prisma } from '../../../generated/prisma/client';
import type { PrismaService } from '../../../database/prisma.service';
import { CONJUNTOS, MAX_FILAS_POR_CONJUNTO } from '../domain/limites';
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
  getEtiquetaConjunto,
} from '../domain/etiquetas';
import { textoFechaHoraLima } from '../domain/excel';
import { estadoAsignacion, formatearDias, formatearHorario } from '../domain/formato';
import { fechaAHora } from '../../shifts/domain/horas';
import { fechaLocalDe, rangoDelDiaLocal } from '../../sales/domain/rules/fechas';
import { diaUtc } from '../../employees/domain/fechas';
import { calcularFaltas } from '../../attendance/domain/rules/calculo-faltas';
import { derivarAsistencia } from '../../attendance/domain/rules/registros-efectivos';
import { ReportsRepository } from '../../reports/infrastructure/reports.repository';
import { GenerarReporteComparativoUseCase } from '../../reports/application/use-cases/generar-reporte-comparativo.use-case';
import { esAdmin } from '../../users/domain/roles';
import { filtroAlcanceListado } from '../../users/domain/rules/alcance';
import { filtroAlcanceEmpleados } from '../../employees/domain/rules/alcance';
import {
  alcanceEmpleadosParaAsignaciones,
  filtroAlcanceTurnos,
} from '../../shifts/domain/rules/alcance';
import { alcanceDeActor } from '../../auditoria/application/alcance-auditoria';
import { whereDeAlcanceAuditoria } from '../../auditoria/infrastructure/auditoria.repository';

/** Recorte del usuario autenticado que necesita el catalogo. */
export type UsuarioExport = {
  id: string;
  nombre?: string | null;
  nombreUsuario?: string | null;
  rol?: string | null;
  sucursalId?: string | null;
  permisos?: string[];
  permisosEfectivos?: string[];
};

/** Filtros que acepta un conjunto. */
export type FiltrosExport = {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
};

/** Fila ya normalizada: claves = encabezados en español. */
export type FilaExport = Record<string, string | number | null>;

export type ResultadoDatos = {
  datos: FilaExport[];
  total: number;
};

export type LimitesLectura = {
  maxFilasPorConjunto: number;
};

export type ObtenerDatos = (
  prisma: PrismaService,
  user: UsuarioExport,
  filtros: FiltrosExport,
  limites?: LimitesLectura,
) => Promise<ResultadoDatos>;

/**
 * UUID centinela que no casa con ninguna sucursal real. Es un UUID valido para
 * que Prisma no rechace la consulta por formato si un Gerente no tuviera
 * sucursal asignada.
 */
const SIN_ALCANCE = '01920000-0000-7000-8000-000000000000';

/** Permiso de lectura real de cada conjunto (los codigos del seed). */
const PERMISOS_LECTURA: Record<string, string> = {
  ventas: 'ventas.ver',
  carta: 'productos.ver',
  stock: 'insumos.ver',
  movimientos: 'inventario.registrar',
  empleados: 'empleados.crear_editar',
  turnos: 'turnos.editar',
  asignaciones: 'turnos.editar',
  asistencia: 'asistencia.ver',
  faltas: 'asistencia.ver',
  equipos: 'equipo.ver',
  usuarios: 'usuarios.crear_editar',
  sucursales: 'sucursales.ver',
  reporte: 'reportes.comparativos.ver',
  auditoria: 'usuarios.crear_editar',
};

const COLUMNAS: Record<string, string[]> = {
  ventas: ['Fecha', 'Sucursal', 'Vendedor', 'Método', 'Estado', 'Total'],
  carta: ['Sucursal', 'Producto', 'Categoría', 'Variante', 'Precio', 'Estado'],
  stock: ['Sucursal', 'Insumo', 'Presentación', 'Stock actual', 'Stock mínimo', 'Estado'],
  movimientos: ['Fecha y hora', 'Sucursal', 'Insumo', 'Tipo', 'Cantidad', 'Motivo'],
  empleados: ['Nombre', 'Usuario', 'Cargo', 'Sucursal', 'Estado'],
  turnos: ['Sucursal', 'Tipo', 'Horario', 'Días'],
  asignaciones: ['Empleado', 'Cargo', 'Sucursal', 'Horario', 'Desde', 'Hasta', 'Estado'],
  asistencia: ['Fecha y hora', 'Empleado', 'Tipo', 'Estado', 'Corrección'],
  faltas: ['Fecha', 'Empleado', 'Sucursal', 'Días de turno'],
  equipos: ['Sucursal', 'Equipo', 'Tipo', 'Estado', 'Observaciones'],
  usuarios: ['Nombre', 'Usuario', 'Rol', 'Sucursal', 'Estado'],
  sucursales: ['Nombre', 'Dirección', 'Teléfono'],
  reporte: [
    'Sucursal',
    'Ventas',
    'Tickets',
    'Ticket promedio',
    'Anuladas',
    'Movimientos',
    'Faltas',
    'Faltas justificadas',
    'Insumos con alerta',
    'Entradas abiertas',
  ],
  auditoria: ['Fecha y hora', 'Acción', 'Entidad', 'Nombre', 'Usuario'],
};

const ETIQUETA_ESTADO_ASIGNACION_CALCULADO: Record<string, string> = {
  programada: 'Programada',
  vigente: 'Vigente',
  finalizada: 'Finalizada',
};

export const CATALOGO_EXPORTS: Record<string, any> = {};

for (const conjunto of CONJUNTOS) {
  CATALOGO_EXPORTS[conjunto] = {
    clave: conjunto,
    etiqueta: getEtiquetaConjunto(conjunto) || conjunto,
    columnas: COLUMNAS[conjunto] ?? [],
    permisoLectura: PERMISOS_LECTURA[conjunto] ?? 'usuarios.crear_editar',
    obtenerDatos: crearObtenerDatos(conjunto),
  };
}

/** Fabrica el lector de un conjunto con su nombre ya fijado. */
function crearObtenerDatos(conjunto: string): ObtenerDatos {
  const lectores: Record<string, ObtenerDatos> = {
    ventas: datosVentas,
    carta: datosCarta,
    stock: datosStock,
    movimientos: datosMovimientos,
    empleados: datosEmpleados,
    turnos: datosTurnos,
    asignaciones: datosAsignaciones,
    asistencia: datosAsistencia,
    faltas: datosFaltas,
    equipos: datosEquipos,
    usuarios: datosUsuarios,
    sucursales: datosSucursales,
    reporte: datosReporte,
    auditoria: datosAuditoria,
  };

  return lectores[conjunto] ?? (async () => ({ datos: [], total: 0 }));
}

// ------------------------------------------------------------------ helpers

/**
 * Sucursal a la que hay que limitar la lectura.
 *
 * `null` significa "sin limite" (Admin). Cualquier otro rol queda atado a su
 * propia sucursal; si no tiene, se usa un id imposible para no filtrar datos.
 */
function sucursalDe(user: UsuarioExport): string | null {
  if (esAdmin(user.rol)) {
    return null;
  }

  return user.sucursalId ?? SIN_ALCANCE;
}

/** Rango local `[desde, hasta]`; por defecto, los ultimos 30 dias. */
function rangoTexto(filtros: FiltrosExport | undefined): {
  desde: string;
  hasta: string;
} {
  const hoy = fechaLocalDe(new Date());
  const hasta =
    typeof filtros?.hasta === 'string' && filtros.hasta !== ''
      ? filtros.hasta
      : hoy;
  const desde =
    typeof filtros?.desde === 'string' && filtros.desde !== ''
      ? filtros.desde
      : desplazarDias(hasta, -29);

  return { desde, hasta };
}

/** Rango UTC `[inicio, fin)` de un rango de dias locales. */
function rangoUtc(filtros: FiltrosExport | undefined): {
  desde: string;
  hasta: string;
  inicio: Date;
  fin: Date;
} {
  const { desde, hasta } = rangoTexto(filtros);
  const inicio = rangoDelDiaLocal(desde).desde;
  const fin = rangoDelDiaLocal(hasta).hasta;
  return { desde, hasta, inicio, fin };
}

/** Dia `AAAA-MM-DD` desplazado. */
function desplazarDias(fecha: string, dias: number): string {
  const base = new Date(`${fecha}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Fecha sin hora (`@db.Date`) como `AAAA-MM-DD`. */
function soloFecha(valor: Date | null | undefined): string {
  return valor ? valor.toISOString().slice(0, 10) : '';
}

/** Decimal de Prisma como texto con dos decimales. */
function decimalTexto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return '';
  }

  if (typeof valor === 'object' && typeof (valor as any).toFixed === 'function') {
    return (valor as any).toFixed(2);
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toFixed(2) : String(valor);
}

/** Total de una venta sumando sus subtotales en centimos. */
function totalVenta(
  detalles: readonly { subtotal: unknown }[],
): string {
  let centimos = 0;
  for (const detalle of detalles) {
    const texto = decimalTexto(detalle.subtotal);
    const numero = Number(texto);
    if (Number.isFinite(numero)) {
      centimos += Math.round(numero * 100);
    }
  }
  return (centimos / 100).toFixed(2);
}

/**
 * Cuenta primero y solo lee si cabe en el tope por conjunto.
 *
 * Asi una tabla con mas de 10 000 filas no se materializa en memoria: el
 * servicio ve `total > MAX_FILAS_POR_CONJUNTO` y responde el 413.
 */
async function contarYLeer<T>(
  contar: () => Promise<number>,
  leer: () => Promise<T[]>,
  maxFilas: number = MAX_FILAS_POR_CONJUNTO,
): Promise<{ filas: T[]; total: number }> {
  const total = await contar();
  if (total > maxFilas) {
    return { filas: [], total };
  }

  return { filas: await leer(), total };
}

// -------------------------------------------------------------- conjuntos

async function datosVentas(
  prisma: PrismaService,
  user: UsuarioExport,
  filtros: FiltrosExport,
  limites?: LimitesLectura,
): Promise<ResultadoDatos> {
  const sucursalId = sucursalDe(user);
  const { inicio, fin } = rangoUtc(filtros);
  const where: Prisma.VentaWhereInput = {
    ...(sucursalId !== null ? { sucursalId } : {}),
    createdAt: { gte: inicio, lt: fin },
  };

  const { filas, total } = await contarYLeer(
    () => prisma.venta.count({ where }),
    () =>
      prisma.venta.findMany({
        where,
        select: {
          createdAt: true,
          metodoPago: true,
          estado: true,
          sucursal: { select: { nombre: true } },
          vendedor: { select: { nombre: true } },
          detalles: { select: { subtotal: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    limites?.maxFilasPorConjunto,
  );

  return {
    datos: filas.map((fila) => ({
      Fecha: textoFechaHoraLima(fila.createdAt),
      Sucursal: fila.sucursal.nombre,
      Vendedor: fila.vendedor.nombre,
      Método: etiquetaDe(ETIQUETA_METODO_PAGO, fila.metodoPago),
      Estado: etiquetaDe(ETIQUETA_ESTADO_VENTA, fila.estado),
      Total: totalVenta(fila.detalles),
    })),
    total,
  };
}

async function datosCarta(
  prisma: PrismaService,
  user: UsuarioExport,
  _filtros: FiltrosExport,
  limites?: LimitesLectura,
): Promise<ResultadoDatos> {
  const sucursalId = sucursalDe(user);
  const where: Prisma.ProductoSucursalVarianteWhereInput =
    sucursalId !== null ? { sucursalId } : {};

  const { filas, total } = await contarYLeer(
    () => prisma.productoSucursalVariante.count({ where }),
    () =>
      prisma.productoSucursalVariante.findMany({
        where,
        select: {
          precio: true,
          estado: true,
          sucursal: { select: { nombre: true } },
          producto: {
            select: { nombre: true, categoria: { select: { nombre: true } } },
          },
          variante: { select: { nombre: true } },
        },
        orderBy: [
          { producto: { nombre: 'asc' } },
          { variante: { nombre: 'asc' } },
        ],
      }),
    limites?.maxFilasPorConjunto,
  );

  return {
    datos: filas.map((fila) => ({
      Sucursal: fila.sucursal.nombre,
      Producto: fila.producto.nombre,
      Categoría: fila.producto.categoria.nombre,
      Variante: fila.variante.nombre,
      Precio: decimalTexto(fila.precio),
      Estado: etiquetaDe(ETIQUETA_OFERTA, fila.estado),
    })),
    total,
  };
}

async function datosStock(
  prisma: PrismaService,
  user: UsuarioExport,
  _filtros: FiltrosExport,
  limites?: LimitesLectura,
): Promise<ResultadoDatos> {
  const sucursalId = sucursalDe(user);
  const where: Prisma.InsumoSucursalWhereInput =
    sucursalId !== null ? { sucursalId } : {};

  const { filas, total } = await contarYLeer(
    () => prisma.insumoSucursal.count({ where }),
    () =>
      prisma.insumoSucursal.findMany({
        where,
        select: {
          stockActual: true,
          stockMinimo: true,
          estado: true,
          insumo: { select: { nombre: true, presentacion: true } },
          sucursal: { select: { nombre: true } },
        },
        orderBy: [
          { sucursalId: 'asc' },
          { insumo: { nombre: 'asc' } },
        ],
      }),
    limites?.maxFilasPorConjunto,
  );

  return {
    datos: filas.map((fila) => ({
      Sucursal: fila.sucursal.nombre,
      Insumo: fila.insumo.nombre,
      Presentación: etiquetaDe(
        ETIQUETA_PRESENTACION_INSUMO,
        fila.insumo.presentacion,
      ),
      'Stock actual': decimalTexto(fila.stockActual),
      'Stock mínimo': decimalTexto(fila.stockMinimo),
      Estado: etiquetaDe(ETIQUETA_ESTADO_STOCK, fila.estado),
    })),
    total,
  };
}

async function datosMovimientos(
  prisma: PrismaService,
  user: UsuarioExport,
  filtros: FiltrosExport,
  limites?: LimitesLectura,
): Promise<ResultadoDatos> {
  const sucursalId = sucursalDe(user);
  const { inicio, fin } = rangoUtc(filtros);
  const where: Prisma.MovimientoInventarioWhereInput = {
    createdAt: { gte: inicio, lt: fin },
    ...(sucursalId !== null
      ? { insumoSucursal: { sucursalId } }
      : {}),
  };

  const { filas, total } = await contarYLeer(
    () => prisma.movimientoInventario.count({ where }),
    () =>
      prisma.movimientoInventario.findMany({
        where,
        select: {
          createdAt: true,
          tipo: true,
          cantidad: true,
          motivo: true,
          insumoSucursal: {
            select: {
              insumo: { select: { nombre: true } },
              sucursal: { select: { nombre: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    limites?.maxFilasPorConjunto,
  );

  return {
    datos: filas.map((fila) => ({
      'Fecha y hora': textoFechaHoraLima(fila.createdAt),
      Sucursal: fila.insumoSucursal.sucursal.nombre,
      Insumo: fila.insumoSucursal.insumo.nombre,
      Tipo: etiquetaDe(ETIQUETA_MOVIMIENTO, fila.tipo),
      Cantidad: decimalTexto(fila.cantidad),
      Motivo: fila.motivo,
    })),
    total,
  };
}

async function datosEmpleados(
  prisma: PrismaService,
  user: UsuarioExport,
  _filtros: FiltrosExport,
  limites?: LimitesLectura,
): Promise<ResultadoDatos> {
  const where = whereEmpleadosDe(user);

  const { filas, total } = await contarYLeer(
    () => prisma.empleado.count({ where }),
    () =>
      prisma.empleado.findMany({
        where,
        select: {
          cargo: true,
          estado: true,
          usuario: { select: { nombre: true, nombreUsuario: true } },
          sucursal: { select: { nombre: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    limites?.maxFilasPorConjunto,
  );

  return {
    datos: filas.map((fila) => ({
      Nombre: fila.usuario.nombre,
      Usuario: fila.usuario.nombreUsuario,
      Cargo: fila.cargo,
      Sucursal: fila.sucursal.nombre,
      Estado: etiquetaDe(ETIQUETA_ESTADO_EMPLEADO, fila.estado),
    })),
    total,
  };
}

async function datosTurnos(
  prisma: PrismaService,
  user: UsuarioExport,
  _filtros: FiltrosExport,
  limites?: LimitesLectura,
): Promise<ResultadoDatos> {
  const alcance = filtroAlcanceTurnos(actorDe(user));
  const where: Prisma.TurnoWhereInput =
    alcance?.sucursalId !== undefined ? { sucursalId: alcance.sucursalId } : {};

  const { filas, total } = await contarYLeer(
    () => prisma.turno.count({ where }),
    () =>
      prisma.turno.findMany({
        where,
        select: {
          tipo: true,
          horaInicio: true,
          horaFin: true,
          diasSemana: true,
          sucursal: { select: { nombre: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    limites?.maxFilasPorConjunto,
  );

  return {
    datos: filas.map((fila) => ({
      Sucursal: fila.sucursal.nombre,
      Tipo: etiquetaDe(ETIQUETA_TIPO_TURNO, fila.tipo),
      Horario: formatearHorario(
        fechaAHora(fila.horaInicio),
        fechaAHora(fila.horaFin),
      ),
      Días: formatearDias(fila.diasSemana),
    })),
    total,
  };
}

async function datosAsignaciones(
  prisma: PrismaService,
  user: UsuarioExport,
  _filtros: FiltrosExport,
  limites?: LimitesLectura,
): Promise<ResultadoDatos> {
  const where = whereAsignacionesDe(user);

  const { filas, total } = await contarYLeer(
    () => prisma.asignacionTurno.count({ where }),
    () =>
      prisma.asignacionTurno.findMany({
        where,
        select: {
          fechaInicio: true,
          fechaFin: true,
          empleado: {
            select: {
              cargo: true,
              usuario: { select: { nombre: true } },
              sucursal: { select: { nombre: true } },
            },
          },
          turno: {
            select: { horaInicio: true, horaFin: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    limites?.maxFilasPorConjunto,
  );

  const hoy = fechaLocalDe(new Date());

  return {
    datos: filas.map((fila) => {
      const estado = estadoAsignacion(
        { fechaInicio: fila.fechaInicio, fechaFin: fila.fechaFin },
        hoy,
      );
      return {
        Empleado: fila.empleado.usuario.nombre,
        Cargo: fila.empleado.cargo,
        Sucursal: fila.empleado.sucursal.nombre,
        Horario: formatearHorario(
          fechaAHora(fila.turno.horaInicio),
          fechaAHora(fila.turno.horaFin),
        ),
        Desde: soloFecha(fila.fechaInicio),
        Hasta: soloFecha(fila.fechaFin),
        Estado: etiquetaDe(ETIQUETA_ESTADO_ASIGNACION_CALCULADO, estado) ||
          etiquetaDe(ETIQUETA_ESTADO_ASIGNACION, estado),
      };
    }),
    total,
  };
}

async function datosAsistencia(
  prisma: PrismaService,
  user: UsuarioExport,
  filtros: FiltrosExport,
  limites?: LimitesLectura,
): Promise<ResultadoDatos> {
  const sucursalId = sucursalDe(user);
  const { desde, hasta } = rangoTexto(filtros);

  const empleados = await prisma.empleado.findMany({
    where: sucursalId !== null ? { sucursalId } : {},
    select: {
      id: true,
      usuario: { select: { nombre: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  if (empleados.length === 0) {
    return { datos: [], total: 0 };
  }

  const registros = await prisma.registroAsistencia.findMany({
    where: { empleadoId: { in: empleados.map((empleado) => empleado.id) } },
    select: {
      id: true,
      empleadoId: true,
      sucursalId: true,
      tipo: true,
      fechaHora: true,
      metodo: true,
      esCorreccion: true,
      registroOriginalId: true,
      motivo: true,
      usuarioCorrectorId: true,
      createdAt: true,
    },
    orderBy: [{ fechaHora: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });

  const historialPorEmpleado = new Map<string, typeof registros>();
  for (const registro of registros) {
    const historial = historialPorEmpleado.get(registro.empleadoId) ?? [];
    historial.push(registro);
    historialPorEmpleado.set(registro.empleadoId, historial);
  }

  const filas: Array<{
    fechaHora: Date;
    id: string;
    nombre: string;
    tipo: string;
    abierta: boolean;
    corregido: boolean;
  }> = [];

  for (const empleado of empleados) {
    const historial = historialPorEmpleado.get(empleado.id) ?? [];
    const derivacion = derivarAsistencia(historial);

    for (const derivado of derivacion.registros) {
      const dia = fechaLocalDe(derivado.fechaHora);
      if (dia < desde || dia > hasta) {
        continue;
      }
      filas.push({
        fechaHora: derivado.fechaHora,
        id: derivado.id,
        nombre: empleado.usuario.nombre,
        tipo: derivado.tipo,
        abierta: derivado.abierta,
        corregido: derivado.corregido,
      });
    }
  }

  filas.sort(
    (a, b) =>
      b.fechaHora.getTime() - a.fechaHora.getTime() ||
      (a.id < b.id ? 1 : -1),
  );

  const total = filas.length;
  const datos = filas
    .slice(0, (limites?.maxFilasPorConjunto ?? MAX_FILAS_POR_CONJUNTO) + 1)
    .map((fila) => ({
      'Fecha y hora': textoFechaHoraLima(fila.fechaHora),
      Empleado: fila.nombre,
      Tipo: etiquetaDe(ETIQUETA_TIPO_MARCAJE, fila.tipo),
      Estado: fila.abierta ? 'Abierta' : 'Cerrada',
      Corrección: fila.corregido ? 'Sí' : 'No',
    }));

  return { datos, total };
}

async function datosFaltas(
  prisma: PrismaService,
  user: UsuarioExport,
  filtros: FiltrosExport,
  limites?: LimitesLectura,
): Promise<ResultadoDatos> {
  const sucursalId = sucursalDe(user);
  const { desde, hasta } = rangoTexto(filtros);
  const empleados = await prisma.empleado.findMany({
    where: sucursalId !== null ? { sucursalId } : {},
    select: {
      id: true,
      sucursalId: true,
      usuario: { select: { nombre: true } },
      sucursal: { select: { nombre: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  if (empleados.length === 0) {
    return { datos: [], total: 0 };
  }

  const empleadoIds = empleados.map((empleado) => empleado.id);
  const [registros, justificaciones, asignaciones] = await Promise.all([
    prisma.registroAsistencia.findMany({
      where: { empleadoId: { in: empleadoIds } },
      select: {
        id: true,
        empleadoId: true,
        tipo: true,
        fechaHora: true,
        esCorreccion: true,
        registroOriginalId: true,
      },
      orderBy: [{ fechaHora: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.justificacionFalta.findMany({
      where: {
        empleadoId: { in: empleadoIds },
        fecha: { gte: diaUtc(desde), lte: diaUtc(hasta) },
      },
      select: { empleadoId: true, fecha: true },
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    }),
    prisma.asignacionTurno.findMany({
      where: { empleadoId: { in: empleadoIds } },
      select: {
        empleadoId: true,
        fechaInicio: true,
        fechaFin: true,
        turno: { select: { tipo: true, diasSemana: true } },
      },
      orderBy: [{ fechaInicio: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const faltas = calcularFaltas({
    empleados: empleados.map((empleado) => ({
      id: empleado.id,
      nombre: empleado.usuario.nombre,
      sucursalId: empleado.sucursalId,
    })),
    registros,
    justificaciones,
    asignaciones,
    desde,
    hasta,
    hoy: fechaLocalDe(new Date()),
  });

  const sucursalNombre = new Map(
    empleados.map((empleado) => [empleado.id, empleado.sucursal.nombre]),
  );

  return {
    datos: faltas
      .slice(
        0,
        (limites?.maxFilasPorConjunto ?? MAX_FILAS_POR_CONJUNTO) + 1,
      )
      .map((falta) => ({
        Fecha: falta.fecha,
        Empleado: falta.empleadoNombre,
        Sucursal:
          sucursalNombre.get(falta.empleadoId) ?? falta.sucursalId,
        'Días de turno': formatearDias(falta.turno.diasSemana),
      })),
    total: faltas.length,
  };
}

async function datosEquipos(
  prisma: PrismaService,
  user: UsuarioExport,
  _filtros: FiltrosExport,
  limites?: LimitesLectura,
): Promise<ResultadoDatos> {
  const sucursalId = sucursalDe(user);
  const where: Prisma.EquipoWhereInput =
    sucursalId !== null ? { sucursalId } : {};

  const { filas, total } = await contarYLeer(
    () => prisma.equipo.count({ where }),
    () =>
      prisma.equipo.findMany({
        where,
        select: {
          nombre: true,
          tipo: true,
          estado: true,
          observaciones: true,
          sucursal: { select: { nombre: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    limites?.maxFilasPorConjunto,
  );

  return {
    datos: filas.map((fila) => ({
      Sucursal: fila.sucursal.nombre,
      Equipo: fila.nombre,
      Tipo: fila.tipo,
      Estado: etiquetaDe(ETIQUETA_ESTADO_EQUIPO, fila.estado),
      Observaciones: fila.observaciones ?? '',
    })),
    total,
  };
}

async function datosUsuarios(
  prisma: PrismaService,
  user: UsuarioExport,
  _filtros: FiltrosExport,
  limites?: LimitesLectura,
): Promise<ResultadoDatos> {
  const where = whereUsuariosDe(user);

  const { filas, total } = await contarYLeer(
    () => prisma.usuario.count({ where }),
    () =>
      prisma.usuario.findMany({
        where,
        select: {
          nombre: true,
          nombreUsuario: true,
          estado: true,
          rol: { select: { nombre: true } },
          sucursal: { select: { nombre: true } },
        },
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      }),
    limites?.maxFilasPorConjunto,
  );

  return {
    datos: filas.map((fila) => ({
      Nombre: fila.nombre,
      Usuario: fila.nombreUsuario,
      Rol: etiquetaDe(ETIQUETA_ROL, fila.rol.nombre.toLowerCase()),
      Sucursal: fila.sucursal?.nombre ?? '',
      Estado: etiquetaDe(ETIQUETA_ESTADO_USUARIO, fila.estado),
    })),
    total,
  };
}

async function datosSucursales(
  prisma: PrismaService,
  user: UsuarioExport,
  _filtros: FiltrosExport,
  limites?: LimitesLectura,
): Promise<ResultadoDatos> {
  const sucursalId = sucursalDe(user);
  const where: Prisma.SucursalWhereInput =
    sucursalId !== null ? { id: sucursalId } : {};

  const { filas, total } = await contarYLeer(
    () => prisma.sucursal.count({ where }),
    () =>
      prisma.sucursal.findMany({
        where,
        select: { nombre: true, direccion: true, telefono: true },
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      }),
    limites?.maxFilasPorConjunto,
  );

  return {
    datos: filas.map((fila) => ({
      Nombre: fila.nombre,
      Dirección: fila.direccion,
      Teléfono: fila.telefono ?? '',
    })),
    total,
  };
}

async function datosReporte(
  prisma: PrismaService,
  user: UsuarioExport,
  filtros: FiltrosExport,
  _limites?: LimitesLectura,
): Promise<ResultadoDatos> {
  const sucursalId = sucursalDe(user);
  const { desde, hasta } = rangoTexto(filtros);
  const generador = new GenerarReporteComparativoUseCase(
    new ReportsRepository(prisma),
  );

  const reporte = await generador.ejecutar({
    desde,
    hasta,
    ...(sucursalId !== null ? { sucursalId } : {}),
  });

  const datos = reporte.sucursales.map((sucursal) => ({
    Sucursal: sucursal.sucursalNombre,
    Ventas: sucursal.ventas.total,
    Tickets: sucursal.ventas.cantidad,
    'Ticket promedio': sucursal.ventas.ticketPromedio,
    Anuladas: sucursal.ventas.anuladas.cantidad,
    Movimientos: sucursal.inventario.movimientos.total,
    Faltas: sucursal.asistencia.faltas,
    'Faltas justificadas': sucursal.asistencia.faltasJustificadas,
    'Insumos con alerta': sucursal.estadoActual.insumosConAlertaAbierta,
    'Entradas abiertas': sucursal.estadoActual.entradasAbiertas,
  }));

  return { datos, total: datos.length };
}

async function datosAuditoria(
  prisma: PrismaService,
  user: UsuarioExport,
  _filtros: FiltrosExport,
  limites?: LimitesLectura,
): Promise<ResultadoDatos> {
  const donde = whereAuditoriaDe(user);

  const { filas, total } = await contarYLeer(
    () => prisma.auditoria.count({ where: donde }),
    () =>
      prisma.auditoria.findMany({
        where: donde,
        select: {
          createdAt: true,
          accion: true,
          entidad: true,
          entidadId: true,
          actor: { select: { nombre: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    limites?.maxFilasPorConjunto,
  );

  return {
    datos: filas.map((fila) => ({
      'Fecha y hora': textoFechaHoraLima(fila.createdAt),
      Acción: etiquetaDe(ETIQUETA_ACCION_AUDITORIA, fila.accion),
      Entidad: etiquetaDe(ETIQUETA_ENTIDAD_AUDITORIA, fila.entidad),
      Nombre: fila.entidadId,
      Usuario: fila.actor.nombre,
    })),
    total,
  };
}

/**
 * Alcance de la auditoria exportada: el Admin ve todo; un Gerente, lo mismo que
 * ve en `GET /api/auditoria` (personas y operativos de su sucursal, mas sus
 * propias exportaciones). Nunca las exportaciones de otro usuario.
 */
function actorDe(user: UsuarioExport) {
  return {
    id: user.id,
    rol: user.rol ?? null,
    sucursalId: user.sucursalId ?? null,
    permisosEfectivos: user.permisosEfectivos ?? user.permisos ?? [],
  };
}

/** Alcance de usuarios: reutiliza la regla real del modulo de usuarios. */
function whereUsuariosDe(user: UsuarioExport): Prisma.UsuarioWhereInput {
  const alcance = filtroAlcanceListado(actorDe(user));
  if (alcance === undefined) {
    return {};
  }

  return {
    sucursalId: alcance.sucursalId ?? SIN_ALCANCE,
    rol: { nombre: alcance.rol ?? SIN_ALCANCE },
  };
}

/** Alcance de empleados: reutiliza la regla real del modulo de personal. */
function whereEmpleadosDe(user: UsuarioExport): Prisma.EmpleadoWhereInput {
  const alcance = filtroAlcanceEmpleados(actorDe(user));
  if (alcance === undefined) {
    return {};
  }

  return {
    sucursalId: alcance.sucursalId ?? SIN_ALCANCE,
    usuario: { rol: { nombre: alcance.usuarioRol ?? SIN_ALCANCE } },
  };
}

/** Alcance de asignaciones: reutiliza la regla real del modulo de turnos. */
function whereAsignacionesDe(
  user: UsuarioExport,
): Prisma.AsignacionTurnoWhereInput {
  const alcance = alcanceEmpleadosParaAsignaciones(actorDe(user));
  if (alcance === undefined) {
    return {};
  }

  return {
    empleado: {
      ...(alcance.sucursalId !== undefined
        ? { sucursalId: alcance.sucursalId }
        : {}),
      ...(alcance.usuarioRol !== undefined
        ? { usuario: { rol: { nombre: alcance.usuarioRol } } }
        : {}),
    },
  };
}

/**
 * Alcance de la auditoria exportada: reutiliza `alcanceDeActor` y
 * `whereDeAlcanceAuditoria`, las mismas reglas de `GET /api/auditoria`.
 */
function whereAuditoriaDe(user: UsuarioExport): Prisma.AuditoriaWhereInput {
  const alcance = alcanceDeActor(actorDe(user));
  return alcance === null
    ? { id: SIN_ALCANCE }
    : whereDeAlcanceAuditoria(alcance);
}
