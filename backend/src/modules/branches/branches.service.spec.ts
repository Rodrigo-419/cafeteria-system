import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

jest.mock('./branches.repository', () => ({
  BranchesRepository: class BranchesRepository {},
}));

import { BranchesService, type ActorSucursales } from './branches.service';
import type {
  BranchesRepository,
  SucursalRespuesta,
} from './branches.repository';
import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../users/domain/roles';

type Repo = {
  buscarPorId: jest.Mock;
  listar: jest.Mock;
  nombreEnUso: jest.Mock;
  crear: jest.Mock;
  actualizar: jest.Mock;
};

function sucursal(overrides: Partial<SucursalRespuesta> = {}): SucursalRespuesta {
  return {
    id: 'suc-centro',
    nombre: 'Sucursal Centro',
    direccion: 'Calle Mayor 1',
    telefono: '900000000',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

const admin: ActorSucursales = { id: 'admin-1', rol: ROL_ADMIN, sucursalId: null };
const gerente: ActorSucursales = {
  id: 'ger-1',
  rol: ROL_GERENTE,
  sucursalId: 'suc-centro',
};
const empleado: ActorSucursales = {
  id: 'emp-1',
  rol: ROL_EMPLEADO,
  sucursalId: 'suc-centro',
};

describe('BranchesService', () => {
  let repository: Repo;
  let service: BranchesService;

  beforeEach(() => {
    repository = {
      buscarPorId: jest.fn().mockResolvedValue(sucursal()),
      listar: jest.fn().mockResolvedValue([]),
      nombreEnUso: jest.fn().mockResolvedValue(false),
      crear: jest.fn().mockResolvedValue(sucursal({ id: 'suc-nueva' })),
      actualizar: jest.fn().mockResolvedValue(sucursal()),
    };

    service = new BranchesService(
      repository as unknown as BranchesRepository,
    );
  });

  // ------------------------------------------------------------------- crear

  it('crea una sucursal recortando los textos', async () => {
    await service.crear(admin, {
      nombre: '  Sucursal Nueva  ',
      direccion: '  Calle Nueva 2  ',
      telefono: '  600000000  ',
    });

    expect(repository.crear).toHaveBeenCalledWith({
      nombre: 'Sucursal Nueva',
      direccion: 'Calle Nueva 2',
      telefono: '600000000',
    });
  });

  it('crea con telefono null cuando no se envia', async () => {
    await service.crear(admin, { nombre: 'Sucursal Nueva', direccion: 'Calle 1' });

    expect(repository.crear).toHaveBeenCalledWith({
      nombre: 'Sucursal Nueva',
      direccion: 'Calle 1',
      telefono: null,
    });
  });

  it('rechaza un nombre duplicado con 409', async () => {
    repository.nombreEnUso.mockResolvedValue(true);

    await expect(
      service.crear(admin, { nombre: 'Sucursal Centro', direccion: 'Calle 1' }),
    ).rejects.toThrow(ConflictException);
    expect(repository.crear).not.toHaveBeenCalled();
  });

  it('comprueba el duplicado sobre el nombre ya recortado', async () => {
    await service.crear(admin, {
      nombre: '  Sucursal Nueva  ',
      direccion: 'Calle 1',
    });

    expect(repository.nombreEnUso).toHaveBeenCalledWith('Sucursal Nueva', undefined);
  });

  it('traduce a 409 la violacion del indice unico de la base', async () => {
    // Carrera entre dos peticiones que pasan a la vez la comprobacion previa:
    // la base es la que resuelve y hay que devolver el mismo 409. Prisma marca
    // sus errores conocidos con `code`.
    repository.crear.mockRejectedValue({ code: 'P2002', meta: {} });

    await expect(
      service.crear(admin, { nombre: 'Sucursal Nueva', direccion: 'Calle 1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('deja escapar cualquier otro error de la base', async () => {
    const fallo = new Error('connection lost');
    repository.crear.mockRejectedValue(fallo);

    await expect(
      service.crear(admin, { nombre: 'Sucursal Nueva', direccion: 'Calle 1' }),
    ).rejects.toThrow('connection lost');
  });

  it('deja escapar un error de Prisma que no sea de unicidad', async () => {
    const otro = { code: 'P2025', meta: {} };
    repository.crear.mockRejectedValue(otro);

    await expect(
      service.crear(admin, { nombre: 'Sucursal Nueva', direccion: 'Calle 1' }),
    ).rejects.toBe(otro);
  });

  // ----------------------------------------------------------------- editar

  it('edita solo los campos enviados', async () => {
    await service.actualizar(admin, 'suc-centro', { direccion: 'Calle Nueva 5' });

    expect(repository.actualizar).toHaveBeenCalledWith('suc-centro', {
      direccion: 'Calle Nueva 5',
    });
  });

  it('edita recortando los textos', async () => {
    await service.actualizar(admin, 'suc-centro', {
      nombre: '  Sucursal Centro  ',
      telefono: '  911111111  ',
    });

    expect(repository.actualizar).toHaveBeenCalledWith('suc-centro', {
      nombre: 'Sucursal Centro',
      telefono: '911111111',
    });
  });

  it('permite vaciar el telefono con null', async () => {
    await service.actualizar(admin, 'suc-centro', { telefono: null });

    expect(repository.actualizar).toHaveBeenCalledWith('suc-centro', {
      telefono: null,
    });
  });

  it('rechaza editar una sucursal inexistente con 404', async () => {
    repository.buscarPorId.mockResolvedValue(null);

    await expect(
      service.actualizar(admin, 'suc-fantasma', { direccion: 'Calle 1' }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.actualizar).not.toHaveBeenCalled();
  });

  it('no exige comprobar el nombre si la edicion no lo cambia', async () => {
    await service.actualizar(admin, 'suc-centro', { direccion: 'Calle 1' });

    expect(repository.nombreEnUso).not.toHaveBeenCalled();
  });

  it('no considera conflicto el nombre de la propia sucursal', async () => {
    await service.actualizar(admin, 'suc-centro', { nombre: 'Sucursal Centro' });

    expect(repository.nombreEnUso).toHaveBeenCalledWith('Sucursal Centro', 'suc-centro');
  });

  it('rechaza con 409 tomar el nombre de otra sucursal', async () => {
    repository.nombreEnUso.mockResolvedValue(true);

    await expect(
      service.actualizar(admin, 'suc-centro', { nombre: 'Sucursal Norte' }),
    ).rejects.toThrow(ConflictException);
    expect(repository.actualizar).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------- listar

  it('el Admin lista sin filtro: todas las sucursales', async () => {
    await service.listar(admin);

    expect(repository.listar).toHaveBeenCalledWith(undefined);
  });

  it('un Gerente lista solo su sucursal', async () => {
    await service.listar(gerente);

    expect(repository.listar).toHaveBeenCalledWith('suc-centro');
  });

  it('un Empleado lista solo su sucursal', async () => {
    await service.listar(empleado);

    expect(repository.listar).toHaveBeenCalledWith('suc-centro');
  });

  // --------------------------------------------------------------- obtener

  it('el Admin obtiene cualquier sucursal', async () => {
    repository.buscarPorId.mockResolvedValue(
      sucursal({ id: 'suc-norte', nombre: 'Sucursal Norte' }),
    );

    const resultado = await service.obtener(admin, 'suc-norte');

    expect(resultado.nombre).toBe('Sucursal Norte');
  });

  it('un Gerente obtiene la suya', async () => {
    const resultado = await service.obtener(gerente, 'suc-centro');

    expect(resultado.id).toBe('suc-centro');
  });

  it('un Gerente obtiene 404 al pedir otra sucursal que si existe', async () => {
    repository.buscarPorId.mockResolvedValue(
      sucursal({ id: 'suc-norte', nombre: 'Sucursal Norte' }),
    );

    await expect(service.obtener(gerente, 'suc-norte')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('un Empleado obtiene 404 al pedir una sucursal inexistente', async () => {
    repository.buscarPorId.mockResolvedValue(null);

    await expect(service.obtener(empleado, 'suc-fantasma')).rejects.toThrow(
      NotFoundException,
    );
  });
});
