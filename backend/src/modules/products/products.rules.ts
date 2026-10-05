// Reglas de dominio de productos: alcance para ver y editar precios, estados
// visibles por rol, normalizacion de nombres y validacion del precio.
//
// Funciones puras, sin Nest ni Prisma. El servicio y los repositorios las
// consultan; las pruebas las ejercitan solas.

import { esAdmin, esEmpleado, esGerente } from '../users/domain/roles';

/**
 * Variante base del sistema: la que representa "un producto sin tamanos".
 * El seed la crea y el catalogo la usa para productos simples. No se puede
 * renombrar ni borrar porque el resto del catalogo depende de ella.
 */
export const NOMBRE_VARIANTE_BASE = 'Única';

export const PRECIO_MINIMO = 0.01;
export const PRECIO_MAXIMO = 100000;
export const PRECIO_DECIMALES = 2;

/** Estados posibles de una oferta de producto en una sucursal. */
export const ESTADOS_OFERTA = ['activo', 'inactivo'] as const;
export type EstadoOferta = (typeof ESTADOS_OFERTA)[number];

/** Identificador imposible, para cuando a un actor no le queda nada visible. */
export const SIN_ALCANCE = '__sin_alcance__';

/**
 * Recorte minimo del actor que necesitan estas reglas. No incluye los permisos
 * efectivos: el `PermissionsGuard` ya exigio `productos.ver` o
 * `productos.precio.editar` antes de que se llegue aqui.
 */
export type ActorProductos = {
  id: string;
  rol: string | null;
  sucursalId: string | null;
};

/**
 * true si el actor puede ver los precios de la sucursal indicada.
 *
 * El Admin ve todas porque es central; un Gerente o un Empleado, solo la suya.
 * Cualquier otro rol no ve nada.
 */
export function puedeVerPrecios(
  actor: ActorProductos,
  sucursalId: string,
): boolean {
  if (esAdmin(actor.rol)) {
    return true;
  }

  if (!esGerente(actor.rol) && !esEmpleado(actor.rol)) {
    return false;
  }

  return actor.sucursalId !== null && actor.sucursalId === sucursalId;
}

/**
 * true si el actor puede crear o modificar precios en la sucursal indicada.
 *
 * Solo el Gerente, y solo en su propia sucursal. El Admin NO puede: el permiso
 * `productos.precio.editar` no esta en su rol, asi que el guard ya le responde
 * 403 antes de llegar aqui. La regla lo mantiene fuera igualmente, para que no
 * dependa de que ese permiso se mantenga asi.
 *
 * Un Gerente que pide otra sucursal recibe 404, no 403: no se le revela que
 * existen precios ajenos.
 */
export function puedeEditarPrecios(
  actor: ActorProductos,
  sucursalId: string,
): boolean {
  if (!esGerente(actor.rol)) {
    return false;
  }

  return actor.sucursalId !== null && actor.sucursalId === sucursalId;
}

/**
 * Estados de oferta que el rol puede ver en la carta de una sucursal.
 *
 * El Empleado solo ve lo activo: no necesita saber que un producto esta
 * retirado. Admin y Gerente ven los dos, que es lo que necesitan para
 * reactivarlo. Un rol desconocido no ve ninguno.
 */
export function estadosVisiblesPorRol(
  rol: string | null | undefined,
): EstadoOferta[] {
  if (esAdmin(rol) || esGerente(rol)) {
    return ['activo', 'inactivo'];
  }

  if (esEmpleado(rol)) {
    return ['activo'];
  }

  return [];
}

/**
 * Filtro de estado pedido por el cliente, recortado a lo que el rol puede ver.
 *
 * Si el cliente pide un estado que su rol no puede ver, la interseccion queda
 * vacia y el listado no devuelve filas, en vez de saltarse el filtro.
 */
export function estadosVisiblesConFiltro(params: {
  rol: string | null | undefined;
  filtro?: EstadoOferta;
}): EstadoOferta[] {
  const permitidos = estadosVisiblesPorRol(params.rol);

  if (params.filtro === undefined) {
    return permitidos;
  }

  return permitidos.filter((e) => e === params.filtro);
}

/** true si el nombre corresponde a la variante base del sistema. */
export function esVarianteBase(nombre: string): boolean {
  return mismoNombre(nombre, NOMBRE_VARIANTE_BASE);
}

/**
 * Forma en la que se comparan dos nombres de catalogo: sin espacios en los
 * extremos, separaciones internas reducidas a una y sin mayusculas.
 */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/gu, ' ').toLowerCase();
}

/** true si dos nombres son el mismo a efectos de unicidad. */
export function mismoNombre(a: string, b: string): boolean {
  return normalizarNombre(a) === normalizarNombre(b);
}

/**
 * true si el numero tiene mas de dos decimales.
 *
 * No se usa `toString().split('.')[1].length` a proposito: para un numero en
 * notacion exponencial ese `[1]` es `undefined` y revienta. Aqui se mide la
 * parte fraccionaria sobre la representacion decimal, que es la unica que
 * puede aparecer dentro del rango de precios que se acepta.
 */
export function tieneMasDeDosDecimales(valor: number): boolean {
  const texto = valor.toString();

  const punto = texto.indexOf('.');
  if (punto === -1) {
    return false;
  }

  return texto.length - punto - 1 > PRECIO_DECIMALES;
}

/**
 * Lista de problemas del precio; vacia significa que es valido.
 *
 * @returns mensajes en Castellano, listos para un 400.
 */
export function problemasPrecio(valor: unknown): string[] {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return ['El precio debe ser un numero'];
  }

  const problemas: string[] = [];

  if (valor < PRECIO_MINIMO || valor > PRECIO_MAXIMO) {
    problemas.push(
      `El precio debe estar entre ${PRECIO_MINIMO} y ${PRECIO_MAXIMO}`,
    );
  }

  if (tieneMasDeDosDecimales(valor)) {
    problemas.push('El precio no puede tener mas de 2 decimales');
  }

  return problemas;
}

/** true si el precio es valido. */
export function esPrecioValido(valor: unknown): valor is number {
  return problemasPrecio(valor).length === 0;
}

/**
 * Convierte un precio ya validado al texto exacto que espera la columna
 * `Decimal(10,2)`.
 *
 * Se serializa a texto en vez de dejar que Prisma convierta el `number`: asi el
 * valor que llega a la base no arrastra el error de representacion binaria de un
 * decimal.
 */
export function precioATextoDecimal(precio: number): string {
  return precio.toFixed(PRECIO_DECIMALES);
}
