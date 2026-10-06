// DTOs de la API de ventas.
import { Transform, type TransformFnParams, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import { esFechaLocal } from '../../domain/rules/fechas';
import {
  ESTADOS_VENTA,
  METODOS_PAGO_VENTA,
} from '../../domain/rules/estados-venta';
import {
  MAXIMO_CANTIDAD,
  MAXIMO_LINEAS_VENTA,
  MINIMO_CANTIDAD,
} from '../../domain/rules/lineas-venta';

const MOTIVO_MAXIMO = 200;

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

export class LineaVentaDto {
  @IsUUID('all', { message: 'Cada linea debe indicar una oferta valida' })
  productoSucursalVarianteId: string;

  @IsInt({ message: 'La cantidad debe ser un numero entero' })
  @Min(MINIMO_CANTIDAD, {
    message: `La cantidad minima es ${MINIMO_CANTIDAD}`,
  })
  @Max(MAXIMO_CANTIDAD, {
    message: `La cantidad maxima es ${MAXIMO_CANTIDAD}`,
  })
  cantidad: number;
}

export class RegistrarVentaDto {
  @IsIn(METODOS_PAGO_VENTA, {
    message: `El metodo de pago debe ser uno de: ${METODOS_PAGO_VENTA.join(', ')}`,
  })
  metodoPago: (typeof METODOS_PAGO_VENTA)[number];

  @IsArray({ message: 'items debe ser una lista' })
  @ArrayMinSize(1, { message: 'La venta debe incluir al menos un producto' })
  @ArrayMaxSize(MAXIMO_LINEAS_VENTA, {
    message: `Una venta no puede incluir mas de ${MAXIMO_LINEAS_VENTA} lineas`,
  })
  @ValidateNested({ each: true })
  @Type(() => LineaVentaDto)
  items: LineaVentaDto[];
}

export class AnularVentaDto {
  @Transform(recortar)
  @IsString({ message: 'El motivo debe ser texto' })
  @MinLength(1, { message: 'El motivo de la anulacion no puede estar vacio' })
  @MaxLength(MOTIVO_MAXIMO, {
    message: `El motivo no puede exceder ${MOTIVO_MAXIMO} caracteres`,
  })
  motivo: string;
}

export class ListarVentasDto {
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
  @IsUUID('all', { message: 'El filtro sucursalId debe ser un identificador valido' })
  sucursalId?: string;

  @IsOptional()
  @IsIn(ESTADOS_VENTA, {
    message: `El filtro estado debe ser uno de: ${ESTADOS_VENTA.join(', ')}`,
  })
  estado?: (typeof ESTADOS_VENTA)[number];

  @IsOptional()
  @IsIn(METODOS_PAGO_VENTA, {
    message: `El filtro metodoPago debe ser uno de: ${METODOS_PAGO_VENTA.join(', ')}`,
  })
  metodoPago?: (typeof METODOS_PAGO_VENTA)[number];

  @IsOptional()
  @EsFechaLocal()
  fecha?: string;
}
