import {
  PERMISOS_CONCEDIBLES_A_EMPLEADO,
  validarAsignacionPermiso,
} from './reglas-permisos';
import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../roles';

const BASE = {
  permisosDelActor: ['insumos.ver', 'ventas.ver'],
  codigoPermiso: 'insumos.ver',
  tipo: 'concedido' as const,
  rolObjetivo: ROL_EMPLEADO,
  permisosPorDefectoDelObjetivo: ['ventas.ver'],
};

describe('reglas-permisos', () => {
  describe('quien asigna debe poseer el permiso', () => {
    it('permite si el actor lo tiene entre sus permisos efectivos', () => {
      expect(validarAsignacionPermiso(BASE)).toEqual([]);
    });

    it('rechaza si el actor no lo posee', () => {
      const problemas = validarAsignacionPermiso({
        ...BASE,
        permisosDelActor: ['ventas.ver'],
      });

      expect(problemas).toHaveLength(1);
      expect(problemas[0]).toContain('no lo tienes');
    });

    it('rechaza si el actor solo lo tiene por rol revoked', () => {
      const problemas = validarAsignacionPermiso({
        ...BASE,
        permisosDelActor: [],
      });

      expect(problemas.length).toBeGreaterThan(0);
    });
  });

  describe('limites para un objetivo Empleado', () => {
    it('permite conceder los cuatro permisos de la lista', () => {
      for (const codigo of PERMISOS_CONCEDIBLES_A_EMPLEADO) {
        const problemas = validarAsignacionPermiso({
          ...BASE,
          codigoPermiso: codigo,
          permisosDelActor: [codigo],
        });

        expect(problemas).toEqual([]);
      }
    });

    it('rechaza conceder a un Empleado un permiso fuera de la lista', () => {
      const problemas = validarAsignacionPermiso({
        ...BASE,
        codigoPermiso: 'ventas.ver',
        permisosDelActor: ['ventas.ver'],
      });

      expect(problemas.some((p) => p.includes('solo se les pueden conceder'))).toBe(
        true,
      );
    });

    it('no limita la revocacion a la lista de concedibles', () => {
      // `ventas.ver` no es concedible a un Empleado, pero si esta en el rol, asi
      // que se puede revocar.
      expect(
        validarAsignacionPermiso({
          ...BASE,
          codigoPermiso: 'ventas.ver',
          tipo: 'revocado',
          permisosDelActor: ['ventas.ver'],
        }),
      ).toEqual([]);
    });
  });

  describe('la revocacion se limita a los permisos del rol', () => {
    it('permite revocar un permiso que el rol tiene por defecto', () => {
      expect(
        validarAsignacionPermiso({
          ...BASE,
          codigoPermiso: 'ventas.ver',
          tipo: 'revocado',
          rolObjetivo: ROL_GERENTE,
          permisosDelActor: ['ventas.ver'],
          permisosPorDefectoDelObjetivo: ['ventas.ver', 'ventas.anular'],
        }),
      ).toEqual([]);
    });

    it('rechaza revocar un permiso que el rol no tiene', () => {
      const problemas = validarAsignacionPermiso({
        ...BASE,
        codigoPermiso: 'ventas.ver',
        tipo: 'revocado',
        rolObjetivo: ROL_ADMIN,
        permisosDelActor: ['ventas.ver'],
        permisosPorDefectoDelObjetivo: ['insumos.ver'],
      });

      expect(problemas.some((p) => p.includes('no lo tiene por defecto'))).toBe(true);
    });

    it('no limita la concesion para un objetivo no Empleado', () => {
      expect(
        validarAsignacionPermiso({
          ...BASE,
          codigoPermiso: 'ventas.ver',
          rolObjetivo: ROL_ADMIN,
          permisosDelActor: ['ventas.ver'],
        }),
      ).toEqual([]);
    });
  });

  it('acumula todos los problemas que encuentra', () => {
    const problemas = validarAsignacionPermiso({
      ...BASE,
      permisosDelActor: [],
      codigoPermiso: 'ventas.ver',
      tipo: 'revocado',
      rolObjetivo: ROL_EMPLEADO,
      permisosPorDefectoDelObjetivo: [],
    });

    expect(problemas).toHaveLength(2);
  });
});