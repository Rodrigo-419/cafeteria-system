// DTOs de variantes de producto.
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { recortarTexto } from './categorias.dto';

export const LARGO_NOMBRE_VARIANTE = {
  min: 2,
  max: 80,
} as const;

export class CrearVarianteDto {
  @Transform(recortarTexto)
  @IsString({ message: 'El nombre es obligatorio' })
  @MinLength(LARGO_NOMBRE_VARIANTE.min, {
    message: `El nombre debe tener al menos ${LARGO_NOMBRE_VARIANTE.min} caracteres`,
  })
  @MaxLength(LARGO_NOMBRE_VARIANTE.max, {
    message: `El nombre no puede exceder ${LARGO_NOMBRE_VARIANTE.max} caracteres`,
  })
  nombre: string;
}

export class ActualizarVarianteDto {
  @Transform(recortarTexto)
  @IsString({ message: 'El nombre debe ser texto' })
  @MinLength(LARGO_NOMBRE_VARIANTE.min, {
    message: `El nombre debe tener al menos ${LARGO_NOMBRE_VARIANTE.min} caracteres`,
  })
  @MaxLength(LARGO_NOMBRE_VARIANTE.max, {
    message: `El nombre no puede exceder ${LARGO_NOMBRE_VARIANTE.max} caracteres`,
  })
  nombre: string;
}
