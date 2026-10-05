import {
  dejaSinAdminActivo,
  forzarRolYSucursalAlCrear,
  puedeModificarSuPropioEstado,
  puedeModificarSuPropioRol,
  validarRolYSucursal,
} from './reglas-rol-sucursal';
import { puedeModificarSusPropiosPermisos } from './reglas-rol-sucursal';
import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../roles';

describe('reglas-rol-sucursal', () => {
  describe('validarRolYSucursal', () => {
    it('un Admin sin sucursal es valido', () => {
      expect(validarRolYSucursal(ROL_ADMIN, null)).toEqual([]);
    });

    it('un Admin con sucursal es invalido', () => {
      expect(validarRolYSucursal(ROL_ADMIN, 'suc-1').length).toBe(1);
    });

    it('un Gerente o Empleado con sucursal es valido', () => {
      expect(validarRolYSucursal(ROL_GERENTE, 'suc-1')).toEqual([]);
      expect(validarRolYSucursal(ROL_EMPLEADO, 'suc-1')).toEqual([]);
    });

    it('un Gerente o Empleado sin sucursal es invalido', () => {
      expect(validarRolYSucursal(ROL_GERENTE, null).length).toBe(1);
      expect(validarRolYSucursal(ROL_EMPLEADO, null).length).toBe(1);
    });
  });

  describe('forzarRolYSucursalAlCrear', () => {
    it('un Gerente crea siempre un Empleado en su propia sucursal', () => {
      const gerente = { rol: ROL_GERENTE, sucursalId: 'suc-1' };

      expect(forzarRolYSucursalAlCrear(gerente, ROL_EMPLEADO, 'suc-99')).toEqual({
        rol: ROL_EMPLEADO,
        sucursalId: 'suc-1',
      });
    });

    it('un Gerente no puede crear un Gerente ni un Admin aunque lo pida', () => {
      const gerente = { rol: ROL_GERENTE, sucursalId: 'suc-1' };

      expect(forzarRolYSucursalAlCrear(gerente, ROL_GERENTE, 'suc-2').rol).toBe(
        ROL_EMPLEADO,
      );
      expect(forzarRolYSucursalAlCrear(gerente, ROL_ADMIN, null).rol).toBe(
        ROL_EMPLEADO,
      );
    });

    it('un Admin crea el rol y la sucursal que pide', () => {
      const admin = { rol: ROL_ADMIN, sucursalId: null };

      expect(forzarRolYSucursalAlCrear(admin, ROL_GERENTE, 'suc-7')).toEqual({
        rol: ROL_GERENTE,
        sucursalId: 'suc-7',
      });
      expect(forzarRolYSucursalAlCrear(admin, ROL_ADMIN, null)).toEqual({
        rol: ROL_ADMIN,
        sucursalId: null,
      });
    });
  });

  describe('dejaSinAdminActivo', () => {
    it('el unico Admin activo no puede ser bloqueado', () => {
      expect(
        dejaSinAdminActivo({
          objetivoEsAdminActivo: true,
          adminsActivosTotales: 1,
          cambiaEstadoABloqueado: true,
          dejaDeSerAdmin: false,
        }),
      ).toBe(true);
    });

    it('el unico Admin activo no puede dejar de ser Admin', () => {
      expect(
        dejaSinAdminActivo({
          objetivoEsAdminActivo: true,
          adminsActivosTotales: 1,
          cambiaEstadoABloqueado: false,
          dejaDeSerAdmin: true,
        }),
      ).toBe(true);
    });

    it('se permite si hay mas de un Admin activo', () => {
      expect(
        dejaSinAdminActivo({
          objetivoEsAdminActivo: true,
          adminsActivosTotales: 2,
          cambiaEstadoABloqueado: true,
          dejaDeSerAdmin: false,
        }),
      ).toBe(false);
    });

    it('no aplica a un objetivo que no es Admin activo', () => {
      expect(
        dejaSinAdminActivo({
          objetivoEsAdminActivo: false,
          adminsActivosTotales: 1,
          cambiaEstadoABloqueado: true,
          dejaDeSerAdmin: true,
        }),
      ).toBe(false);
    });

    it('un Admin bloqueado que se reactiva no dispara la proteccion', () => {
      expect(
        dejaSinAdminActivo({
          objetivoEsAdminActivo: false,
          adminsActivosTotales: 1,
          cambiaEstadoABloqueado: false,
          dejaDeSerAdmin: false,
        }),
      ).toBe(false);
    });
  });

  describe('nadie cambia su propio rol, estado ni permisos', () => {
    it('detecta el propio id', () => {
      expect(puedeModificarSuPropioRol('u1', 'u1')).toBe(false);
      expect(puedeModificarSuPropioEstado('u1', 'u1')).toBe(false);
      expect(puedeModificarSusPropiosPermisos('u1', 'u1')).toBe(false);
    });

    it('permite cambiar a otro usuario', () => {
      expect(puedeModificarSuPropioRol('u1', 'u2')).toBe(true);
      expect(puedeModificarSuPropioEstado('u1', 'u2')).toBe(true);
      expect(puedeModificarSusPropiosPermisos('u1', 'u2')).toBe(true);
    });
  });
});