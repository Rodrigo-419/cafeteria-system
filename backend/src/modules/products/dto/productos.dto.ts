// DTOs de productos del catalogo global.
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { recortarTexto } from './categorias.dto';

export const LARGO_NOMBRE_PRODUCTO = {
  min: 2,
  max: 100,
} as const;

export const LARGO_DESCRIPCION_PRODUCTO = 300;

export class CrearProductoDto {
  @Transform(recortarTexto)
  @IsString({ message: 'El nombre es obligatorio' })
  @MinLength(LARGO_NOMBRE_PRODUCTO.min, {
    message: `El nombre debe tener al menos ${LARGO_NOMBRE_PRODUCTO.min} caracteres`,
  })
  @MaxLength(LARGO_NOMBRE_PRODUCTO.max, {
    message: `El nombre no puede exceder ${LARGO_NOMBRE_PRODUCTO.max} caracteres`,
  })
  nombre: string;

  @IsUUID('all', { message: 'La categoria debe ser un identificador valido' })
  categoriaId: string;

  @IsOptional()
  @Transform(recortarTexto)
  @IsString({ message: 'La descripcion debe ser texto' })
  @MaxLength(LARGO_DESCRIPCION_PRODUCTO, {
    message: `La descripcion no puede exceder ${LARGO_DESCRIPCION_PRODUCTO} caracteres`,
  })
  descripcion?: string | null;
}

export class ActualizarProductoDto {
  @IsOptional()
  @Transform(recortarTexto)
  @IsString({ message: 'El nombre debe ser texto' })
  @MinLength(LARGO_NOMBRE_PRODUCTO.min, {
    message: `El nombre debe tener al menos ${LARGO_NOMBRE_PRODUCTO.min} caracteres`,
  })
  @MaxLength(LARGO_NOMBRE_PRODUCTO.max, {
    message: `El nombre no puede exceder ${LARGO_NOMBRE_PRODUCTO.max} caracteres`,
  })
  nombre?: string;

  @IsOptional()
  @IsUUID('all', { message: 'La categoria debe ser un identificador valido' })
  categoriaId?: string;

  @IsOptional()
  @Transform(recortarTexto)
  @IsString({ message: 'La descripcion debe ser texto' })
  @MaxLength(LARGO_DESCRIPCION_PRODUCTO, {
    message: `La descripcion no puede exceder ${LARGO_DESCRIPCION_PRODUCTO} caracteres`,
  })
  descripcion?: string | null;
}

export class ListarProductosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(100, { message: 'limit no puede exceder 100' })
  limit?: number;

  @IsOptional()
  @IsUUID('all', { message: 'El filtro categoriaId debe ser un identificador valido' })
  categoriaId?: string;

  @IsOptional()
  @Transform(recortarTexto)
  @IsString()
  @MaxLength(100, { message: 'La busqueda no puede exceder 100 caracteres' })
  q?: string;
}
