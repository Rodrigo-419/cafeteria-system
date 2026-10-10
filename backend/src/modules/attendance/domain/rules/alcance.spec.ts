import { filtroAlcanceAsistencia, SIN_ALCANCE_ASISTENCIA } from './alcance';
import { puedeVerRegistroAsistencia } from './alcance';

describe('alcance de asistencia', () => {
  describe('filtroAlcanceAsistencia', () => {
    it('el Admin no filtra nada', () => {
      expect(
        filtroAlcanceAsistencia({ id: 'u1', rol: 'Admin', sucursalId: null }),
      ).toEqual({});
    });

    it('el Gerente filtra por su sucursal', () => {
      expect(
        filtroAlcanceAsistencia({
          id: 'u1',
          rol: 'Gerente',
          sucursalId: 's1',
        }),
      ).toEqual({ sucursalId: 's1' });
    });

    it('un Gerente sin sucursal recibe un filtro imposible', () => {
      expect(
        filtroAlcanceAsistencia({ id: 'u1', rol: 'Gerente', sucursalId: null }),
      ).toEqual({ sucursalId: SIN_ALCANCE_ASISTENCIA });
    });

    it('el Empleado filtra por su propio usuario', () => {
      expect(
        filtroAlcanceAsistencia({ id: 'u1', rol: 'Empleado', sucursalId: 's1' }),
      ).toEqual({ empleadoUsuarioId: 'u1' });
    });

    it('un rol no reconocido recibe un filtro imposible', () => {
      expect(
        filtroAlcanceAsistencia({ id: 'u1', rol: null, sucursalId: 's1' }),
      ).toEqual({ sucursalId: SIN_ALCANCE_ASISTENCIA });
    });
  });

  describe('puedeVerRegistroAsistencia', () => {
    const objetivo = { sucursalId: 's1', usuarioId: 'uEmp' };

    it('el Admin ve cualquier registro', () => {
      expect(
        puedeVerRegistroAsistencia(
          { id: 'a', rol: 'Admin', sucursalId: null },
          objetivo,
        ),
      ).toBe(true);
    });

    it('el Gerente ve solo los de su sucursal', () => {
      const gerente = { id: 'g', rol: 'Gerente', sucursalId: 's1' };
      expect(puedeVerRegistroAsistencia(gerente, objetivo)).toBe(true);
      expect(
        puedeVerRegistroAsistencia(
          { ...gerente, sucursalId: 's2' },
          objetivo,
        ),
      ).toBe(false);
    });

    it('el Empleado ve solo los suyos', () => {
      const empleado = { id: 'uEmp', rol: 'Empleado', sucursalId: 's1' };
      expect(puedeVerRegistroAsistencia(empleado, objetivo)).toBe(true);
      expect(puedeVerRegistroAsistencia({ ...empleado, id: 'otro' }, objetivo))
        .toBe(false);
    });
  });
});