import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

// El repositorio solo se usa como tipo, pero importarlo arrastraria Prisma y el
// cliente generado. Se sustituye el modulo para no tocar la base de datos.
jest.mock('../../infrastructure/users.repository', () => ({
  UsersRepository: class UsersRepository {},
}));

jest.mock('../../../auditoria/infrastructure/auditoria.repository', () => ({
  AuditoriaRepository: class AuditoriaRepository {},
}));

import {
  CrearUsuarioUseCase,
  type EntradaCrearUsuario,
} from './crear-usuario.use-case';
import type { UsersRepository } from '../../infrastructure/users.repository';
import type { AuditoriaRepository } from '../../../auditoria/infrastructure/auditoria.repository';
import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../../domain/roles';

const PASSWORD_VALIDA = 'contrasena-larga-123';

type Repo = {
  enTransaccion: jest.Mock;
  nombreUsuarioEnUso: jest.Mock;
  existeSucursal: jest.Mock;
  obtenerRolPorNombre: jest.Mock;
  crearUsuario: jest.Mock;
};

function repo(): Repo {
  return {
    // El caso de uso envuelve las comprobaciones y la escritura en una
    // transaccion; el mock la ejecuta con un cliente centinela.
    enTransaccion: jest.fn((operacion: (cliente: unknown) => unknown) =>
      operacion({}),
    ),
    nombreUsuarioEnUso: jest.fn().mockResolvedValue(false),
    existeSucursal: jest.fn().mockResolvedValue(true),
    obtenerRolPorNombre: jest.fn().mockImplementation(async (nombre: string) => ({
      id: `rol-${nombre}`,
      nombre,
    })),
    // El repositorio real devuelve `UsuarioRespuesta`, que no incluye
    // `passwordHash` porque el `select` de Prisma es explicito. El mock refleja
    // esa forma para que la garantia probada sea la real.
    crearUsuario: jest.fn().mockImplementation(async (data) => ({
      id: 'usr-nuevo',
      nombre: data.nombre,
      nombreUsuario: data.nombreUsuario,
      rol: 'Creado',
      rolId: data.rolId,
      sucursalId: data.sucursalId,
      estado: 'activo',
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  };
}

describe('CrearUsuarioUseCase', () => {
  let repository: Repo;
  let auditoria: { registrar: jest.Mock };
  let useCase: CrearUsuarioUseCase;

  beforeEach(() => {
    repository = repo();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    useCase = new CrearUsuarioUseCase(
      repository as unknown as UsersRepository,
      auditoria as unknown as AuditoriaRepository,
    );
  });

  const entrada: EntradaCrearUsuario = {
    nombre: 'Ana Perez',
    nombreUsuario: 'ana.perez',
    password: PASSWORD_VALIDA,
    rol: ROL_EMPLEADO,
    sucursalId: 'suc-1',
  };

  describe('Admin', () => {
    const admin = { id: 'admin-1', rol: ROL_ADMIN, sucursalId: null };

    it('crea el usuario con el rol y la sucursal solicitados', async () => {
      const resultado = await useCase.ejecutar(admin, {
        ...entrada,
        rol: ROL_GERENTE,
        sucursalId: 'suc-7',
      });

      expect(resultado.id).toBe('usr-nuevo');
      expect(repository.crearUsuario).toHaveBeenCalledWith(
        expect.objectContaining({ rolId: `rol-${ROL_GERENTE}`, sucursalId: 'suc-7' }),
        expect.anything(),
      );
    });

    it('crea un Admin sin sucursal', async () => {
      await useCase.ejecutar(admin, {
        ...entrada,
        rol: ROL_ADMIN,
        sucursalId: null,
      });

      expect(repository.crearUsuario).toHaveBeenCalledWith(
        expect.objectContaining({ rolId: `rol-${ROL_ADMIN}`, sucursalId: null }),
        expect.anything(),
      );
    });

    it('normaliza el nombre de usuario a minusculas y sin espacios', async () => {
      await useCase.ejecutar(admin, { ...entrada, nombreUsuario: '  ANA.PEREZ ' });

      expect(repository.nombreUsuarioEnUso).toHaveBeenCalledWith(
        'ana.perez',
        undefined,
        expect.anything(),
      );
      expect(repository.crearUsuario).toHaveBeenCalledWith(
        expect.objectContaining({ nombreUsuario: 'ana.perez' }),
        expect.anything(),
      );
    });

    it('nunca devuelve el hash de la contrasena', async () => {
      const resultado = await useCase.ejecutar(admin, entrada);

      expect(JSON.stringify(resultado)).not.toContain('passwordHash');
    });
  });

  describe('Gerente', () => {
    const gerente = { id: 'ger-1', rol: ROL_GERENTE, sucursalId: 'suc-1' };

    it('fuerza el rol Empleado y su propia sucursal', async () => {
      await useCase.ejecutar(gerente, entrada);

      expect(repository.crearUsuario).toHaveBeenCalledWith(
        expect.objectContaining({ rolId: `rol-${ROL_EMPLEADO}`, sucursalId: 'suc-1' }),
        expect.anything(),
      );
    });

    it('ignora la sucursal de otra sucursal que envíe el cliente', async () => {
      await useCase.ejecutar(gerente, { ...entrada, sucursalId: 'suc-99' });

      expect(repository.crearUsuario).toHaveBeenCalledWith(
        expect.objectContaining({ sucursalId: 'suc-1' }),
        expect.anything(),
      );
    });

    it('rechaza con 403 intentar crear un Gerente', async () => {
      await expect(
        useCase.ejecutar(gerente, { ...entrada, rol: ROL_GERENTE }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.crearUsuario).not.toHaveBeenCalled();
    });

    it('rechaza con 403 intentar crear un Admin', async () => {
      await expect(
        useCase.ejecutar(gerente, { ...entrada, rol: ROL_ADMIN, sucursalId: null }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('validaciones', () => {
    const admin = { id: 'admin-1', rol: ROL_ADMIN, sucursalId: null };

    it('rechaza con 409 un nombre de usuario duplicado', async () => {
      repository.nombreUsuarioEnUso.mockResolvedValue(true);

      await expect(useCase.ejecutar(admin, entrada)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.crearUsuario).not.toHaveBeenCalled();
    });

    it('rechaza con 400 un nombre de usuario invalido', async () => {
      const error = (await useCase
        .ejecutar(admin, { ...entrada, nombreUsuario: 'usuario invalido' })
        .catch((e: unknown) => e)) as BadRequestException;

      expect(error).toBeInstanceOf(BadRequestException);
      const respuesta = error.getResponse() as { problemas: string[] };
      expect(respuesta.problemas.length).toBeGreaterThan(0);
      expect(repository.crearUsuario).not.toHaveBeenCalled();
    });

    it('rechaza con 400 una contrasena debil y devuelve la lista de problemas', async () => {
      const error = (await useCase
        .ejecutar(admin, { ...entrada, password: 'corta' })
        .catch((e: unknown) => e)) as BadRequestException;

      expect(error).toBeInstanceOf(BadRequestException);
      const respuesta = error.getResponse() as { problemas: string[] };
      expect(respuesta.problemas.length).toBeGreaterThan(0);
      expect(repository.crearUsuario).not.toHaveBeenCalled();
    });

    it('rechaza con 400 una sucursal inexistente', async () => {
      repository.existeSucursal.mockResolvedValue(false);

      await expect(useCase.ejecutar(admin, entrada)).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.crearUsuario).not.toHaveBeenCalled();
    });

    it('rechaza con 400 un Admin con sucursal', async () => {
      await expect(
        useCase.ejecutar(admin, { ...entrada, rol: ROL_ADMIN, sucursalId: 'suc-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza con 400 un Empleado sin sucursal', async () => {
      await expect(
        useCase.ejecutar(admin, { ...entrada, sucursalId: null }),
      ).rejects.toThrow(BadRequestException);
    });

    it('no comprueba la sucursal cuando es null (Admin)', async () => {
      await useCase.ejecutar(admin, {
        ...entrada,
        rol: ROL_ADMIN,
        sucursalId: null,
      });

      expect(repository.existeSucursal).not.toHaveBeenCalled();
    });
  });
});