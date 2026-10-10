// Regla de dominio: dias de la semana de un turno.
//
// Se representan con el numero ISO (1 = lunes ... 7 = domingo) en un texto
// separado por comas, por ejemplo "1,2,3,4,5". El formato es estricto a
// proposito: sin repetidos y en orden ascendente, de modo que "3,1" o "1,1"
// sean un error de la peticion y no dos formas de escribir el mismo turno.

export const DIAS_SEMANA_MINIMO = 1;
export const DIAS_SEMANA_MAXIMO = 7;

/**
 * Lista de dias a partir del texto almacenado. Vacia si no hay texto.
 *
 * No valida: asume lo que ya se comprobo con `problemasDiasSemana` al guardar.
 */
export function diasSemanaDe(valor: string | null): number[] {
  if (valor === null || valor.trim() === '') {
    return [];
  }

  return valor.split(',').map((parte) => Number(parte));
}

/** Problemas de formato de `diasSemana`. Lista vacia si el texto es valido. */
export function problemasDiasSemana(valor: string): string[] {
  const recortado = valor.trim();
  if (recortado === '') {
    return ['diasSemana no puede estar vacio'];
  }

  const dias: number[] = [];
  const problemas: string[] = [];

  for (const parte of recortado.split(',')) {
    const limpio = parte.trim();
    if (!/^\d+$/u.test(limpio)) {
      problemas.push(`"${parte}" no es un numero de dia valido`);
      continue;
    }

    const dia = Number(limpio);
    if (dia < DIAS_SEMANA_MINIMO || dia > DIAS_SEMANA_MAXIMO) {
      problemas.push(`El dia ${dia} esta fuera del rango 1-7`);
      continue;
    }

    dias.push(dia);
  }

  if (problemas.length > 0) {
    return problemas;
  }

  if (new Set(dias).size !== dias.length) {
    problemas.push('Los dias de la semana no se pueden repetir');
  }

  for (let indice = 1; indice < dias.length; indice += 1) {
    if (dias[indice] <= dias[indice - 1]) {
      problemas.push('Los dias de la semana deben venir en orden ascendente');
      break;
    }
  }

  return problemas;
}

/** true si dos turnos comparten al menos un dia de la semana. */
export function diasSeCruzan(a: string | null, b: string | null): boolean {
  const diasA = new Set(diasSemanaDe(a));
  if (diasA.size === 0) {
    return false;
  }

  return diasSemanaDe(b).some((dia) => diasA.has(dia));
}
