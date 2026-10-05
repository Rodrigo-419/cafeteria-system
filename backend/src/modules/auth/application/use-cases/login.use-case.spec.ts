import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';

// El repositorio solo se usa como tipo en el caso de uso, pero importarlo
// arrastraria PrismaService y el cliente generado de Prisma. Se sustituye el
// modulo para que estas pruebas no carguen nada de base de datos.
jest.mock('../../infrastructure/auth.repository', () => ({
  AuthRepository: class AuthRepository {},
}));

import { LoginUseCase } from './login.use-case';
import type { AuthRepository } from '../../infrastructure/auth.repository';

const PASSWORD = 'clave-de-prueba-123';
// Coste bajo para que las pruebas sean rapidas.
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

type UsuarioFalso = {
  id: string;
  nombre: string;
  email: string;
  passwordHash: string;
  estado: 'activo' | 'bloqueado' | 'inactivo';
  rolId: string | null;
  sucursalId: string | null;
  rol: {
    nombre: string;
    rolesPermiso: { permiso: { codigo: string } }[];
  } | null;
  permisos: {
    tipo: 'concedido' | 'revocado';
    permiso: { codigo: string };
  }[];
};

function usuarioActivo(overrides: Partial<UsuarioFalso> = {}): UsuarioFalso {
  return {
    id: 'usr-1',
    nombre: 'Ana Perez',
    email: 'ana@cafeteria.test',
    passwordHash: PASSWORD_HASH,
    estado: 'activo',
    rolId: 'rol-1',
    sucursalId: 'suc-1',
    rol: {
      nombre: 'ADMIN',
      rolesPermiso: [{ permiso: { codigo: 'ventas.ver' } }],
    },
    permisos: [],
    ...overrides,
  };
}

