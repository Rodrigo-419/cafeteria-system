import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../../../users/domain/roles';
import {
  ActorTurnos,
  alcanceEmpleadosParaAsignaciones,
  filtroAlcanceTurnos,
  puedeGestionarTurnos,
} from './alcance';

function actor(overrides: Partial<ActorTurnos> = {}): ActorTurnos {
  return {
    id: 'actor-1',
    rol: ROL_ADMIN,
    sucursalId: null,
    permisosEfectivos: [],
    ...overrides,
  };
}

describe('alcance de turnos', () => {
  describe('filtroAlcanceTurnos', () => {
    it('el Admin no filtra', () => {
      expect(filtroAlcanceTurnos(actor({ rol: ROL_ADMIN }))).toBeUndefined();
    });

    it('el Gerente queda limitado a su sucursal', () => {
      expect(
        filtroAlcanceTurnos(actor({ rol: ROL_GERENTE, sucursalId: 'suc-1' })),
      ).toEqual({ sucursalId: 'suc-1' });
    });

    it('un rol sin alcance recibe un filtro imposible para no filtrar nada', () => {
      const filtro = filtroAlcanceTurnos(
        actor({ rol: ROL_EMPLEADO, sucursalId: 'suc-1' }),
      );

      expect(filtro).toEqual({ sucursalId: '__sin_alcance_turnos__' });
    });

    it('un Gerente sin sucursal recibe un filtro imposible', () => {
      expect(
        filtroAlcanceTurnos(actor({ rol: ROL_GERENTE, sucursalId: null })),
      ).toEqual({ sucursalId: '__sin_alcance_turnos__' });
    });
  });

  describe('alcanceEmpleadosParaAsignaciones', () => {
    it('reutiliza el alcance de empleados', () => {
      expect(
        alcanceEmpleadosParaAsignaciones(
          actor({ rol: ROL_GERENTE, sucursalId: 'suc-1' }),
        ),
      ).toEqual({ sucursalId: 'suc-1', usuarioRol: ROL_EMPLEADO });

      expect(
        alcanceEmpleadosParaAsignaciones(actor({ rol: ROL_ADMIN })),
      ).toBeUndefined();
    });
  });

  describe('puedeGestionarTurnos', () => {
    it('el Admin siempre puede', () => {
      expect(puedeGestionarTurnos(actor({ rol: ROL_ADMIN }))).toBe(true);
    });

    it('el Gerente con sucursal puede', () => {
      expect(
        puedeGestionarTurnos(actor({ rol: ROL_GERENTE, sucursalId: 'suc-1' })),
      ).toBe(true);
    });

    it('el Gerente sin sucursal no puede', () => {
      expect(
        puedeGestionarTurnos(actor({ rol: ROL_GERENTE, sucursalId: null })),
      ).toBe(false);
    });

    it('un Empleado no puede', () => {
      expect(
        puedeGestionarTurnos(actor({ rol: ROL_EMPLEADO, sucursalId: 'suc-1' })),
      ).toBe(false);
    });
  });
});
