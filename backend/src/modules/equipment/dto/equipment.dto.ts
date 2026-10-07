import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import type { TransformFnParams } from 'class-transformer';

const recortar = (params: TransformFnParams): unknown => {
  const valor = params.value;
  if (typeof valor === 'string') {
    return valor.trim();
  }
  return valor;
};

export const ESTADOS_EQUIPO = [
  'funcionando',
  'danado',
  'en_mantenimiento',
  'retirado',
] as const;

export type EstadoEquipoDto = (typeof ESTADOS_EQUIPO)[number];

export class CrearEquipoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  @Transform(recortar)
  sucursalId: string;

  @ApiProperty({ minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(recortar)
  nombre: string;

  @ApiProperty({ minLength: 2, maxLength: 50 })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(recortar)
  tipo: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(recortar)
  observaciones?: string;
}

export class ActualizarEquipoDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(recortar)
  nombre?: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(recortar)
  tipo?: string;

  @ApiPropertyOptional({ enum: ESTADOS_EQUIPO })
  @IsOptional()
  @IsIn(ESTADOS_EQUIPO)
  @Transform(recortar)
  estado?: EstadoEquipoDto;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(recortar)
  observaciones?: string;
}

export class FiltrosEquiposDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all')
  @Transform(recortar)
  sucursalId?: string;

  @ApiPropertyOptional({ enum: ESTADOS_EQUIPO })
  @IsOptional()
  @IsIn(ESTADOS_EQUIPO)
  @Transform(recortar)
  estado?: EstadoEquipoDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(recortar)
  busqueda?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class FiltrosHistorialEquipoDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
