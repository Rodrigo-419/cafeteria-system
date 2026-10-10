// DTOs de la API de personal.
import { Transform, type TransformFnParams, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { esFechaLocal } from '../../domain/fechas';

const CARGO_MAXIMO = 100;
const BUSQUEDA_MAXIMA = 100;

/** Estados en los que puede estar un empleado. */
export const ESTADOS_EMPLEADO = ['activo', 'inactivo'] as const;

/**
 * Recorta un texto; deja intacto lo que no sea string (undefined, null, ...).
 *
 * `@Transform` recibe los parametros de la transformacion, no el valor: con una
 * funcion que esperara el valor llegarian `{ value, key, obj, ... }`, que no es
 * string, y el campo entero dejaria de validar.
 */
const recortar = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Convierte un parametro de query (siempre texto) en numero. */
function numero() {
  return Type(() => Number);
}

/**
 * Valida un dia local con la regla pura de `fechas`.
 *
 * `@Matches(/^\d{4}-\d{2}-\d{2}$/)` no basta: aceptaria `2026-02-30`, y un dia
 * que no existe filtraria un rango vacio en vez de responder 400.
 */
function EsFechaLocal(validationOptions?: ValidationOptions) {
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

export class CrearEmpleadoDto {
  @IsUUID('all', { message: 'usuarioId debe ser un identificador valido' })
  usuarioId: string;

  @Transform(recortar)
  @IsString({ message: 'El cargo debe ser texto' })
  @MinLength(1, { message: 'El cargo no puede estar vacio' })
  @MaxLength(CARGO_MAXIMO, {
    message: `El cargo no puede exceder ${CARGO_MAXIMO} caracteres`,
  })
  cargo: string;

  @EsFechaLocal()
  fechaContratacion: string;

  @IsOptional()
  @IsUUID('all', {
    message: 'La sucursal debe ser un identificador valido',
  })
  sucursalId?: string;
}

export class ActualizarEmpleadoDto {
  @Transform(recortar)
  @IsString({ message: 'El cargo debe ser texto' })
  @MinLength(1, { message: 'El cargo no puede estar vacio' })
  @MaxLength(CARGO_MAXIMO, {
    message: `El cargo no puede exceder ${CARGO_MAXIMO} caracteres`,
  })
  cargo: string;
}

export class CesarEmpleadoDto {
  @IsOptional()
  @EsFechaLocal()
  fechaCese?: string;
}

export class ListarEmpleadosDto {
  @IsOptional()
  @numero()
  @IsInt({ message: 'page debe ser un entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number;

  @IsOptional()
  @numero()
  @IsInt({ message: 'limit debe ser un entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(100, { message: 'limit no puede exceder 100' })
  limit?: number;

  @IsOptional()
  @IsUUID('all', {
    message: 'El filtro sucursalId debe ser un identificador valido',
  })
  sucursalId?: string;

  @IsOptional()
  @IsIn(ESTADOS_EMPLEADO, {
    message: `El filtro estado debe ser uno de: ${ESTADOS_EMPLEADO.join(', ')}`,
  })
  estado?: (typeof ESTADOS_EMPLEADO)[number];

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La busqueda debe ser texto' })
  @MaxLength(BUSQUEDA_MAXIMA, {
    message: `La busqueda no puede exceder ${BUSQUEDA_MAXIMA} caracteres`,
  })
  q?: string;
}
