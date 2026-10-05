// DTO con las credenciales (email y password) del endpoint de login.
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Debe proporcionar un correo electronico valido' })
  email: string;

  @IsString({ message: 'La contrasena es obligatoria' })
  @MinLength(1, { message: 'La contrasena es obligatoria' })
  @MaxLength(128, { message: 'La contrasena no puede exceder 128 caracteres' })
  password: string;
}