// DTOs de las ofertas de producto por sucursal (la "carta").
import {
  IsIn,
  IsNumber,
  IsOptional,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { ESTADOS_OFERTA, problemasPrecio } from '../products.rules';

/**
 * Valida el precio con la regla pura de `products.rules`.
 *
 * Se escribe a mano en vez de usar `@IsNumber({ maxDecimalPlaces: 2 })` porque
 * esa opcion de class-validator mide los decimales con
 * `valor.toString().split('.')[1].length`, y para un numero en notacion
 * exponencial ese elemento es `undefined`: `{"precio": 1e-7}` revienta con un
 * TypeError (500) en vez de responder 400. Aqui se delega en la regla pura, que
 * ya trata ese caso sin lanzar.
 *
 * `@IsNumber` se mantiene ademas para que el mensaje por defecto sea el habitual
 * de la API cuando el campo no es un numero.
 */
export function IsPrecioValido(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'precioValido',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate: (valor: unknown) => problemasPrecio(valor).length === 0,
        defaultMessage: (args: ValidationArguments) =>
          problemasPrecio(args.value).join('. '),
      },
    });
  };
}

export class UpsertOfertaDto {
  @IsPrecioValido()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'El precio debe ser un numero' },
  )
  precio: number;

  @IsOptional()
  @IsIn(ESTADOS_OFERTA, {
    message: `El estado debe ser uno de: ${ESTADOS_OFERTA.join(', ')}`,
  })
  estado?: (typeof ESTADOS_OFERTA)[number];
}

export class ListarCartaDto {
  @IsOptional()
  @IsIn(ESTADOS_OFERTA, {
    message: `El filtro estado debe ser uno de: ${ESTADOS_OFERTA.join(', ')}`,
  })
  estado?: (typeof ESTADOS_OFERTA)[number];
}
