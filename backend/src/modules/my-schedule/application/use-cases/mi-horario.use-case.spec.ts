// Pruebas unitarias del caso de uso del horario propio.
import { NotFoundException } from '@nestjs/common';
import { MiHorarioUseCase } from './mi-horario.use-case';

const empleado = {
  id: 'emp-1',
  usuarioId: 'usr-1',
  cargo: 'Barista',
  sucursalId: 'suc-1',
  fechaContratacion: new Date('2026-01-15T00:00:00.000Z'),
  fechaCese: null,
  estado: 'activo' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  usuario: {
    id: 'usr-1',
    nombre: 'Ada',
    nombreUsuario: 'ada',
    rol: 'Empleado',
  },
};

function asignacionSobrevendida(desde: string, hasta: string | null) {
  return {
    id: `asig-${desde}`,
    empleadoId: 'emp-1',
    fechaInicio: new Date(`${desde}T00:00:00.000Z`),
    fechaFin: hasta ? new Date(`${hasta}T00:00:00.000Z`) : null,
    turno: {
      tipo: 'fijo' as const,
      horaInicio: '07:30',
      horaFin: '16:00',
      diasSemana: '1,2,3,4,5',
    },
  };
}

describe('MiHorarioUseCase', () => {
  let authRepository: { obtenerUsuarioActivoPorId: jest.Mock };
  let employeesRepository: { buscarRespuestaPorUsuarioId: jest.Mock };
  let shiftsRepository: { listarAsignacionesPorEmpleado: jest.Mock };
  let branchesRepository: { buscarPorId: jest.Mock };
  let caso: MiHorarioUseCase;

  beforeEach(() => {
    authRepository = { obtenerUsuarioActivoPorId: jest.fn() };
    employeesRepository = { buscarRespuestaPorUsuarioId: jest.fn() };
    shiftsRepository = { listarAsignacionesPorEmpleado: jest.fn() };
    branchesRepository = { buscarPorId: jest.fn() };

    caso = new MiHorarioUseCase(
      authRepository as never,
      employeesRepository as never,
      shiftsRepository as never,
      branchesRepository as never,
    );
  });

  it('devuelve 404 cuando el usuario no tiene empleado vinculado', async () => {
    authRepository.obtenerUsuarioActivoPorId.mockResolvedValue({
      id: 'usr-1',
      estado: 'activo',
    });
    employeesRepository.buscarRespuestaPorUsuarioId.mockResolvedValue(null);

    await expect(caso.ejecutar('usr-1', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('devuelve el horario de un rango de una semana', async () => {
    authRepository.obtenerUsuarioActivoPorId.mockResolvedValue({
      id: 'usr-1',
      estado: 'activo',
    });
    employeesRepository.buscarRespuestaPorUsuarioId.mockResolvedValue(empleado);
    shiftsRepository.listarAsignacionesPorEmpleado.mockResolvedValue([
      asignacionSobrevendida('2026-10-12', '2026-10-18'),
    ]);
    branchesRepository.buscarPorId.mockResolvedValue({
      id: 'suc-1',
      nombre: 'Sucursal Centro',
    });

    const horario = await caso.ejecutar('usr-1', {
      desde: '2026-10-12',
      hasta: '2026-10-18',
    });

    expect(horario.empleado).toEqual({
      nombre: 'Ada',
      cargo: 'Barista',
      sucursal: 'Sucursal Centro',
    });
    // La semana por defecto tiene 7 días
    expect(horario.dias).toHaveLength(7);
    // Lunes 2026-10-12 tiene turno fijo
    const lunes = horario.dias.find((d) => d.fecha === '2026-10-12');
    expect(lunes?.turno).toMatchObject({ tipo: 'fijo', horaInicio: '07:30' });
  });

  it('un día sin asignación vigente devuelve turno null', async () => {
    authRepository.obtenerUsuarioActivoPorId.mockResolvedValue({
      id: 'usr-1',
      estado: 'activo',
    });
    employeesRepository.buscarRespuestaPorUsuarioId.mockResolvedValue(empleado);
    shiftsRepository.listarAsignacionesPorEmpleado.mockResolvedValue([]);
    branchesRepository.buscarPorId.mockResolvedValue({
      id: 'suc-1',
      nombre: 'Sucursal Centro',
    });

    const horario = await caso.ejecutar('usr-1', {
      desde: '2026-10-12',
      hasta: '2026-10-18',
    });

    expect(horario.dias).toHaveLength(7);
    expect(horario.dias.every((d) => d.turno === null)).toBe(true);
  });

  it('un cesado no obtiene horario posterior al cese', async () => {
    const cesado = { ...empleado, fechaCese: new Date('2026-10-14T00:00:00.000Z') };
    authRepository.obtenerUsuarioActivoPorId.mockResolvedValue({
      id: 'usr-1',
      estado: 'activo',
    });
    employeesRepository.buscarRespuestaPorUsuarioId.mockResolvedValue(cesado);
    shiftsRepository.listarAsignacionesPorEmpleado.mockResolvedValue([
      asignacionSobrevendida('2026-10-12', null),
    ]);
    branchesRepository.buscarPorId.mockResolvedValue({
      id: 'suc-1',
      nombre: 'Sucursal Centro',
    });

    const horario = await caso.ejecutar('usr-1', {
      desde: '2026-10-12',
      hasta: '2026-10-18',
    });

    // 2026-10-12 (lunes) y 2026-10-14 (miércoles, día del cese) tienen turno
    expect(horario.dias.find((d) => d.fecha === '2026-10-12')?.turno).not.toBeNull();
    expect(horario.dias.find((d) => d.fecha === '2026-10-14')?.turno).not.toBeNull();
    // 2026-10-15 (jueves, posterior al cese) no tiene turno
    expect(horario.dias.find((d) => d.fecha === '2026-10-15')?.turno).toBeNull();
  });

  it('rechaza un rango mayor a 92 días', async () => {
    authRepository.obtenerUsuarioActivoPorId.mockResolvedValue({
      id: 'usr-1',
      estado: 'activo',
    });
    employeesRepository.buscarRespuestaPorUsuarioId.mockResolvedValue(empleado);

    await expect(
      caso.ejecutar('usr-1', { desde: '2026-01-01', hasta: '2026-12-31' }),
    ).rejects.toThrow(/92/);
  });
});
