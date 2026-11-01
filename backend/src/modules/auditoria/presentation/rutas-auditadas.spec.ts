// Cobertura de auditoria: toda ruta que MUTA estado (POST/PUT/PATCH/DELETE)
// tiene que estar auditada o justificada como exclusion.
//
// La prueba descubre sola los controladores del proyecto (recorre `src`), lee la
// metadata de rutas de Nest (`PATH_METADATA`/`METHOD_METADATA`) y exige que cada
// operacion mutante aparezca en el registro de rutas auditadas o en la lista de
// exclusiones justificadas. Anadir un endpoint mutante sin ninguna de las dos
// cosas hace fallar esta prueba.
//
// No instancia Nest ni toca la base: la metadata de rutas vive en las clases.
// Las rutas se escriben SIN el prefijo global `/api`.
import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ_SRC = resolve(__dirname, '../../..');

const METODOS: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.ALL]: 'ALL',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.HEAD]: 'HEAD',
  [RequestMethod.SEARCH]: 'SEARCH',
};

const METODOS_MUTANTES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Rutas mutantes que REGISTRAN un evento de auditoria.
 *
 * Cada entrada se corresponde con uno o mas eventos emitidos por el caso de uso
 * que atiende esa ruta. Si una ruta deja de estar auditada, esta prueba no puede
 * detectarlo (la metadata no lo dice); sirve como registro explicito y como
 * recordatorio de que el conjunto de rutas auditadas esta revisado.
 */
const RUTAS_AUDITADAS = new Set<string>([
  // usuarios
  'POST /users', //                         usuario_creado
  'PATCH /users/:id', //                    usuario_editado / rol / sucursal
  'PATCH /users/:id/estado', //             usuario_bloqueado / usuario_activado
  'PATCH /users/:id/password', //           usuario_password_restablecida
  'PATCH /users/me/password', //            usuario_password_cambiada
  'PUT /users/:id/permisos/:permisoId', //  permiso_concedido
  'DELETE /users/:id/permisos/:permisoId', // permiso_revocado / permiso_restablecido
  // empleados
  'POST /employees', //                     empleado_creado
  'PATCH /employees/:id', //                empleado_editado
  'POST /employees/:id/cese', //            empleado_cesado
  'POST /employees/:id/pin', //             empleado_pin_regenerado
  // sucursales
  'POST /branches', //                      sucursal_creada
  'PATCH /branches/:id', //                 sucursal_editada
  // equipos
  'POST /equipment', //                     equipo_creado
  'PATCH /equipment/:id', //                equipo_editado / equipo_estado_cambiado
  // turnos y asignaciones
  'POST /shifts', //                        turno_creado
  'PATCH /shifts/:id', //                   turno_editado
  'POST /assignments', //                   asignacion_creada
  'PATCH /assignments/:id', //              asignacion_retirada
  // catalogo de productos
  'POST /product-categories', //            categoria_creada
  'PATCH /product-categories/:id', //       categoria_editada
  'DELETE /product-categories/:id', //      categoria_eliminada
  'POST /variants', //                      variante_creada
  'PATCH /variants/:id', //                 variante_editada
  'DELETE /variants/:id', //                variante_eliminada
  'POST /products', //                      producto_creado
  'PATCH /products/:id', //                 producto_editado
  'DELETE /products/:id', //                producto_eliminado
  'PUT /branches/:sucursalId/products/:productoId/variants/:varianteId', // oferta_*
  // inventario (solo insumos y su stock por sucursal)
  'POST /insumos', //                       insumo_creado
  'PATCH /insumos/:id', //                  insumo_editado
  'DELETE /insumos/:id', //                 insumo_eliminado
  'PUT /inventario/sucursales/:sucursalId/insumos/:insumoId', // insumo_sucursal_*
  // exportaciones (auditoria dentro del caso de uso)
  'POST /exports', //                       exportacion_generada / exportacion_fallida
  'POST /exports/full', //                  exportacion_generada / exportacion_fallida
]);

/**
 * Rutas mutantes que a proposito NO se auditan, con su justificacion.
 *
 * La auditoria de esta entrega cubre gestion de personas, sucursales, equipos,
 * turnos, catalogo de productos y el catalogo de insumos. Logica de negocio
 * transaccional (ventas), operativa de asistencia y movimientos/recuentos de
 * inventario quedan fuera y se documentan aqui para que no pasen inadvertidos.
 */
