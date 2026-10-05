import { BadRequestException, NotFoundException } from '@nestjs/common';

jest.mock('../../infrastructure/users.repository', () => ({
  UsersRepository: class UsersRepository {},
}));

import { AsignarPermisoUseCase } from './asignar-permiso.use-case';
import type { UsersRepository } from '../../infrastructure/users.repository';
import { Actor } from '../../domain/rules/alcance';
import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../../domain/roles';

type Repo = {
  buscarPorIdEnAlcance: jest.Mock;
  obtenerPermisoPorId: jest.Mock;
  permisosPorDefectoDeRol: jest.Mock;
  permisosIndividuales: jest.Mock;
  asignarPermisoIndividual: jest.Mock;
};

function repo(): Repo {
  return {
    buscarPorIdEnAlcance: jest.fn().mockResolvedValue({
      id: 'objetivo-1',
      rol: ROL_EMPLEADO,
      rolId: 'rol-1',
      sucursalId: 'suc-1',
      estado: 'activo',
      passwordHash: 'hash',
    }),
    // Catalogo minimo para que las pruebas usen ids coherentes con su codigo.
    obtenerPermisoPorId: jest.fn().mockImplementation(async (id: string) => {
      const catalogo: Record<string, { codigo: string; descripcion: string }> = {
        'perm-1': { codigo: 'insumos.ver', descripcion: 'Ver insumos' },
        'perm-2': { codigo: 'ventas.ver', descripcion: 'Ver ventas' },
      };
      const encontrado = catalogo[id];
      return encontrado ? { id, ...encontrado } : null;
    }),
    permisosPorDefectoDeRol: jest.fn().mockResolvedValue([
      { permisoId: 'perm-2', codigo: 'ventas.ver', descripcion: 'Ver ventas' },
    ]),
    permisosIndividuales: jest.fn().mockResolvedValue([]),
    asignarPermisoIndividual: jest.fn().mockResolvedValue(undefined),
  };
}

