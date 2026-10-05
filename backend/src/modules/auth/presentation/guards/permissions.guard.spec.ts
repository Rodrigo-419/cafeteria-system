import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../../../../common/decorators/require-permission.decorator';
import type { UsuarioAutenticado } from '../../infrastructure/jwt/jwt.strategy';

function usuarioConPermisos(permisos: string[]): UsuarioAutenticado {
  return {
    id: 'usr-1',
    nombre: 'Ana Perez',
    email: 'ana@cafeteria.test',
    rol: 'ADMIN',
    sucursalId: 'suc-1',
    permisos,
    permisosEfectivos: permisos,
  };
}

function crearContexto(permisos: string[] | undefined): ExecutionContext {
  const request = {
    user: permisos === undefined ? undefined : usuarioConPermisos(permisos),
  };

  return {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PermissionsGuard(reflector as unknown as Reflector);
  });

  it('permite cuando el usuario tiene todos los permisos requeridos', () => {
    reflector.getAllAndOverride.mockReturnValue(['ventas.ver', 'ventas.crear']);
    const contexto = crearContexto(['ventas.ver', 'ventas.crear', 'reportes.ver']);

    expect(guard.canActivate(contexto)).toBe(true);
  });

  it('permite cuando la ruta no declara permisos requeridos', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const contexto = crearContexto(['ventas.ver']);

    expect(guard.canActivate(contexto)).toBe(true);
  });

  it('permite cuando la ruta declara un arreglo vacio de permisos', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const contexto = crearContexto([]);

    expect(guard.canActivate(contexto)).toBe(true);
  });

  it('deniega con 403 cuando falta uno de los permisos requeridos', () => {
    reflector.getAllAndOverride.mockReturnValue(['ventas.ver', 'ventas.crear']);
    const contexto = crearContexto(['ventas.ver']);

    expect(() => guard.canActivate(contexto)).toThrow(ForbiddenException);
  });

  it('exige TODOS los permisos, no solo uno', () => {
    reflector.getAllAndOverride.mockReturnValue(['ventas.ver', 'ventas.crear']);
    const contexto = crearContexto(['ventas.ver']);

    expect(() => guard.canActivate(contexto)).toThrow(ForbiddenException);
  });

  it('deniega con 403 cuando el usuario no tiene ningun permiso', () => {
    reflector.getAllAndOverride.mockReturnValue(['ventas.ver']);
    const contexto = crearContexto([]);

    expect(() => guard.canActivate(contexto)).toThrow(ForbiddenException);
  });

  it('deniega cuando la ruta pide permisos y no hay usuario autenticado', () => {
    reflector.getAllAndOverride.mockReturnValue(['ventas.ver']);
    const contexto = crearContexto(undefined);

    expect(() => guard.canActivate(contexto)).toThrow(ForbiddenException);
  });

  it('consulta la metadata con handler y clase', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const contexto = crearContexto(['ventas.ver']);

    guard.canActivate(contexto);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(REQUIRE_PERMISSION_KEY, [
      'handler',
      'class',
    ]);
  });

  it('no concede acceso por tener permisos que no fueron requeridos', () => {
    reflector.getAllAndOverride.mockReturnValue(['ventas.ver']);
    const contexto = crearContexto(['reportes.ver', 'ventas.crear']);

    expect(() => guard.canActivate(contexto)).toThrow(ForbiddenException);
  });
});