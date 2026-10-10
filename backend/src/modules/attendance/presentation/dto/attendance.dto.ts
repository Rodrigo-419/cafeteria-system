// DTOs de la API de asistencia.
import { Transform, type TransformFnParams, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { esFechaLocal } from '../../domain/fechas';

/** Tipos de marcacion admitidos. Coinciden con el enum de la base. */
export const TIPOS_MARCAJE = ['entrada', 'salida'] as const;

/** Recorta un texto; deja intacto lo que no sea string. */
const recortar = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Convierte un parametro de query (siempre texto) en numero. */
function numero() {
  return Type(() => Number);
}

/** Convierte "true"/"false" de la query en booleano. Deja pasar lo demas. */
const aBooleano = ({ value }: TransformFnParams): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

/** Valida un dia local con la regla pura de `fechas`. */
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

export class MarcarAsistenciaDto {
  @IsUUID('all', { message: 'El empleado debe ser un identificador valido' })
  empleadoId: string;

  @IsIn(TIPOS_MARCAJE, {
    message: `El tipo debe ser uno de: ${TIPOS_MARCAJE.join(', ')}`,
  })
  tipo: (typeof TIPOS_MARCAJE)[number];

  @Transform(recortar)
  @Matches(/^\d{6}$/u, { message: 'El PIN debe tener 6 digitos' })
  pin: string;

  /**
   * La hora la pone el servidor y solo el: se acepta para tolerar clientes que
   * intenten mandarla, pero la marcacion nunca la usa. No hay forma de que el
   * cliente fije su instante.
   */
  @IsOptional()
  @IsISO8601({}, { message: 'La fecha debe tener formato ISO 8601' })
  fechaHora?: string;
}

export class CorregirRegistroDto {
  @Transform(recortar)
  @IsString({ message: 'El motivo debe ser texto' })
  @MinLength(1, { message: 'El motivo no puede estar vacio' })
  @MaxLength(200, { message: 'El motivo no puede superar 200 caracteres' })
  motivo: string;

  @IsISO8601({}, { message: 'La fecha y hora debe tener formato ISO 8601' })
  fechaHora: string;

  @IsOptional()
  @IsIn(TIPOS_MARCAJE, {
    message: `El tipo debe ser uno de: ${TIPOS_MARCAJE.join(', ')}`,
  })
  tipo?: (typeof TIPOS_MARCAJE)[number];
}

export class JustificarFaltaDto {
  @IsUUID('all', { message: 'El empleado debe ser un identificador valido' })
  empleadoId: string;

  @EsFechaLocal()
  fecha: string;

  @Transform(recortar)
  @IsString({ message: 'El motivo debe ser texto' })
  @MinLength(1, { message: 'El motivo no puede estar vacio' })
  @MaxLength(200, { message: 'El motivo no puede superar 200 caracteres' })
  motivo: string;
}

export class ListarRegistrosDto {
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
    message: 'El filtro sucursalId debe ser un identificador valido',
  })
  sucursalId?: string;

  @IsOptional()
  @EsFechaLocal()
  desde?: string;

  @IsOptional()
  @EsFechaLocal()
  hasta?: string;

  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean({ message: 'El filtro abierta debe ser true o false' })
  abierta?: boolean;
}

export class ListarFaltasDto {
  @EsFechaLocal()
  desde: string;

  @EsFechaLocal()
  hasta: string;

  @IsOptional()
  @IsUUID('all', {
    message: 'El filtro empleadoId debe ser un identificador valido',
  })
  empleadoId?: string;

  @IsOptional()
  @IsUUID('all', {
    message: 'El filtro sucursalId debe ser un identificador valido',
  })
  sucursalId?: string;
}