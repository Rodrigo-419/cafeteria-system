// Estrategia Passport para validar el JWT y cargar el usuario en la request.
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthRepository } from '../auth.repository';
import { calcularPermisosEfectivos } from '../../domain/calcular-permisos-efectivos';

export interface JwtPayload {
  sub: string;
  [key: string]: unknown;
}

export interface UsuarioAutenticado {
  id: string;
  nombre: string;
  email: string;
  rol: string | null;
  sucursalId: string | null;
  permisos: string[];
  permisosEfectivos: string[];
  [key: string]: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<UsuarioAutenticado> {
    const usuarioId = payload.sub;
    if (typeof usuarioId !== 'string' || usuarioId.length === 0) {
      throw new UnauthorizedException('Token invalido');
    }

    // La consulta a BD es obligatoria: si el usuario fue borrado, desactivado o
    // sus permisos cambiaron, el token debe dejar de ser valido.
    const usuario = await this.authRepository.obtenerUsuarioActivoPorId(usuarioId);

    const rolPermisos = (usuario.rol?.rolesPermiso ?? []).map((rp) => rp.permiso.codigo);
    const permisosIndividuales = usuario.permisos.map((up) => ({
      codigo: up.permiso.codigo,
      tipo: up.tipo,
    }));
    const permisosEfectivos = calcularPermisosEfectivos(rolPermisos, permisosIndividuales);

    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol?.nombre ?? null,
      sucursalId: usuario.sucursalId,
      permisos: permisosEfectivos,
      permisosEfectivos,
    };
  }
}