// Pruebas del caso de uso de actualizacion, enfocadas en el alcance del Gerente
// frente al cambio de rol o sucursal:
//
//   - Usuario FUERA del alcance        -> 404 (no se revela su existencia)
//   - Usuario DENTRO del alcance       -> 403 (existe, pero la operacion no le corresponde)
//   - Admin                            -> puede cambiar rol y sucursal
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

// El repositorio solo se usa como tipo, pero importarlo arrastraria Prisma y el
// cliente generado. Se sustituye el modulo para no tocar la base de datos.
jest.mock('../../infrastructure/users.repository', () => ({
  UsersRepository: class UsersRepository {},
}));

import { ActualizarUsuarioUseCase } from './actualizar-usuario.use-case';
import type { UsersRepository } from '../../infrastructure/users.repository';
import { Actor } from '../../domain/rules/alcance';
import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../../domain/roles';

type Repo = {
  buscarPorIdEnAlcance: jest.Mock;
  actualizarUsuario: jest.Mock;
  emailEnUso: jest.Mock;
  existeSucursal: jest.Mock;
  obtenerRolPorNombre: jest.Mock;
  contarAdminsActivos: jest.Mock;
};

const SUC_CENTRO = '11111111-1111-7111-8111-111111111111';
const SUC_NORTE = '22222222-2222-7222-8222-222222222222';

const ROLES_REGISTRADOS: Record<string, string> = {
  [ROL_ADMIN]: 'rol-admin',
  [ROL_GERENTE]: 'rol-gerente',
  [ROL_EMPLEADO]: 'rol-empleado',
};

