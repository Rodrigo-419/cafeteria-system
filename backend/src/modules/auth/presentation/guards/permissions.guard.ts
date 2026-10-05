// Guard que verifica los permisos requeridos por rol sobre la ruta.
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../../../../common/decorators/require-permission.decorator';
import { UsuarioAutenticado } from '../../infrastructure/jwt/jwt.strategy';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permisosRequeridos = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permisosRequeridos || permisosRequeridos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const usuario = request.user as UsuarioAutenticado | undefined;

    if (!usuario) {
      throw new ForbiddenException('Acceso denegado');
    }

    const permisos = usuario.permisosEfectivos ?? usuario.permisos ?? [];
    const setPermisos = new Set(permisos);

    const cumple = permisosRequeridos.every((codigo) => setPermisos.has(codigo));
    if (!cumple) {
      throw new ForbiddenException('Acceso denegado');
    }

    return true;
  }
}