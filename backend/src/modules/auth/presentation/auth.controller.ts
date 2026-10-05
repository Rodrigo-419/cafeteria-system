// Controller HTTP de autenticacion (login y renovacion de token).
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { Public } from '../../../common/decorators/public.decorator';
import type { UsuarioAutenticado } from '../infrastructure/jwt/jwt.strategy';
import { User } from '../../../common/decorators/user.decorator';

@Controller('auth')
@UseGuards(ThrottlerGuard)
@ApiTags('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesion y devuelve un token de acceso JWT' })
  login(@Body() loginDto: LoginDto) {
    return this.loginUseCase.ejecutar(loginDto.email, loginDto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Devuelve el usuario autenticado y sus permisos efectivos' })
  obtenerPerfil(@User() usuario: UsuarioAutenticado): {
    id: string;
    nombre: string;
    email: string;
    rol: string | null;
    sucursalId: string | null;
    permisos: string[];
  } {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      sucursalId: usuario.sucursalId,
      permisos: usuario.permisos,
    };
  }
}