describe('AsignarPermisoUseCase', () => {
  let repository: Repo;
  let useCase: AsignarPermisoUseCase;

  beforeEach(() => {
    repository = repo();
    useCase = new AsignarPermisoUseCase(
      repository as unknown as UsersRepository,
    );
  });

  const gerente: Actor = {
    id: 'ger-1',
    rol: ROL_GERENTE,
    sucursalId: 'suc-1',
    permisosEfectivos: ['permisos.asignar', 'insumos.ver'],
  };

  describe('caso feliz', () => {
    it('concede un permiso y escribe el historial en la misma transaccion', async () => {
      await useCase.ejecutar(gerente, 'objetivo-1', 'perm-1', 'concedido');

      expect(repository.asignarPermisoIndividual).toHaveBeenCalledWith({
        usuarioId: 'objetivo-1',
        permisoId: 'perm-1',
        tipo: 'concedido',
        usuarioEjecutorId: 'ger-1',
        valorAnterior: 'rol',
      });
    });

    it('guarda "concedido" como valor anterior si ya estaba concedido', async () => {
      repository.permisosIndividuales.mockResolvedValue([
        {
          id: 'up-1',
          permisoId: 'perm-1',
          tipo: 'concedido',
          permiso: { codigo: 'insumos.ver', descripcion: 'Ver insumos' },
        },
      ]);

      await useCase.ejecutar(gerente, 'objetivo-1', 'perm-1', 'concedido');

      expect(repository.asignarPermisoIndividual).toHaveBeenCalledWith(
        expect.objectContaining({ valorAnterior: 'concedido' }),
      );
    });

    it('un Admin puede conceder a un objetivo no Empleado un permiso fuera de la lista', async () => {
      // Objetivo Gerente: la limitacion de los cuatro concedibles solo aplica
      // a objetivos Empleado.
      repository.buscarPorIdEnAlcance.mockResolvedValue({
        id: 'gerente-1',
        rol: ROL_GERENTE,
        rolId: 'rol-ger',
        sucursalId: 'suc-2',
        estado: 'activo',
        passwordHash: 'hash',
      });
      repository.obtenerPermisoPorId.mockResolvedValue({
        id: 'perm-9',
        codigo: 'ventas.anular',
        descripcion: 'Anular ventas',
      });

      const admin: Actor = {
        id: 'admin-1',
        rol: ROL_ADMIN,
        sucursalId: null,
        permisosEfectivos: ['permisos.asignar', 'ventas.anular'],
      };

      await useCase.ejecutar(admin, 'gerente-1', 'perm-9', 'concedido');

      expect(repository.asignarPermisoIndividual).toHaveBeenCalledWith(
        expect.objectContaining({ usuarioId: 'gerente-1', tipo: 'concedido' }),
      );
    });
  });

  describe('rechazos', () => {
    it('rechaza conceder un permiso que el actor no posee', async () => {
      const sinPermiso: Actor = { ...gerente, permisosEfectivos: ['permisos.asignar'] };

      const error = (await useCase
        .ejecutar(sinPermiso, 'objetivo-1', 'perm-1', 'concedido')
        .catch((e: unknown) => e)) as BadRequestException;

      expect(error).toBeInstanceOf(BadRequestException);
      const respuesta = error.getResponse() as { problemas: string[] };
      expect(respuesta.problemas[0]).toContain('no lo tienes');
      expect(repository.asignarPermisoIndividual).not.toHaveBeenCalled();
    });

    it('rechaza conceder a un Empleado un permiso fuera de la lista', async () => {
      repository.obtenerPermisoPorId.mockResolvedValue({
        id: 'perm-9',
        codigo: 'ventas.anular',
        descripcion: 'Anular ventas',
      });

      const error = (await useCase
        .ejecutar(gerente, 'objetivo-1', 'perm-9', 'concedido')
        .catch((e: unknown) => e)) as BadRequestException;

      const respuesta = error.getResponse() as { problemas: string[] };
      expect(respuesta.problemas.some((p) => p.includes('solo se les pueden conceder'))).toBe(
        true,
      );
      expect(repository.asignarPermisoIndividual).not.toHaveBeenCalled();
    });

    it('rechaza cambiar sus propios permisos', async () => {
      repository.buscarPorIdEnAlcance.mockResolvedValue({
        id: 'ger-1',
        rol: ROL_GERENTE,
        rolId: 'rol-ger',
        sucursalId: 'suc-1',
        estado: 'activo',
        passwordHash: 'hash',
      });

      await expect(
        useCase.ejecutar(gerente, 'ger-1', 'perm-1', 'concedido'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.asignarPermisoIndividual).not.toHaveBeenCalled();
    });

    it('rechaza con 404 un objetivo fuera del alcance', async () => {
      repository.buscarPorIdEnAlcance.mockResolvedValue(null);

      await expect(
        useCase.ejecutar(gerente, 'admin-1', 'perm-1', 'concedido'),
      ).rejects.toThrow(NotFoundException);
      expect(repository.asignarPermisoIndividual).not.toHaveBeenCalled();
    });

    it('rechaza con 404 un permiso inexistente', async () => {
      repository.obtenerPermisoPorId.mockResolvedValue(null);

      await expect(
        useCase.ejecutar(gerente, 'objetivo-1', 'perm-x', 'concedido'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza revocar un permiso que el rol del objetivo no tiene', async () => {
      await expect(
        useCase.ejecutar(gerente, 'objetivo-1', 'perm-1', 'revocado'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.asignarPermisoIndividual).not.toHaveBeenCalled();
    });
  });

  describe('revocacion', () => {
    it('permite revocar un permiso que el rol del objetivo tiene', async () => {
      // El actor debe poseer el permiso que revoca.
      const gerenteConPermiso: Actor = {
        ...gerente,
        permisosEfectivos: ['permisos.asignar', 'insumos.ver', 'ventas.ver'],
      };

      await useCase.ejecutar(
        gerenteConPermiso,
        'objetivo-1',
        'perm-2',
        'revocado',
      );

      expect(repository.asignarPermisoIndividual).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'revocado', valorAnterior: 'rol' }),
      );
    });
  });
});