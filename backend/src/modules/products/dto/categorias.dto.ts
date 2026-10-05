// DTOs de categorias de producto.
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export const LARGO_NOMBRE_CATEGORIA = {
  min: 2,
  max: 80,
} as const;

/** Recorta un string; deja intacto lo que no sea string (undefined, null, ...). */
export const recortarTexto = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CrearCategoriaDto {
  @Transform(recortarTexto)
  @IsString({ message: 'El nombre es obligatorio' })
  @MinLength(LARGO_NOMBRE_CATEGORIA.min, {
    message: `El nombre debe tener al menos ${LARGO_NOMBRE_CATEGORIA.min} caracteres`,
  })
  @MaxLength(LARGO_NOMBRE_CATEGORIA.max, {
    message: `El nombre no puede exceder ${LARGO_NOMBRE_CATEGORIA.max} caracteres`,
  })
  nombre: string;
}

export class ActualizarCategoriaDto {
  @Transform(recortarTexto)
  @IsString({ message: 'El nombre debe ser texto' })
  @MinLength(LARGO_NOMBRE_CATEGORIA.min, {
    message: `El nombre debe tener al menos ${LARGO_NOMBRE_CATEGORIA.min} caracteres`,
  })
  @MaxLength(LARGO_NOMBRE_CATEGORIA.max, {
    message: `El nombre no puede exceder ${LARGO_NOMBRE_CATEGORIA.max} caracteres`,
  })
  nombre: string;
}
