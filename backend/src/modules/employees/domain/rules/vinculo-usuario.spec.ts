import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../../../users/domain/roles';
import { problemasVinculoEmpleado } from './vinculo-usuario';

describe('vinculo empleado-usuario', () => {
  it('acepta un usuario Empleado con sucursal', () => {
    expect(
      problemasVinculoEmpleado({
        rolUsuario: ROL_EMPLEADO,
        sucursalUsuario: 'suc-1',
      }),
    ).toEqual([]);
  });

  it('acepta un usuario Gerente con sucursal', () => {
    expect(
      problemasVinculoEmpleado({
        rolUsuario: ROL_GERENTE,
        sucursalUsuario: 'suc-1',
      }),
    ).toEqual([]);
  });

  it('rechaza un usuario Admin', () => {
    const problemas = problemasVinculoEmpleado({
      rolUsuario: ROL_ADMIN,
      sucursalUsuario: null,
    });

    expect(problemas).toContain('Un usuario con rol Admin no puede ser empleado');
  });

  it('rechaza un usuario sin sucursal', () => {
    const problemas = problemasVinculoEmpleado({
      rolUsuario: ROL_EMPLEADO,
      sucursalUsuario: null,
    });

    expect(problemas).toContain('El usuario debe tener una sucursal asignada');
  });

  it('exige que la sucursal pedida coincida con la del usuario', () => {
    const problemas = problemasVinculoEmpleado({
      rolUsuario: ROL_EMPLEADO,
      sucursalUsuario: 'suc-1',
      sucursalEmpleado: 'suc-2',
    });

    expect(problemas).toContain(
      'La sucursal del empleado debe coincidir con la del usuario',
    );
  });

  it('no se queja si la sucursal pedida coincide', () => {
    expect(
      problemasVinculoEmpleado({
        rolUsuario: ROL_EMPLEADO,
        sucursalUsuario: 'suc-1',
        sucursalEmpleado: 'suc-1',
      }),
    ).toEqual([]);
  });
});
