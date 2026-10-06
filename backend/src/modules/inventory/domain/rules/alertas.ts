// Regla de dominio: alertas de stock.
//
// Una alerta avisa de que un insumo de una sucursal está en o por debajo de su
// stock mínimo. No hay endpoint para resolverla a mano: se abre y se cierra
// sola, según lo que haga el stock, el mínimo o el estado. Estas funciones
// dicen QUÉ hay que hacer; quién y cuándo lo ejecuta es del caso de uso.
//
// Se evalúan dentro de la misma transacción que cambia el stock, el mínimo o el
// estado. Si no, una entrada que sube el stock podría resolver la alerta antes
// de que exista, o quedar una alerta abierta sobre un stock ya repuesto.

import { compararCantidades, type Cantidad } from './cantidades';

/** Estado de la fila `insumo_sucursal`. Espeja el enum de la base. */
export const ESTADOS_INSUMO_SUCURSAL = ['activo', 'descontinuado'] as const;
export type EstadoInsumoSucursal = (typeof ESTADOS_INSUMO_SUCURSAL)[number];

export function esInsumoActivo(estado: EstadoInsumoSucursal): boolean {
  return estado === 'activo';
}

/** Estado de una alerta. Espeja el enum de la base. */
export const ESTADOS_ALERTA = ['abierta', 'resuelta'] as const;
export type EstadoAlerta = (typeof ESTADOS_ALERTA)[number];

/** Situación sobre la que se decide, tal y como la ve el caso de uso. */
export type SituacionAlerta = {
  estado: EstadoInsumoSucursal;
  /** El `Decimal` de la base, el texto ya serializado o el numero del DTO. */
  stockActual: Cantidad;
  stockMinimo: Cantidad;
  /** true si ya hay una alerta ABIERTA para este insumo en esta sucursal. */
  hayAlertaAbierta: boolean;
};

/** true si el stock ha llegado al umbral o está por debajo de él. */
export function debeAvisar(p: SituacionAlerta): boolean {
  return compararCantidades(p.stockActual, p.stockMinimo) <= 0;
}

/**
 * true si hay que ABRIR una alerta.
 *
 * Solo cuando el insumo está activo y el stock ha llegado al mínimo. Si ya hay
 * una abierta no se abre otra: el índice único parcial de la base solo admite
 * una, y una segunda sería un error, no una mejora.
 *
 * Un insumo descontinuado no genera alertas aunque su stock esté a cero: ya no
 * se repone, así que no hay nada que avisar.
 */
export function debeAbrirAlerta(p: SituacionAlerta): boolean {
  return esInsumoActivo(p.estado) && debeAvisar(p) && !p.hayAlertaAbierta;
}

/**
 * true si hay que RESOLVER la alerta abierta.
 *
 * Se resuelve sola cuando el problema deja de existir: el stock sube por encima
 * del mínimo, o el insumo se descontinúa y ya no se repone. Con el stock
 * exactamente en el mínimo la alerta sigue abierta: `>=` todavía es un aviso.
 */
export function debeResolverAlerta(p: SituacionAlerta): boolean {
  if (!p.hayAlertaAbierta) {
    return false;
  }

  if (p.estado === 'descontinuado') {
    return true;
  }

  return compararCantidades(p.stockActual, p.stockMinimo) > 0;
}

/** Qué hacer con las alertas de un insumo tras un cambio. */
export type DecisionAlerta = {
  abrir: boolean;
  resolver: boolean;
};

/**
 * Decisión completa tras un cambio de stock, mínimo o estado.
 *
 * Las dos acciones nunca son true a la vez: abrir exige que no haya alerta
 * abierta, y resolver exige que la haya.
 */
export function evaluarAlerta(p: SituacionAlerta): DecisionAlerta {
  return {
    abrir: debeAbrirAlerta(p),
    resolver: debeResolverAlerta(p),
  };
}
