import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

jest.mock('./equipment.repository', () => ({
  EquipmentRepository: class EquipmentRepository {},
}));

import { EquipmentService } from './equipment.service';
import type {
  EquipmentRepository,
  EquipoFila,
  HistorialEquipoFila,
} from './equipment.repository';
import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../users/domain/roles';

type Repo = {
  existeSucursal: jest.Mock;
  crearEquipo: jest.Mock;
  enTransaccion: jest.Mock;
  obtenerEquipoConBloqueo: jest.Mock;
  actualizarEquipo: jest.Mock;
  crearHistorial: jest.Mock;
  buscarEquipoPorId: jest.Mock;
  listarEquipos: jest.Mock;
  contarEquipos: jest.Mock;
  listarHistorial: jest.Mock;
  contarHistorial: jest.Mock;
};

const TX = { tx: true };

function equipo(overrides: Partial<EquipoFila> = {}): EquipoFila {
  return {
    id: 'eq-1',
    sucursalId: 's1',
    nombre: 'Cafetera',
    tipo: 'Cafetera',
    estado: 'funcionando',
    observaciones: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function historial(overrides: Partial<HistorialEquipoFila> = {}): HistorialEquipoFila {
  return {
    id: 'h-1',
    equipoId: 'eq-1',
    estadoAnterior: 'funcionando',
    estadoNuevo: 'danado',
    observacionesAnterior: null,
    observacionesNuevas: null,
    usuarioId: 'u2',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    usuario: { id: 'u2', nombre: 'Gerente' },
    ...overrides,
  };
}

const admin = { id: 'admin-1', rol: ROL_ADMIN, sucursalId: null };
const gerente = { id: 'ger-1', rol: ROL_GERENTE, sucursalId: 's1' };
const gerenteSinSucursal = { id: 'ger-2', rol: ROL_GERENTE, sucursalId: null };
const empleado = { id: 'emp-1', rol: ROL_EMPLEADO, sucursalId: 's1' };

describe('EquipmentService', () => {
  let repository: Repo;
  let service: EquipmentService;

  beforeEach(() => {
    repository = {
      existeSucursal: jest.fn().mockResolvedValue(true),
      crearEquipo: jest.fn().mockResolvedValue(equipo({ id: 'eq-nuevo' })),
      enTransaccion: jest.fn(async (operacion: (tx: unknown) => Promise<EquipoFila>) =>
        operacion(TX),
      ),
      obtenerEquipoConBloqueo: jest.fn().mockResolvedValue(equipo()),
      actualizarEquipo: jest.fn().mockResolvedValue(equipo()),
      crearHistorial: jest.fn().mockResolvedValue(historial()),
      buscarEquipoPorId: jest.fn().mockResolvedValue(equipo()),
      listarEquipos: jest.fn().mockResolvedValue([]),
      contarEquipos: jest.fn().mockResolvedValue(0),
      listarHistorial: jest.fn().mockResolvedValue([]),
      contarHistorial: jest.fn().mockResolvedValue(0),
    };

    service = new EquipmentService(repository as unknown as EquipmentRepository);
  });

  describe('crear', () => {
    it('un admin crea en la sucursal indicada recortando los textos', async () => {
      await service.crear(admin, {
        sucursalId: 's1',
        nombre: '  Cafetera Nuevo  ',
        tipo: ' Cafetera ',
        observaciones: ' Texto ',
      });

      expect(repository.existeSucursal).toHaveBeenCalledWith('s1');
      expect(repository.crearEquipo).toHaveBeenCalledWith({
        sucursalId: 's1',
        nombre: 'Cafetera Nuevo',
        tipo: 'Cafetera',
        observaciones: 'Texto',
      });
    });

    it('un admin recibe 404 si la sucursal no existe', async () => {
      repository.existeSucursal.mockResolvedValue(false);

      await expect(
        service.crear(admin, { sucursalId: 'sx', nombre: 'Cafetera', tipo: 'Cafetera' }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.crearEquipo).not.toHaveBeenCalled();
    });

    it('un gerente forza su propia sucursal', async () => {
      await service.crear(gerente, {
        sucursalId: 'otra',
        nombre: 'Cafetera',
        tipo: 'Cafetera',
      });

      expect(repository.crearEquipo).toHaveBeenCalledWith(
        expect.objectContaining({ sucursalId: 's1' }),
      );
      expect(repository.existeSucursal).not.toHaveBeenCalled();
    });

    it('un gerente sin sucursal asignada recibe 403', async () => {
      await expect(
        service.crear(gerenteSinSucursal, {
          sucursalId: 's1',
          nombre: 'Cafetera',
          tipo: 'Cafetera',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.crearEquipo).not.toHaveBeenCalled();
    });

    it('observaciones vacias se guardan como null', async () => {
      await service.crear(admin, {
        sucursalId: 's1',
        nombre: 'Cafetera',
        tipo: 'Cafetera',
        observaciones: '   ',
      });

      expect(repository.crearEquipo).toHaveBeenCalledWith(
        expect.objectContaining({ observaciones: null }),
      );
    });
  });

  describe('actualizar', () => {
    it('cambiar de estado registra el historial dentro de la transaccion', async () => {
      repository.actualizarEquipo.mockResolvedValue(equipo({ estado: 'danado' }));

      const resultado = await service.actualizar(gerente, 'eq-1', { estado: 'danado' });

      expect(resultado.estado).toBe('danado');
      expect(repository.enTransaccion).toHaveBeenCalled();
      expect(repository.obtenerEquipoConBloqueo).toHaveBeenCalledWith('eq-1', TX);
      expect(repository.crearHistorial).toHaveBeenCalledWith(
        {
          equipoId: 'eq-1',
          estadoAnterior: 'funcionando',
          estadoNuevo: 'danado',
          observacionesAnterior: null,
          observacionesNuevas: null,
          usuarioId: 'ger-1',
        },
        TX,
      );
    });

    it('cambiar las observaciones registra el historial', async () => {
      repository.obtenerEquipoConBloqueo.mockResolvedValue(
        equipo({ observaciones: 'Antigua' }),
      );
      repository.actualizarEquipo.mockResolvedValue(equipo({ observaciones: 'Nueva' }));

      await service.actualizar(gerente, 'eq-1', { observaciones: ' Nueva ' });

      expect(repository.crearHistorial).toHaveBeenCalledWith(
        expect.objectContaining({
          observacionesAnterior: 'Antigua',
          observacionesNuevas: 'Nueva',
          estadoAnterior: 'funcionando',
          estadoNuevo: 'funcionando',
        }),
        TX,
      );
    });

    it('cambiar solo el nombre no genera historial', async () => {
      const resultado = await service.actualizar(gerente, 'eq-1', {
        nombre: 'Cafetera Renombrada',
      });

      expect(repository.actualizarEquipo).toHaveBeenCalled();
      expect(repository.crearHistorial).not.toHaveBeenCalled();
      expect(resultado.nombre).toBe('Cafetera');
    });

    it('un equipo retirado no vuelve a cambiar de estado -> 409', async () => {
      repository.obtenerEquipoConBloqueo.mockResolvedValue(equipo({ estado: 'retirado' }));

      await expect(
        service.actualizar(gerente, 'eq-1', { estado: 'funcionando' }),
      ).rejects.toThrow(ConflictException);
      expect(repository.actualizarEquipo).not.toHaveBeenCalled();
    });

    it('una transicion invalida devuelve 400', async () => {
      repository.obtenerEquipoConBloqueo.mockResolvedValue(equipo({ estado: 'retirado' }));

      await expect(
        service.actualizar(gerente, 'eq-1', { estado: 'en_mantenimiento' }),
      ).rejects.toThrow(ConflictException);
    });

    it('un gerente no actualiza un equipo de otra sucursal -> 404', async () => {
      repository.obtenerEquipoConBloqueo.mockResolvedValue(equipo({ sucursalId: 'otra' }));

      await expect(
        service.actualizar(gerente, 'eq-1', { estado: 'danado' }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.actualizarEquipo).not.toHaveBeenCalled();
    });

    it('un admin puede actualizar un equipo de cualquier sucursal', async () => {
      await service.actualizar(admin, 'eq-1', { estado: 'en_mantenimiento' });

      expect(repository.actualizarEquipo).toHaveBeenCalled();
    });

    it('un equipo inexistente -> 404', async () => {
      repository.obtenerEquipoConBloqueo.mockResolvedValue(null);

      await expect(
        service.actualizar(admin, 'eq-1', { estado: 'danado' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('sin cambios devuelve el equipo sin tocar la transaccion de historial', async () => {
      const resultado = await service.actualizar(gerente, 'eq-1', {
        nombre: 'Cafetera',
        tipo: 'Cafetera',
        estado: 'funcionando',
      });

      expect(repository.actualizarEquipo).not.toHaveBeenCalled();
      expect(repository.crearHistorial).not.toHaveBeenCalled();
      expect(resultado.id).toBe('eq-1');
    });
  });

  describe('obtener', () => {
    it('un admin obtiene un equipo de cualquier sucursal', async () => {
      repository.buscarEquipoPorId.mockResolvedValue(equipo({ sucursalId: 'otra' }));

      await expect(service.obtener(admin, 'eq-1')).resolves.toEqual(
        expect.objectContaining({ id: 'eq-1' }),
      );
    });

    it('un gerente obtiene un equipo de su sucursal', async () => {
      await expect(service.obtener(gerente, 'eq-1')).resolves.toEqual(
        expect.objectContaining({ sucursalId: 's1' }),
      );
    });

    it('un gerente no puede obtener un equipo de otra sucursal -> 404', async () => {
      repository.buscarEquipoPorId.mockResolvedValue(equipo({ sucursalId: 'otra' }));

      await expect(service.obtener(gerente, 'eq-1')).rejects.toThrow(NotFoundException);
    });

    it('un equipo inexistente -> 404', async () => {
      repository.buscarEquipoPorId.mockResolvedValue(null);

      await expect(service.obtener(gerente, 'eq-1')).rejects.toThrow(NotFoundException);
    });

    it('un empleado obtiene un equipo de su sucursal', async () => {
      await expect(service.obtener(empleado, 'eq-1')).resolves.toEqual(
        expect.objectContaining({ sucursalId: 's1' }),
      );
    });
  });

  describe('listar', () => {
    it('un admin lista sin filtro de sucursal', async () => {
      repository.listarEquipos.mockResolvedValue([equipo()]);
      repository.contarEquipos.mockResolvedValue(1);

      const resultado = await service.listar(admin, {
        page: 1,
        limit: 10,
      });

      expect(repository.listarEquipos).toHaveBeenCalledWith(
        expect.objectContaining({ sucursalId: undefined }),
      );
      expect(resultado).toEqual({
        data: [equipo()],
        total: 1,
        page: 1,
        limit: 10,
        totalPaginas: 1,
      });
    });

    it('un admin puede filtrar por sucursal', async () => {
      await service.listar(admin, { sucursalId: 's2', page: 1, limit: 10 });

      expect(repository.listarEquipos).toHaveBeenCalledWith(
        expect.objectContaining({ sucursalId: 's2' }),
      );
    });

    it('un gerente solo lista su sucursal', async () => {
      await service.listar(gerente, { page: 1, limit: 10 });

      expect(repository.listarEquipos).toHaveBeenCalledWith(
        expect.objectContaining({ sucursalId: 's1' }),
      );
    });

    it('una persona sin alcance recibe una lista vacia', async () => {
      repository.listarEquipos.mockResolvedValue([equipo()]);
      repository.contarEquipos.mockResolvedValue(5);

      const resultado = await service.listar(gerenteSinSucursal, { page: 1, limit: 10 });

      expect(repository.listarEquipos).not.toHaveBeenCalled();
      expect(resultado.data).toEqual([]);
      expect(resultado.total).toBe(0);
    });

    it('un empleado solo lista su sucursal', async () => {
      await service.listar(empleado, { page: 2, limit: 5 });

      expect(repository.listarEquipos).toHaveBeenCalledWith(
        expect.objectContaining({ sucursalId: 's1', page: 2, limit: 5 }),
      );
    });
  });

  describe('listarHistorial', () => {
    it('un admin lista el historial paginado', async () => {
      repository.listarHistorial.mockResolvedValue([historial()]);
      repository.contarHistorial.mockResolvedValue(1);

      const resultado = await service.listarHistorial(admin, 'eq-1', { page: 1, limit: 10 });

      expect(repository.listarHistorial).toHaveBeenCalledWith({
        equipoId: 'eq-1',
        page: 1,
        limit: 10,
      });
      expect(resultado).toEqual({
        data: [historial()],
        total: 1,
        page: 1,
        limit: 10,
        totalPaginas: 1,
      });
    });

    it('un gerente de otra sucursal -> 404', async () => {
      repository.buscarEquipoPorId.mockResolvedValue(equipo({ sucursalId: 'otra' }));

      await expect(
        service.listarHistorial(gerente, 'eq-1', { page: 1, limit: 10 }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.listarHistorial).not.toHaveBeenCalled();
    });

    it('un equipo inexistente -> 404', async () => {
      repository.buscarEquipoPorId.mockResolvedValue(null);

      await expect(
        service.listarHistorial(admin, 'eq-1', { page: 1, limit: 10 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});