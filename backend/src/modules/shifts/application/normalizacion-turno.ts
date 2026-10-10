// Normalizacion de los datos de un turno compartida por el alta y la edicion.
//
// Vive en aplicacion y no en dominio a proposito: valida y ademas traduce los
// problemas a respuestas 400 de la API (`BadRequestException`), cosa que una
// regla pura de dominio no deberia conocer.
import { BadRequestException } from '@nestjs/common';
import { $Enums } from '../../../generated/prisma/client';
import { diasSemanaDe, problemasDiasSemana } from '../domain/rules/dias-semana';

/** Convierte el texto de una hora en una hora valida o `null`. */
export function normalizarHora(valor: string | undefined): string | null {
  const texto = valor?.trim() ?? '';
  return texto === '' ? null : texto;
}

/**
 * Valida y normaliza los dias de un turno.
 *
 * Un turno fijo exige dias. Uno variable puede no tenerlos; si los trae se
 * validan igual. Se guarda siempre en forma canonica `1,2,3` (sin espacios).
 */
export function normalizarDiasSemana(
  valor: string | undefined,
  tipo: $Enums.TurnoTipo,
): string | null {
  const texto = valor?.trim() ?? '';

  if (texto === '') {
    if (tipo === 'fijo') {
      throw new BadRequestException({
        message: 'Los dias del turno no son validos',
        problemas: ['Un turno fijo debe indicar los dias de la semana'],
      });
    }
    return null;
  }

  const problemas = problemasDiasSemana(texto);
  if (problemas.length > 0) {
    throw new BadRequestException({
      message: 'Los dias del turno no son validos',
      problemas,
    });
  }

  return diasSemanaDe(texto).join(',');
}
