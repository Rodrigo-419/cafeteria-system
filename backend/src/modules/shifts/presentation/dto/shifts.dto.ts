// DTOs de la API de turnos y asignaciones.
import { Transform, type TransformFnParams, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { esFechaLocal } from '../../domain/fechas';

/** Tipos de turno admitidos. */
export const TIPOS_TURNO = ['fijo', 'variable'] as const;

/**
 * Recorta un texto; deja intacto lo que no sea string (undefined, null, ...).
 *
 * `@Transform` recibe los parametros de la transformacion, no el valor: con una
 * funcion que esperara el valor llegaria `{ value, key, obj, ... }`, que no es
 * string, y el campo entero dejaria de validar.
 */
const recortar = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Convierte un parametro de query (siempre texto) en numero. */
function numero() {
  return Type(() => Number);
}

/**
 * Convierte "true"/"false" de la query en booleano. Deja pasar cualquier otro
 * valor tal cual para que `@IsBoolean` lo rechace con su mensaje.
 */
const aBooleano = ({ value }: TransformFnParams): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

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

export class CrearTurnoDto {
  @IsOptional()
  @IsUUID('all', { message: 'La sucursal debe ser un identificador valido' })
  sucursalId?: string;

  @IsIn(TIPOS_TURNO, {
    message: `El tipo debe ser uno de: ${TIPOS_TURNO.join(', ')}`,
  })
  tipo: (typeof TIPOS_TURNO)[number];

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La hora de inicio debe ser texto' })
  horaInicio?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La hora de fin debe ser texto' })
  horaFin?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'Los dias de la semana deben ser texto' })
  diasSemana?: string;
}

export class ActualizarTurnoDto {
  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La hora de inicio debe ser texto' })
  horaInicio?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La hora de fin debe ser texto' })
  horaFin?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'Los dias de la semana deben ser texto' })
  diasSemana?: string;
}

export class ListarTurnosDto {
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
  @IsIn(TIPOS_TURNO, {
    message: `El filtro tipo debe ser uno de: ${TIPOS_TURNO.join(', ')}`,
  })
  tipo?: (typeof TIPOS_TURNO)[number];
}

export class CrearAsignacionDto {
  @IsUUID('all', { message: 'El empleado debe ser un identificador valido' })
  empleadoId: string;

  @IsUUID('all', { message: 'El turno debe ser un identificador valido' })
  turnoId: string;

  @EsFechaLocal()
  fechaInicio: string;

  @IsOptional()
  @EsFechaLocal()
  fechaFin?: string;
}

export class ListarAsignacionesDto {
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
    message: 'El filtro empleadoId debe ser un identificador valido',
  })
  empleadoId?: string;

  @IsOptional()
  @IsUUID('all', {
    message: 'El filtro turnoId debe ser un identificador valido',
  })
  turnoId?: string;

  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean({ message: 'El filtro vigente debe ser true o false' })
  vigente?: boolean;
}

export class RetirarAsignacionDto {
  @EsFechaLocal()
  fechaFin: string;
}
