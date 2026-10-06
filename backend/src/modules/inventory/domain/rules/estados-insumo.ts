// Regla de dominio: estados del inventario.
//
// Los enums viven en la base, pero aqui se redeclaran como texto plano para que
// las reglas y los DTO no dependan de Prisma y se puedan probar sin cargar el
// cliente generado. `INVENTARIO_ENUMS_DE_BASE` comprueba en tiempo de
// compilacion que las dos listas no se desincronicen.

/** Estado de la fila `insumo_sucursal` dentro de una sucursal. */
export const ESTADOS_INSUMO_SUCURSAL = ['activo', 'descontinuado'] as const;
export type EstadoStockInsumo = (typeof ESTADOS_INSUMO_SUCURSAL)[number];

/** Tipo de movimiento: una entrada suma, un ajuste corrige. */
export const TIPOS_MOVIMIENTO_INVENTARIO = ['entrada', 'ajuste'] as const;
export type TipoMovimientoInventario = (typeof TIPOS_MOVIMIENTO_INVENTARIO)[number];

/** Estado de una alerta de stock. */
export const ESTADOS_ALERTA_STOCK = ['abierta', 'resuelta'] as const;
export type EstadoAlertaStock = (typeof ESTADOS_ALERTA_STOCK)[number];

/** true si el estado es un valor admitido. */
export function esEstadoStockInsumo(valor: string): valor is EstadoStockInsumo {
  return (ESTADOS_INSUMO_SUCURSAL as readonly string[]).includes(valor);
}
