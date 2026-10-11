// DTO con las credenciales (nombre de usuario y password) del endpoint de login.
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  LONGITUD_MAXIMA_NOMBRE_USUARIO,
  LONGITUD_MINIMA_NOMBRE_USUARIO,
  normalizarNombreUsuario,
  PATRON_NOMBRE_USUARIO,
} from '../../domain/rules/nombre-usuario';

export class LoginDto {
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
}