const RUTAS_EXCLUIDAS = new Map<string, string>([
  [
    'POST /auth/login',
    'Autenticacion: no es una operacion de negocio y no hay actor autenticado previo.',
  ],
  [
    'POST /attendance/mark',
    'Asistencia: marcacion con PIN, fuera del alcance de la auditoria de esta entrega.',
  ],
  [
    'POST /attendance/records/:id/correct',
    'Asistencia: correccion de registro, fuera del alcance.',
  ],
  [
    'POST /attendance/absences/justify',
    'Asistencia: justificacion de falta, fuera del alcance.',
  ],
  [
    'POST /inventario/sucursales/:sucursalId/insumos/:insumoId/entradas',
    'Inventario: alta de entrada (movimiento). El movimiento y el recuento quedan fuera del alcance de esta entrega.',
  ],
  [
    'POST /inventario/sucursales/:sucursalId/recuentos',
    'Inventario: recuento fisico, fuera del alcance.',
  ],
  ['POST /sales', 'Ventas: registro de venta, fuera del alcance.'],
  ['POST /sales/:id/anular', 'Ventas: anulacion de venta, fuera del alcance.'],
]);

type Ruta = { metodo: string; ruta: string };

function archivosControladores(dir: string, acumulado: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      archivosControladores(ruta, acumulado);
    } else if (entrada.endsWith('.controller.ts')) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

function prefijos(valor: string | string[] | undefined): string[] {
  if (valor === undefined || valor === '') {
    return [''];
  }
  return Array.isArray(valor) ? valor : [valor];
}

function rutasDeController(clase: object): Ruta[] {
  const base: unknown = Reflect.getMetadata(PATH_METADATA, clase);
  if (base === undefined) {
    return [];
  }

  const proto = (clase as { prototype: Record<string, unknown> }).prototype;
  const rutas: Ruta[] = [];

  for (const nombre of Object.getOwnPropertyNames(proto)) {
    if (nombre === 'constructor') {
      continue;
    }
    const fn = proto[nombre];
    if (typeof fn !== 'function') {
      continue;
    }
    const metodo = Reflect.getMetadata(METHOD_METADATA, fn) as number | undefined;
    if (metodo === undefined) {
      continue;
    }
    const rutaMetodo = (Reflect.getMetadata(PATH_METADATA, fn) as string | undefined) ?? '';
    for (const prefijo of prefijos(base as string | string[] | undefined)) {
      const partes = [prefijo, rutaMetodo].filter((p) => p !== '' && p !== '/');
      rutas.push({
        metodo: METODOS[metodo] ?? String(metodo),
        ruta: '/' + partes.join('/').replace(/\/{2,}/g, '/'),
      });
    }
  }

  return rutas;
}

/** Claves `"METODO /ruta"` de todas las rutas mutantes registradas en Nest. */
function rutasMutantesDescubiertas(): Set<string> {
  const claves = new Set<string>();

  for (const archivo of archivosControladores(RAIZ_SRC)) {
    const modulo = require(archivo) as Record<string, unknown>;
    for (const valor of Object.values(modulo)) {
      if (typeof valor !== 'function') {
        continue;
      }
      for (const { metodo, ruta } of rutasDeController(valor)) {
        if (METODOS_MUTANTES.has(metodo)) {
          claves.add(`${metodo} ${ruta}`);
        }
      }
    }
  }

  return claves;
}

describe('cobertura de auditoria de rutas mutantes', () => {
  const descubiertas = rutasMutantesDescubiertas();

  it('descubre al menos una ruta mutante (la metadata se esta leyendo bien)', () => {
    expect(descubiertas.size).toBeGreaterThan(0);
  });

  it('ninguna ruta mutante queda sin auditar ni justificar', () => {
    const sinCubrir = [...descubiertas]
      .filter((clave) => !RUTAS_AUDITADAS.has(clave) && !RUTAS_EXCLUIDAS.has(clave))
      .sort();

    expect(sinCubrir).toEqual([]);
  });

  it('el registro no tiene rutas obsoletas (que ya no existan)', () => {
    const registradas = [...RUTAS_AUDITADAS, ...RUTAS_EXCLUIDAS.keys()];
    const obsoletas = registradas.filter((clave) => !descubiertas.has(clave)).sort();

    expect(obsoletas).toEqual([]);
  });

  it('ninguna ruta esta a la vez auditada y excluida', () => {
    const solapadas = [...RUTAS_AUDITADAS].filter((clave) => RUTAS_EXCLUIDAS.has(clave));

    expect(solapadas).toEqual([]);
  });
});
