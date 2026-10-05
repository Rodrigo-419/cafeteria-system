// Caso de uso que autentica al usuario y emite el token de acceso.
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuthRepository } from '../../infrastructure/auth.repository';
import { calcularPermisosEfectivos } from '../../domain/calcular-permisos-efectivos';
import { ConfigService } from '@nestjs/config';

const MENSAJE_CREDENCIALES_INVALIDAS = 'Correo electronico o contrasena incorrectos';

// Hash bcrypt valido (60 chars) de una contrasena aleatoria, usado cuando el
// correo no existe. Debe tener largo valido para que bcrypt ejecute el trabajo
// completo y no revele por tiempo si el correo existe.
const HASH_FALSO = '$2b$12$.ab0wgAeuCGnpvHMDXfhhepL.uK5u/6NX2GBCyLPOmKxlMfrd0JdC';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async ejecutar(email: string, password: string) {
    const emailNormalizado = email.trim().toLowerCase();

    // Buscamos al usuario por correo.
    const usuario = await this.authRepository.buscarUsuarioPorEmail(emailNormalizado);

    // Si el usuario no existe, comparamos con un hash falso fijo para evitar
    // revelar por tiempo si el correo existe.
    const passwordHashAComparar = usuario?.passwordHash ?? HASH_FALSO;

    const esPasswordValida = await bcrypt.compare(password, passwordHashAComparar);

    if (!usuario || !esPasswordValida) {
      throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    // El usuario existe y la contrasena es correcta.
    if (usuario.estado !== 'activo') {
      throw new ForbiddenException('Cuenta bloqueada');
    }

    const rolPermisos = (usuario.rol?.rolesPermiso ?? []).map((rp) => rp.permiso.codigo);
    const permisosIndividuales = usuario.permisos.map((up) => ({
      codigo: up.permiso.codigo,
      tipo: up.tipo,
    }));
    const permisosEfectivos = calcularPermisosEfectivos(rolPermisos, permisosIndividuales);

    const payload = { sub: usuario.id };
    const accessToken = await this.jwtService.signAsync(payload);
    const expiresInString = this.configService.get<string>('JWT_EXPIRES_IN', '8h');
    const expiresInSegundos = this.convertirExpiresInASegundos(expiresInString);

    return {
      accessToken,
      tokenType: 'Bearer' as const,
      expiresIn: expiresInSegundos,
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol?.nombre ?? null,
        sucursalId: usuario.sucursalId,
        permisos: permisosEfectivos,
      },
    };
  }

  private convertirExpiresInASegundos(valor: string): number {
    const trimmed = valor.trim();

    // Si es un numero puro, asume segundos.
    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }

    const match = /^(\d+)([smhd])$/i.exec(trimmed);
    if (!match) {
      // Valor inesperado: devuelve 8 horas por defecto.
      return 8 * 60 * 60;
    }

    const cantidad = Number(match[1]);
    const unidad = match[2].toLowerCase();

    switch (unidad) {
      case 's':
        return cantidad;
      case 'm':
        return cantidad * 60;
      case 'h':
        return cantidad * 60 * 60;
      case 'd':
        return cantidad * 24 * 60 * 60;
      default:
        return 8 * 60 * 60;
    }
  }
}