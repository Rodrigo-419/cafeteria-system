// DTOs de la API de reportes.
import {
  IsOptional,
  IsUUID,
  registerDecorator,
  ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { esFechaLocal } from '../../../sales/domain/rules/fechas';

/**
 * Valida un dia local `YYYY-MM-DD` con la regla pura de `fechas`.
 *
 * Se declara aqui en vez de reutilizar el decorador de asistencia para no atar
 * la presentacion de reportes a la de otro modulo.
 */
export function EsFechaLocal(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'fechaLocal',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate: (valor: unknown) => esFechaLocal(valor),
        defaultMessage: (_args: ValidationArguments) =>
          'La fecha debe ser un dia valido en formato YYYY-MM-DD',
      },
    });
  };
}

export class ReporteComparativoQueryDto {
  @EsFechaLocal()
  desde: string;

  @EsFechaLocal()
  hasta: string;

  @IsOptional()
  @IsUUID('all', {
    message: 'El filtro sucursalId debe ser un identificador valido',
  })
  sucursalId?: string;
}
