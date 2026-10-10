import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../../../users/domain/roles';
import {
  ActorEmpleados,
  filtroAlcanceEmpleados,
  puedeGestionarEmpleado,
} from './alcance';

function actor(overrides: Partial<ActorEmpleados> = {}): ActorEmpleados {
  return {
    id: 'actor-1',
    rol: ROL_ADMIN,
    sucursalId: null,
    permisosEfectivos: [],
    ...overrides,
  };
}

describe('alcance de empleados', () => {
  describe('puedeGestionarEmpleado', () => {
    it('un Admin gestiona a cualquier empleado', () => {
      const admin = actor({ rol: ROL_ADMIN });

      expect(
        puedeGestionarEmpleado(admin, {
          sucursalId: 'suc-9',
          usuarioRol: ROL_GERENTE,
        }),
      ).toBe(true);
      expect(
        puedeGestionarEmpleado(admin, {
          sucursalId: 'suc-1',
          usuarioRol: ROL_EMPLEADO,
        }),
      ).toBe(true);
    });

    it('un Gerente gestiona a los empleados de usuario Empleado de su sucursal', () => {
      const gerente = actor({ rol: ROL_GERENTE, sucursalId: 'suc-1' });

      expect(
        puedeGestionarEmpleado(gerente, {
          sucursalId: 'suc-1',
          usuarioRol: ROL_EMPLEADO,
        }),
      ).toBe(true);
    });

    it('un Gerente NO gestiona a un empleado vinculado a un usuario Gerente', () => {
      const gerente = actor({ rol: ROL_GERENTE, sucursalId: 'suc-1' });

      expect(
        puedeGestionarEmpleado(gerente, {
          sucursalId: 'suc-1',
          usuarioRol: ROL_GERENTE,
        }),
      ).toBe(false);
    });

    it('un Gerente NO gestiona a un empleado de otra sucursal', () => {
      const gerente = actor({ rol: ROL_GERENTE, sucursalId: 'suc-1' });

      expect(
        puedeGestionarEmpleado(gerente, {
          sucursalId: 'suc-2',
          usuarioRol: ROL_EMPLEADO,
        }),
      ).toBe(false);
    });

    it('un Gerente sin sucursal no gestiona a nadie', () => {
      const gerente = actor({ rol: ROL_GERENTE, sucursalId: null });

      expect(
        puedeGestionarEmpleado(gerente, {
          sucursalId: 'suc-1',
          usuarioRol: ROL_EMPLEADO,
        }),
      ).toBe(false);
    });

    it('un Empleado no gestiona a nadie', () => {
      const empleado = actor({ rol: ROL_EMPLEADO, sucursalId: 'suc-1' });

      expect(
        puedeGestionarEmpleado(empleado, {
          sucursalId: 'suc-1',
          usuarioRol: ROL_EMPLEADO,
        }),
      ).toBe(false);
    });
  });

  describe('filtroAlcanceEmpleados', () => {
    it('el Admin no filtra', () => {
      expect(filtroAlcanceEmpleados(actor({ rol: ROL_ADMIN }))).toBeUndefined();
    });

    it('el Gerente queda limitado a los usuarios Empleado de su sucursal', () => {
      expect(
        filtroAlcanceEmpleados(
          actor({ rol: ROL_GERENTE, sucursalId: 'suc-1' }),
        ),
      ).toEqual({ sucursalId: 'suc-1', usuarioRol: ROL_EMPLEADO });
    });

    it('un rol sin alcance recibe un filtro imposible para no filtrar nada', () => {
      const filtro = filtroAlcanceEmpleados(
        actor({ rol: ROL_EMPLEADO, sucursalId: 'suc-1' }),
      );

      expect(filtro).toBeDefined();
      expect(filtro?.sucursalId).toBe('__sin_alcance_empleados__');
      expect(filtro?.usuarioRol).toBe('__sin_alcance_empleados__');
    });
  });
});
