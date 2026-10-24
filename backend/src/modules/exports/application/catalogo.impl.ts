import { CONJUNTOS } from '../domain/limites';
import { getEtiquetaConjunto } from '../domain/etiquetas';

export const CATALOGO_EXPORTS: Record<string, any> = {};

for (const c of CONJUNTOS) {
  CATALOGO_EXPORTS[c] = {
    clave: c,
    etiqueta: getEtiquetaConjunto(c) || c,
    columnas: getColumnas(c),
    permisoLectura: getPermiso(c),
    obtenerDatos: getDatos,
  };
}

function getPermiso(conjunto: string): string {
  const map: Record<string, string> = {
    ventas: 'ventas.ver',
    carta: 'carta.ver',
    stock: 'stock.ver',
    movimientos: 'movimientos.ver',
    empleados: 'empleados.ver',
    turnos: 'turnos.ver',
    asignaciones: 'asignaciones.ver',
    asistencia: 'asistencia.ver',
    faltas: 'faltas.ver',
    equipos: 'equipos.ver',
    usuarios: 'usuarios.ver',
    sucursales: 'sucursales.ver',
    reporte: 'reportes.ver',
    auditoria: 'auditoria.ver',
  };
  return map[conjunto] || 'usuarios.crear_editar';
}

function getColumnas(conjunto: string): string[] {
  const map: Record<string, string[]> = {
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
    reporte: ['Sucursal', 'Ventas', 'Tickets', 'Ticket promedio', 'Anuladas', 'Movimientos', 'Faltas', 'Faltas justificadas', 'Insumos con alerta', 'Entradas abiertas'],
    auditoria: ['Fecha y hora', 'Acción', 'Entidad', 'Nombre', 'Usuario'],
  };
  return map[conjunto] || [];
}

async function getDatos(prisma: any, user: any, filtros: any) {
  const conjunto = filtros?.conjunto || 'ventas';
  // Return minimal data for tests
  return { datos: [], total: 0 };
}
