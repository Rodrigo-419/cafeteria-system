import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../users/domain/roles';
import {
  filtroSucursalesVisibles,
  mismoNombreSucursal,
  normalizarNombreSucursal,
  puedeVerSucursal,
  SIN_ALCANCE,
  type ActorSucursales,
} from './branches.rules';

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

describe('branches.rules', () => {
  describe('puedeVerSucursal', () => {
    it('el Admin ve cualquier sucursal', () => {
      expect(puedeVerSucursal(admin, 'suc-centro')).toBe(true);
      expect(puedeVerSucursal(admin, 'suc-norte')).toBe(true);
    });

    it('un Gerente solo ve la suya', () => {
      expect(puedeVerSucursal(gerente, 'suc-centro')).toBe(true);
      expect(puedeVerSucursal(gerente, 'suc-norte')).toBe(false);
    });

    it('un Empleado solo ve la suya', () => {
      expect(puedeVerSucursal(empleado, 'suc-centro')).toBe(true);
      expect(puedeVerSucursal(empleado, 'suc-norte')).toBe(false);
    });

    it('un actor sin sucursal no ve ninguna', () => {
      // El dato puede faltar aunque el rol no lo admita; no debe abrirse la
      // puerta a ver todo.
      const sinSucursal: ActorSucursales = {
        id: 'x',
        rol: ROL_GERENTE,
        sucursalId: null,
      };

      expect(puedeVerSucursal(sinSucursal, 'suc-centro')).toBe(false);
      expect(puedeVerSucursal(sinSucursal, '')).toBe(false);
    });

    it('un rol desconocido no ve ninguna', () => {
      const raro: ActorSucursales = {
        id: 'x',
        rol: 'Superusuario',
        sucursalId: 'suc-centro',
      };

      expect(puedeVerSucursal(raro, 'suc-centro')).toBe(false);
    });

    it('no confunde una sucursal con otra de id parecido', () => {
      expect(puedeVerSucursal(gerente, 'suc-centro-2')).toBe(false);
    });
  });

  describe('filtroSucursalesVisibles', () => {
    it('el Admin no filtra', () => {
      expect(filtroSucursalesVisibles(admin)).toBeUndefined();
    });

    it('un Gerente y un Empleado se quedan con la suya', () => {
      expect(filtroSucursalesVisibles(gerente)).toEqual({
        sucursalId: 'suc-centro',
      });
      expect(filtroSucursalesVisibles(empleado)).toEqual({
        sucursalId: 'suc-centro',
      });
    });

    it('un actor sin sucursal recibe un filtro que no casa con ninguna fila', () => {
      const sinSucursal: ActorSucursales = {
        id: 'x',
        rol: ROL_EMPLEADO,
        sucursalId: null,
      };

      expect(filtroSucursalesVisibles(sinSucursal)).toEqual({
        sucursalId: SIN_ALCANCE,
      });
    });
  });

  describe('normalizarNombreSucursal', () => {
    it('recorta los espacios de los extremos', () => {
      expect(normalizarNombreSucursal('  Sucursal Centro  ')).toBe(
        'sucursal centro',
      );
    });

    it('reduce las separaciones internas a un unico espacio', () => {
      expect(normalizarNombreSucursal('Sucursal    Centro')).toBe(
        'sucursal centro',
      );
      expect(normalizarNombreSucursal('Sucursal \t\n Centro')).toBe(
        'sucursal centro',
      );
    });

    it('pasa a minusculas', () => {
      expect(normalizarNombreSucursal('SUCURSAL CENTRO')).toBe('sucursal centro');
    });
  });

  describe('mismoNombreSucursal', () => {
    it('ignora mayusculas y espacios sobrantes', () => {
      expect(mismoNombreSucursal('Sucursal Centro', '  sucursal   centro ')).toBe(
        true,
      );
    });

    it('distingue nombres distintos', () => {
      expect(mismoNombreSucursal('Sucursal Centro', 'Sucursal Norte')).toBe(false);
      expect(mismoNombreSucursal('Sucursal Centro', 'Sucursal Centro 2')).toBe(
        false,
      );
    });
  });
});