describe('LoginUseCase', () => {
  let authRepository: jest.Mocked<Pick<AuthRepository, 'buscarUsuarioPorEmail'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let useCase: LoginUseCase;

  beforeEach(() => {
    authRepository = { buscarUsuarioPorEmail: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('token-falso') };
    configService = {
      get: jest.fn().mockReturnValue('8h'),
    } as unknown as jest.Mocked<Pick<ConfigService, 'get'>>;

    useCase = new LoginUseCase(
      authRepository as unknown as AuthRepository,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  describe('credenciales validas', () => {
    it('devuelve el token y el usuario sin password_hash', async () => {
      authRepository.buscarUsuarioPorEmail.mockResolvedValue(usuarioActivo() as never);

      const resultado = await useCase.ejecutar('ana@cafeteria.test', PASSWORD);

      expect(resultado).toEqual({
        accessToken: 'token-falso',
        tokenType: 'Bearer',
        expiresIn: 8 * 60 * 60,
        user: {
          id: 'usr-1',
          nombre: 'Ana Perez',
          email: 'ana@cafeteria.test',
          rol: 'ADMIN',
          sucursalId: 'suc-1',
          permisos: ['ventas.ver'],
        },
      });
      expect(JSON.stringify(resultado)).not.toContain('passwordHash');
      expect(JSON.stringify(resultado)).not.toContain('$2b$');
    });

    it('firma el token solo con el id del usuario', async () => {
      authRepository.buscarUsuarioPorEmail.mockResolvedValue(usuarioActivo() as never);

      await useCase.ejecutar('ana@cafeteria.test', PASSWORD);

      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'usr-1' });
    });

    it('normaliza el correo a minusculas y sin espacios', async () => {
      authRepository.buscarUsuarioPorEmail.mockResolvedValue(usuarioActivo() as never);

      await useCase.ejecutar('  ANA@Cafeteria.TEST  ', PASSWORD);

      expect(authRepository.buscarUsuarioPorEmail).toHaveBeenCalledWith('ana@cafeteria.test');
    });

    it('calcula los permisos efectivos: rol + concedidos - revocados', async () => {
      authRepository.buscarUsuarioPorEmail.mockResolvedValue(
        usuarioActivo({
          rol: {
            nombre: 'SUPERVISOR',
            rolesPermiso: [
              { permiso: { codigo: 'ventas.ver' } },
              { permiso: { codigo: 'ventas.crear' } },
            ],
          },
          permisos: [
            { tipo: 'concedido', permiso: { codigo: 'reportes.ver' } },
            { tipo: 'revocado', permiso: { codigo: 'ventas.crear' } },
          ],
        }) as never,
      );

      const resultado = await useCase.ejecutar('ana@cafeteria.test', PASSWORD);

      expect(resultado.user.permisos).toEqual(['reportes.ver', 'ventas.ver']);
    });
  });

  describe('credenciales invalidas', () => {
    it('lanza 401 cuando el correo no existe', async () => {
      authRepository.buscarUsuarioPorEmail.mockResolvedValue(null);

      await expect(
        useCase.ejecutar('nadie@cafeteria.test', 'cualquiera'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza 401 cuando la contrasena es erronea', async () => {
      authRepository.buscarUsuarioPorEmail.mockResolvedValue(usuarioActivo() as never);

      await expect(
        useCase.ejecutar('ana@cafeteria.test', 'contrasena-mala'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('usa el MISMO mensaje para correo inexistente y contrasena erronea', async () => {
      authRepository.buscarUsuarioPorEmail.mockResolvedValue(null);
      const errorCorretoInexistente = (await useCase
        .ejecutar('nadie@cafeteria.test', 'cualquiera')
        .catch((e: unknown) => e)) as Error;

      authRepository.buscarUsuarioPorEmail.mockResolvedValue(usuarioActivo() as never);
      const errorContrasenaErronea = (await useCase
        .ejecutar('ana@cafeteria.test', 'contrasena-mala')
        .catch((e: unknown) => e)) as Error;

      expect(errorCorretoInexistente).toBeInstanceOf(UnauthorizedException);
      expect(errorContrasenaErronea).toBeInstanceOf(UnauthorizedException);
      expect(errorContrasenaErronea.message).toBe(errorCorretoInexistente.message);
    });

    it('compara siempre contra un hash, aunque el usuario no exista', async () => {
      const spy = jest.spyOn(bcrypt, 'compare');
      authRepository.buscarUsuarioPorEmail.mockResolvedValue(null);

      await useCase.ejecutar('nadie@cafeteria.test', 'cualquiera').catch(() => undefined);

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('el hash falso tiene largo valido para que bcrypt haga el trabajo completo', async () => {
      const spy = jest.spyOn(bcrypt, 'compare');
      authRepository.buscarUsuarioPorEmail.mockResolvedValue(null);

      await useCase.ejecutar('nadie@cafeteria.test', 'cualquiera').catch(() => undefined);

      const hashUsado = spy.mock.calls[0][1] as string;
      expect(hashUsado).toHaveLength(60);
      spy.mockRestore();
    });
  });

  describe('usuario bloqueado', () => {
    it('lanza 403 "Cuenta bloqueada" con la contrasena correcta', async () => {
      authRepository.buscarUsuarioPorEmail.mockResolvedValue(
        usuarioActivo({ estado: 'bloqueado' }) as never,
      );

      await expect(
        useCase.ejecutar('ana@cafeteria.test', PASSWORD),
      ).rejects.toThrow(ForbiddenException);
    });

    it('el mensaje es exactamente "Cuenta bloqueada"', async () => {
      authRepository.buscarUsuarioPorEmail.mockResolvedValue(
        usuarioActivo({ estado: 'bloqueado' }) as never,
      );

      const error = (await useCase
        .ejecutar('ana@cafeteria.test', PASSWORD)
        .catch((e: unknown) => e)) as Error;

      expect(error.message).toBe('Cuenta bloqueada');
    });

    it('no emite token si el usuario esta bloqueado', async () => {
      authRepository.buscarUsuarioPorEmail.mockResolvedValue(
        usuarioActivo({ estado: 'bloqueado' }) as never,
      );

      await useCase.ejecutar('ana@cafeteria.test', PASSWORD).catch(() => undefined);

      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('la contrasena erronea en un usuario bloqueado da 401, no 403', async () => {
      authRepository.buscarUsuarioPorEmail.mockResolvedValue(
        usuarioActivo({ estado: 'bloqueado' }) as never,
      );

      await expect(
        useCase.ejecutar('ana@cafeteria.test', 'contrasena-mala'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('expiresIn en segundos', () => {
    it.each([
      ['8h', 8 * 60 * 60],
      ['30m', 30 * 60],
      ['45s', 45],
      ['2d', 2 * 24 * 60 * 60],
      ['3600', 3600],
    ])('convierte %s en %i segundos', async (configurado, esperado) => {
      configService.get = jest.fn().mockReturnValue(configurado) as never;
      authRepository.buscarUsuarioPorEmail.mockResolvedValue(usuarioActivo() as never);

      const resultado = await useCase.ejecutar('ana@cafeteria.test', PASSWORD);

      expect(resultado.expiresIn).toBe(esperado);
    });
  });
});