describe('ActualizarUsuarioUseCase', () => {
  let repository: Repo;
  let useCase: ActualizarUsuarioUseCase;

  const admin: Actor = {
    id: 'admin-1',
    rol: ROL_ADMIN,
    sucursalId: null,
    permisosEfectivos: ['usuarios.crear_editar'],
  };

  const gerente: Actor = {
    id: 'gerente-1',
    rol: ROL_GERENTE,
    sucursalId: SUC_CENTRO,
    permisosEfectivos: ['usuarios.crear_editar'],
  };

  /** Empleado de la sucursal del Gerente: esta dentro de su alcance. */
  const empleadoEnAlcance = {
    id: 'emp-1',
    rol: ROL_EMPLEADO,
    rolId: ROLES_REGISTRADOS[ROL_EMPLEADO],
    sucursalId: SUC_CENTRO,
    estado: 'activo' as const,
    passwordHash: 'hash',
  };

  /** Empleado de otra sucursal: `buscarPorIdEnAlcance` lo devuelve null. */
  const empleadoFueraDeAlcance = {
    ...empleadoEnAlcance,
    id: 'emp-2',
    sucursalId: SUC_NORTE,
  };

  beforeEach(() => {
    repository = {
      buscarPorIdEnAlcance: jest.fn().mockResolvedValue(empleadoEnAlcance),
      actualizarUsuario: jest.fn().mockImplementation(async (id: string) => ({
        id,
        nombre: 'Nombre',
        email: 'a@b.test',
        estado: 'activo' as const,
        rol: { nombre: ROL_EMPLEADO },
        sucursalId: SUC_CENTRO,
      })),
      emailEnUso: jest.fn().mockResolvedValue(false),
      existeSucursal: jest.fn().mockResolvedValue(true),
      obtenerRolPorNombre: jest
        .fn()
        .mockImplementation(async (nombre: string) => ({
          id: ROLES_REGISTRADOS[nombre] ?? '',
          nombre,
        })),
      contarAdminsActivos: jest.fn().mockResolvedValue(1),
    };

    useCase = new ActualizarUsuarioUseCase(repository as unknown as UsersRepository);
  });

  describe('Gerente que intenta cambiar rol o sucursal', () => {
    it('responde 403 si el usuario SI esta en su alcance y cambia el rol', async () => {
      await expect(
        useCase.ejecutar(gerente, empleadoEnAlcance.id, { rol: ROL_GERENTE }),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.actualizarUsuario).not.toHaveBeenCalled();
    });

    it('responde 403 si el usuario SI esta en su alcance y cambia la sucursal', async () => {
      await expect(
        useCase.ejecutar(gerente, empleadoEnAlcance.id, { sucursalId: SUC_NORTE }),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.actualizarUsuario).not.toHaveBeenCalled();
    });

    it('el 403 no revela el rol ni la sucursal actuales', async () => {
      // El mensaje explica la regla, no el estado del recurso.
      const error = await useCase
        .ejecutar(gerente, empleadoEnAlcance.id, { rol: ROL_ADMIN })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(JSON.stringify((error as ForbiddenException).getResponse())).not.toContain(
        SUC_CENTRO,
      );
    });

    it('sigue respondiendo 404 si el usuario esta FUERA de su alcance', async () => {
      repository.buscarPorIdEnAlcance.mockResolvedValue(null);

      await expect(
        useCase.ejecutar(gerente, empleadoFueraDeAlcance.id, { rol: ROL_ADMIN }),
      ).rejects.toThrow(NotFoundException);

      // Ni siquiera consulta: no puede saberse si existe.
      expect(repository.actualizarUsuario).not.toHaveBeenCalled();
    });

    it('permite cambiar nombre y email de un empleado de su alcance', async () => {
      await expect(
        useCase.ejecutar(gerente, empleadoEnAlcance.id, {
          nombre: 'Nuevo Nombre',
          email: 'nuevo@cafeteria.test',
        }),
      ).resolves.toBeDefined();

      expect(repository.actualizarUsuario).toHaveBeenCalledWith(empleadoEnAlcance.id, {
        nombre: 'Nuevo Nombre',
        email: 'nuevo@cafeteria.test',
      });
    });
  });

  describe('Admin', () => {
    const adminObjetivo = {
      ...empleadoEnAlcance,
      id: 'emp-3',
    };

    it('puede cambiar el rol dentro de su alcance global', async () => {
      repository.buscarPorIdEnAlcance.mockResolvedValue(adminObjetivo);

      await expect(
        useCase.ejecutar(admin, adminObjetivo.id, {
          rol: ROL_GERENTE,
          sucursalId: SUC_CENTRO,
        }),
      ).resolves.toBeDefined();

      expect(repository.actualizarUsuario).toHaveBeenCalledWith(adminObjetivo.id, {
        rolId: ROLES_REGISTRADOS[ROL_GERENTE],
        sucursalId: SUC_CENTRO,
      });
    });

    it('exige la sucursal al cambiar de rol: sin ella la combinacion es invalida', async () => {
      // El cambio de rol arrastra la sucursal a null, y un Gerente sin sucursal
      // no es valido. Por eso hay que enviar ambos campos a la vez.
      repository.buscarPorIdEnAlcance.mockResolvedValue(adminObjetivo);

      await expect(
        useCase.ejecutar(admin, adminObjetivo.id, { rol: ROL_GERENTE }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.actualizarUsuario).not.toHaveBeenCalled();
    });

    it('rechaza dejar al sistema sin ningun Admin activo', async () => {
      repository.buscarPorIdEnAlcance.mockResolvedValue({
        ...empleadoEnAlcance,
        id: 'admin-2',
        rol: ROL_ADMIN,
        rolId: ROLES_REGISTRADOS[ROL_ADMIN],
        sucursalId: null,
      });
      repository.contarAdminsActivos.mockResolvedValue(1);

      await expect(
        useCase.ejecutar(admin, 'admin-2', {
          rol: ROL_EMPLEADO,
          sucursalId: SUC_CENTRO,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('nadie cambia su propio rol', async () => {
      repository.buscarPorIdEnAlcance.mockResolvedValue({
        ...empleadoEnAlcance,
        id: admin.id,
        rol: ROL_ADMIN,
        rolId: ROLES_REGISTRADOS[ROL_ADMIN],
        sucursalId: null,
      });

      await expect(
        useCase.ejecutar(admin, admin.id, { rol: ROL_EMPLEADO }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});