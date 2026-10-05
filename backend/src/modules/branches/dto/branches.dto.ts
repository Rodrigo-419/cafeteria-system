// DTOs de la API de sucursales.
//
// Los tres campos de texto se recortan con `@Transform` ANTES de validarse. No es
// cosmetico: sin eso, `MinLength` y `MaxLength` medirian la cadena con sus
// espacios, y `"  A  "` pasaria el minimo de 2 caracteres aunque al guardarse
// quede como "A", que es de 1.
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Recorta un string; deja intacto lo que no sea string (undefined, null, ...). */
const recortar = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CrearSucursalDto {
  @Transform(recortar)
  @IsString({ message: 'El nombre es obligatorio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre: string;

  @Transform(recortar)
  @IsString({ message: 'La direccion es obligatoria' })
  @MinLength(1, { message: 'La direccion no puede estar vacia' })
  @MaxLength(200, { message: 'La direccion no puede exceder 200 caracteres' })
  direccion: string;

  // `null` se acepta ademas de "ausente": asi un PATCH puede dejar el campo en
  // null (sin telefono) en vez de tener que inventar un texto vacio.
  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'El telefono debe ser texto' })
  @MaxLength(30, { message: 'El telefono no puede exceder 30 caracteres' })
  telefono?: string | null;
}

export class ActualizarSucursalDto {
  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'El nombre debe ser texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'La direccion debe ser texto' })
  @MinLength(1, { message: 'La direccion no puede estar vacia' })
  @MaxLength(200, { message: 'La direccion no puede exceder 200 caracteres' })
  direccion?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString({ message: 'El telefono debe ser texto' })
  @MaxLength(30, { message: 'El telefono no puede exceder 30 caracteres' })
  telefono?: string | null;
}
