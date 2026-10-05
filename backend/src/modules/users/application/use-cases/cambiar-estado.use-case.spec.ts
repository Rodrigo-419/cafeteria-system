import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

jest.mock('../../infrastructure/users.repository', () => ({
  UsersRepository: class UsersRepository {},
}));

import { CambiarEstadoUseCase } from './cambiar-estado.use-case';
import type { UsersRepository } from '../../infrastructure/users.repository';
import { Actor } from '../../domain/rules/alcance';
import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../../domain/roles';

type Repo = {
  buscarPorIdEnAlcance: jest.Mock;
  contarAdminsActivos: jest.Mock;
  actualizarEstado: jest.Mock;
};

function objetivo(overrides = {}) {
  return {
    id: 'objetivo-1',
    rol: ROL_EMPLEADO,
    rolId: 'rol-1',
    sucursalId: 'suc-1',
    estado: 'activo' as const,
    passwordHash: 'hash',
    ...overrides,
  };
}

describe('CambiarEstadoUseCase', () => {
  let repository: Repo;
  let useCase: CambiarEstadoUseCase;

  beforeEach(() => {
    repository = {
      buscarPorIdEnAlcance: jest.fn().mockResolvedValue(objetivo()),
      contarAdminsActivos: jest.fn().mockResolvedValue(2),
      actualizarEstado: jest.fn().mockResolvedValue({}),
    };
    useCase = new CambiarEstadoUseCase(
      repository as unknown as UsersRepository,
    );
  });

  const admin: Actor = {
    id: 'admin-1',
    rol: ROL_ADMIN,
    sucursalId: null,
    permisosEfectivos: ['usuarios.crear_editar'],
  };

  it('bloquea a un usuario dentro del alcance', async () => {
    await useCase.ejecutar(admin, 'objetivo-1', 'bloqueado');

    expect(repository.actualizarEstado).toHaveBeenCalledWith(
      'objetivo-1',
      'bloqueado',
    );
  });

  it('rechaza cambiar su propio estado', async () => {
    repository.buscarPorIdEnAlcance.mockResolvedValue(
      objetivo({ id: 'admin-1' }),
    );

    await expect(
      useCase.ejecutar(admin, 'admin-1', 'bloqueado'),
    ).rejects.toThrow(BadRequestException);
    expect(repository.actualizarEstado).not.toHaveBeenCalled();
  });

  it('rechaza bloquear al ultimo Admin activo', async () => {
    repository.buscarPorIdEnAlcance.mockResolvedValue(
      objetivo({ id: 'admin-2', rol: ROL_ADMIN, rolId: 'rol-admin', sucursalId: null }),
    );
    repository.contarAdminsActivos.mockResolvedValue(1);

    await expect(
      useCase.ejecutar(admin, 'admin-2', 'bloqueado'),
    ).rejects.toThrow(ConflictException);
    expect(repository.actualizarEstado).not.toHaveBeenCalled();
  });

  it('permite bloquear a un Admin si hay otro Admin activo', async () => {
    repository.buscarPorIdEnAlcance.mockResolvedValue(
      objetivo({ id: 'admin-2', rol: ROL_ADMIN, rolId: 'rol-admin', sucursalId: null }),
    );
    repository.contarAdminsActivos.mockResolvedValue(2);

    await useCase.ejecutar(admin, 'admin-2', 'bloqueado');

    expect(repository.actualizarEstado).toHaveBeenCalled();
  });

  it('rechaza con 404 un usuario fuera del alcance', async () => {
    // El repositorio devuelve null cuando el filtro de alcance no coincide.
    repository.buscarPorIdEnAlcance.mockResolvedValue(null);

    await expect(
      useCase.ejecutar(admin, 'inexistente', 'bloqueado'),
    ).rejects.toThrow(NotFoundException);
    expect(repository.actualizarEstado).not.toHaveBeenCalled();
  });

  it('un Gerente solo alcanza a los Empleados de su sucursal', async () => {
    const gerente: Actor = {
      id: 'ger-1',
      rol: ROL_GERENTE,
      sucursalId: 'suc-1',
      permisosEfectivos: ['usuarios.crear_editar'],
    };
    repository.buscarPorIdEnAlcance.mockResolvedValue(null);

    await expect(
      useCase.ejecutar(gerente, 'admin-1', 'bloqueado'),
    ).rejects.toThrow(NotFoundException);
  });

  it('reactivar no dispara la proteccion del ultimo Admin', async () => {
    repository.buscarPorIdEnAlcance.mockResolvedValue(
      objetivo({
        id: 'admin-2',
        rol: ROL_ADMIN,
        rolId: 'rol-admin',
        sucursalId: null,
        estado: 'bloqueado',
      }),
    );
    repository.contarAdminsActivos.mockResolvedValue(1);

    await useCase.ejecutar(admin, 'admin-2', 'activo');

    expect(repository.actualizarEstado).toHaveBeenCalledWith(
      'admin-2',
      'activo',
    );
  });
});