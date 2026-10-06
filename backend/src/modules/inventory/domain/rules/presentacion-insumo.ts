// Regla de dominio: presentacion de un insumo.
//
// La lista sale del enum de la base, pero se declara aqui como texto plano para
// que estas reglas no dependan de Prisma y se puedan probar sin cargar el
// cliente generado. `INVENTARIO_INFRAESTRUCTURA_ENUMS` comprueba en tiempo de
// compilacion que los dos no se desincronicen.
//
// Se valida aqui para que el mensaje de error sea uno solo y para que ningun caso
// de uso tenga que repetirlo.
import { BadRequestException } from '@nestjs/common';

/** Valores admitidos, en el orden en que se muestran al usuario. */
export const PRESENTACIONES_INSUMO = [
  'paquete',
  'bolsa',
  'caja',
  'unidad',
  'paquete_varias_unidades',
] as const;

export type PresentacionInsumo = (typeof PRESENTACIONES_INSUMO)[number];

/** true si el texto es una presentacion valida. */
export function esPresentacionInsumo(valor: string): valor is PresentacionInsumo {
  return (PRESENTACIONES_INSUMO as readonly string[]).includes(valor);
}

/**
 * Valida la presentacion y la devuelve ya tipada.
 *
 * @throws BadRequestException (400) con la lista de valores admitidos.
 */
export function validarPresentacionInsumo(valor: string): PresentacionInsumo {
  if (!esPresentacionInsumo(valor)) {
    throw new BadRequestException(
      `La presentacion debe ser una de: ${PRESENTACIONES_INSUMO.join(', ')}`,
    );
  }

  return valor;
}
