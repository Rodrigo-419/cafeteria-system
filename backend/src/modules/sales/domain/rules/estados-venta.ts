// Estados y condiciones de la venta y de la oferta sobre la que se vende.
//
// Se redeclaran aqui como texto plano para que las reglas puras y los DTO no
// dependan de Prisma. `sales.repository.ts` comprueba, con el mismo truco de
// tipos que usa el modulo de inventario, que estos conjuntos siguen siendo
// identicos a los enums de la base: si alguien anade un valor a uno de los dos
// lados y olvida el otro, el `build` falla en vez de dejar una venta que la
// base va a rechazar en el ultimo momento.

/** Formas de pago admitidas. Solo registro: no se procesa ningun cobro real. */
export const METODOS_PAGO_VENTA = ['efectivo', 'tarjeta'] as const;
export type MetodoPagoVenta = (typeof METODOS_PAGO_VENTA)[number];

/** Estados en los que puede estar una venta. */
export const ESTADOS_VENTA = ['completada', 'anulada'] as const;
export type EstadoVenta = (typeof ESTADOS_VENTA)[number];

/**
 * Estados posibles de una oferta (`producto_sucursal_variante`).
 *
 * Es el mismo enum que usa el modulo de productos. Se copia aqui porque una
 * oferta inactiva no se puede vender, y esa condicion es una regla de las
 * ventas, no un detalle de la carta.
 */
export const ESTADOS_OFERTA_VENTA = ['activo', 'inactivo'] as const;
export type EstadoOfertaVenta = (typeof ESTADOS_OFERTA_VENTA)[number];

/** Unica oferta sobre la que se puede registrar una venta. */
export const OFERTA_VENTA_ACTIVA: EstadoOfertaVenta = 'activo';

/** true si el texto es un metodo de pago admitido. */
export function esMetodoPagoVenta(valor: unknown): valor is MetodoPagoVenta {
  return (
    typeof valor === 'string' &&
    (METODOS_PAGO_VENTA as readonly string[]).includes(valor)
  );
}

/** true si el texto es un estado de venta admitido. */
export function esEstadoVenta(valor: unknown): valor is EstadoVenta {
  return (
    typeof valor === 'string' && (ESTADOS_VENTA as readonly string[]).includes(valor)
  );
}

/** true si la oferta esta en un estado sobre el que se puede vender. */
export function esOfertaVentaActiva(valor: unknown): boolean {
  return valor === OFERTA_VENTA_ACTIVA;
}
