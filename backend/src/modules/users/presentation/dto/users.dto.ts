// DTOs de la API de usuarios.
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  LONGITUD_MAXIMA_NOMBRE_USUARIO,
  LONGITUD_MINIMA_NOMBRE_USUARIO,
  normalizarNombreUsuario,
  PATRON_NOMBRE_USUARIO,
} from '../../../auth/domain/rules/nombre-usuario';
import { NOMBRES_ROL } from '../../domain/roles';

export const ESTADOS_USUARIO = ['activo', 'bloqueado'] as const;
export type EstadoUsuario = (typeof ESTADOS_USUARIO)[number];

export class CrearUsuarioDto {
  @IsString({ message: 'El nombre es obligatorio' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(120, { message: 'El nombre no puede exceder 120 caracteres' })
  nombre: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalizarNombreUsuario(value) : value,
  )
  @IsString({ message: 'El nombre de usuario es obligatorio' })
  @MinLength(LONGITUD_MINIMA_NOMBRE_USUARIO, {
    message: `El nombre de usuario debe tener al menos ${LONGITUD_MINIMA_NOMBRE_USUARIO} caracteres`,
  })
  @MaxLength(LONGITUD_MAXIMA_NOMBRE_USUARIO, {
    message: `El nombre de usuario no puede exceder ${LONGITUD_MAXIMA_NOMBRE_USUARIO} caracteres`,
  })
  @Matches(PATRON_NOMBRE_USUARIO, {
    message:
      'El nombre de usuario solo admite letras minusculas, digitos, punto, guion y guion bajo, y debe empezar por letra o digito',
  })
  nombreUsuario: string;

  @IsString({ message: 'La contrasena es obligatoria' })
  @MinLength(1, { message: 'La contrasena es obligatoria' })
  @MaxLength(128, { message: 'La contrasena no puede exceder 128 caracteres' })
  password: string;

  @IsIn(NOMBRES_ROL, { message: `El rol debe ser uno de: ${NOMBRES_ROL.join(', ')}` })
  rol: (typeof NOMBRES_ROL)[number];

  @IsOptional()
  @IsUUID('all', { message: 'La sucursal debe ser un identificador valido' })
  sucursalId?: string | null;
}

export class ActualizarUsuarioDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser texto' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(120, { message: 'El nombre no puede exceder 120 caracteres' })
  nombre?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizarNombreUsuario(value) : value,
  )
  @IsString({ message: 'El nombre de usuario debe ser texto' })
  @MinLength(LONGITUD_MINIMA_NOMBRE_USUARIO, {
    message: `El nombre de usuario debe tener al menos ${LONGITUD_MINIMA_NOMBRE_USUARIO} caracteres`,
  })
  @MaxLength(LONGITUD_MAXIMA_NOMBRE_USUARIO, {
    message: `El nombre de usuario no puede exceder ${LONGITUD_MAXIMA_NOMBRE_USUARIO} caracteres`,
  })
  @Matches(PATRON_NOMBRE_USUARIO, {
    message:
      'El nombre de usuario solo admite letras minusculas, digitos, punto, guion y guion bajo, y debe empezar por letra o digito',
  })
  nombreUsuario?: string;

  @IsOptional()
  @IsIn(NOMBRES_ROL, { message: `El rol debe ser uno de: ${NOMBRES_ROL.join(', ')}` })
  rol?: (typeof NOMBRES_ROL)[number];

  @IsOptional()
  @IsUUID('all', { message: 'La sucursal debe ser un identificador valido' })
  sucursalId?: string | null;
}

export class CambiarEstadoDto {
  @IsIn(ESTADOS_USUARIO, {
    message: `El estado debe ser uno de: ${ESTADOS_USUARIO.join(', ')}`,
  })
  estado: EstadoUsuario;
}

export class RestablecerPasswordDto {
  @IsString({ message: 'La contrasena es obligatoria' })
  @MinLength(1, { message: 'La contrasena es obligatoria' })
  @MaxLength(128, { message: 'La contrasena no puede exceder 128 caracteres' })
  password: string;
}

export class CambiarPropiaPasswordDto {
  @IsString({ message: 'La contrasena actual es obligatoria' })
  @MinLength(1, { message: 'La contrasena actual es obligatoria' })
  @MaxLength(128, { message: 'La contrasena actual no puede exceder 128 caracteres' })
  passwordActual: string;

  @IsString({ message: 'La contrasena nueva es obligatoria' })
  @MinLength(1, { message: 'La contrasena nueva es obligatoria' })
  @MaxLength(128, { message: 'La contrasena nueva no puede exceder 128 caracteres' })
  passwordNueva: string;
}

export class ListarUsuariosDto {
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
  @IsUUID('all', { message: 'El filtro sucursalId debe ser un identificador valido' })
  sucursalId?: string;

  @IsOptional()
  @IsIn(NOMBRES_ROL, { message: `El filtro rol debe ser uno de: ${NOMBRES_ROL.join(', ')}` })
  rol?: (typeof NOMBRES_ROL)[number];

  @IsOptional()
  @IsIn(ESTADOS_USUARIO, {
    message: `El filtro estado debe ser uno de: ${ESTADOS_USUARIO.join(', ')}`,
  })
  estado?: EstadoUsuario;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'La busqueda no puede exceder 120 caracteres' })
  q?: string;
}

export class AsignarPermisoDto {
  @IsIn(['concedido', 'revocado'], {
    message: 'El tipo debe ser "concedido" o "revocado"',
  })
  tipo: 'concedido' | 'revocado';
}