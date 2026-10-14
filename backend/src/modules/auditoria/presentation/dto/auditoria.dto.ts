// DTOs de la API de auditoria.
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  AuditoriaAccion,
  AuditoriaEntidad,
} from '../../../../generated/prisma/client';

export const ENTIDADES_AUDITORIA = Object.values(AuditoriaEntidad);
export const ACCIONES_AUDITORIA = Object.values(AuditoriaAccion);

const PATRON_FECHA_LOCAL = /^\d{4}-\d{2}-\d{2}$/u;

export class ListarAuditoriaDto {
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
  @IsUUID('all', { message: 'El filtro actorId debe ser un identificador valido' })
  actorId?: string;

  @IsOptional()
  @IsIn(ENTIDADES_AUDITORIA, {
    message: `El filtro entidad debe ser uno de: ${ENTIDADES_AUDITORIA.join(', ')}`,
  })
  entidad?: (typeof ENTIDADES_AUDITORIA)[number];

  @IsOptional()
  @IsUUID('all', { message: 'El filtro entidadId debe ser un identificador valido' })
  entidadId?: string;

  @IsOptional()
  @IsIn(ACCIONES_AUDITORIA, {
    message: `El filtro accion debe ser una accion valida`,
  })
  accion?: (typeof ACCIONES_AUDITORIA)[number];

  @IsOptional()
  @IsUUID('all', { message: 'El filtro sucursalId debe ser un identificador valido' })
  sucursalId?: string;

  @IsOptional()
  @Matches(PATRON_FECHA_LOCAL, {
    message: 'La fecha "desde" debe tener el formato YYYY-MM-DD',
  })
  desde?: string;

  @IsOptional()
  @Matches(PATRON_FECHA_LOCAL, {
    message: 'La fecha "hasta" debe tener el formato YYYY-MM-DD',
  })
  hasta?: string;
}

export class HistorialUsuarioDto {
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
}
