import { Actor, filtroAlcanceListado, puedeGestionarUsuario } from './alcance';
import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../roles';

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: 'actor-1',
    rol: ROL_ADMIN,
    sucursalId: null,
    permisosEfectivos: [],
    ...overrides,
  };
}

describe('alcance', () => {
  describe('puedeGestionarUsuario', () => {
    it('un Admin gestiona a cualquier usuario', () => {
      const admin = actor({ rol: ROL_ADMIN });

      expect(
        puedeGestionarUsuario(admin, {
          id: 'u1',
          rol: ROL_ADMIN,
          sucursalId: null,
        }),
      ).toBe(true);
      expect(
        puedeGestionarUsuario(admin, {
          id: 'u2',
          rol: ROL_GERENTE,
          sucursalId: 'suc-1',
        }),
      ).toBe(true);
      expect(
        puedeGestionarUsuario(admin, {
          id: 'u3',
          rol: ROL_EMPLEADO,
          sucursalId: 'suc-9',
        }),
      ).toBe(true);
    });

    it('un Gerente gestiona a los Empleados de su sucursal', () => {
      const gerente = actor({ rol: ROL_GERENTE, sucursalId: 'suc-1' });

      expect(
        puedeGestionarUsuario(gerente, {
          id: 'u1',
          rol: ROL_EMPLEADO,
          sucursalId: 'suc-1',
        }),
      ).toBe(true);
    });

    it('un Gerente NO gestiona a un Empleado de otra sucursal', () => {
      const gerente = actor({ rol: ROL_GERENTE, sucursalId: 'suc-1' });

      expect(
        puedeGestionarUsuario(gerente, {
          id: 'u1',
          rol: ROL_EMPLEADO,
          sucursalId: 'suc-2',
        }),
      ).toBe(false);
    });

    it('un Gerente NO gestiona a otro Gerente ni a un Admin', () => {
      const gerente = actor({ rol: ROL_GERENTE, sucursalId: 'suc-1' });

      expect(
        puedeGestionarUsuario(gerente, {
          id: 'u1',
          rol: ROL_GERENTE,
          sucursalId: 'suc-1',
        }),
      ).toBe(false);
      expect(
        puedeGestionarUsuario(gerente, {
          id: 'u2',
          rol: ROL_ADMIN,
          sucursalId: null,
        }),
      ).toBe(false);
    });

    it('un Gerente sin sucursal no gestiona a nadie', () => {
      const gerente = actor({ rol: ROL_GERENTE, sucursalId: null });

      expect(
        puedeGestionarUsuario(gerente, {
          id: 'u1',
          rol: ROL_EMPLEADO,
          sucursalId: 'suc-1',
        }),
      ).toBe(false);
    });

    it('un Empleado no gestiona a nadie', () => {
      const empleado = actor({ rol: ROL_EMPLEADO, sucursalId: 'suc-1' });

      expect(
        puedeGestionarUsuario(empleado, {
          id: 'u1',
          rol: ROL_EMPLEADO,
          sucursalId: 'suc-1',
        }),
      ).toBe(false);
    });
  });

  describe('filtroAlcanceListado', () => {
    it('el Admin no filtra', () => {
      expect(filtroAlcanceListado(actor({ rol: ROL_ADMIN }))).toBeUndefined();
    });

    it('el Gerente queda limitado a los Empleados de su sucursal', () => {
      expect(
        filtroAlcanceListado(
          actor({ rol: ROL_GERENTE, sucursalId: 'suc-1' }),
        ),
      ).toEqual({ sucursalId: 'suc-1', rol: ROL_EMPLEADO });
    });

    it('un rol sin alcance recibe un filtro imposible para no filtrar nada', () => {
      const filtro = filtroAlcanceListado(
        actor({ rol: ROL_EMPLEADO, sucursalId: 'suc-1' }),
      );

      expect(filtro).toBeDefined();
      expect(filtro?.sucursalId).toBe('__sin_alcance__');
    });
  });
});