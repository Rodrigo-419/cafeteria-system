import {
  puedeAccederEquipo,
  esTransicionEstadoValida,
  esEstadoTerminal,
  hayCambioNombre,
  hayCambioTexto,
  requiereHistorial,
  filtroEquiposVisibles,
  SIN_ALCANCE_EQUIPO,
} from './equipment.rules';

describe('equipment.rules', () => {
  describe('puedeAccederEquipo', () => {
    it('admin accede a cualquier sucursal', () => {
      expect(puedeAccederEquipo({ id: '1', rol: 'admin', sucursalId: null }, 's1')).toBe(true);
      expect(puedeAccederEquipo({ id: '1', rol: 'Admin', sucursalId: 'otra' }, 's1')).toBe(true);
    });

    it('gerente y empleado solo acceden a su sucursal', () => {
      expect(puedeAccederEquipo({ id: '1', rol: 'Gerente', sucursalId: 's1' }, 's1')).toBe(true);
      expect(puedeAccederEquipo({ id: '1', rol: 'Empleado', sucursalId: 's1' }, 's1')).toBe(true);
    });

    it('gerente y empleado no acceden a otra sucursal ni con sucursal nula', () => {
      expect(puedeAccederEquipo({ id: '1', rol: 'Gerente', sucursalId: 's1' }, 's2')).toBe(false);
      expect(puedeAccederEquipo({ id: '1', rol: 'Gerente', sucursalId: null }, 's1')).toBe(false);
      expect(puedeAccederEquipo({ id: '1', rol: 'Empleado', sucursalId: 's1' }, 's2')).toBe(false);
    });

    it('otros roles no acceden', () => {
      expect(puedeAccederEquipo({ id: '1', rol: 'cajero', sucursalId: 's1' }, 's1')).toBe(false);
    });
  });

  describe('filtroEquiposVisibles', () => {
    it('admin sin filtro', () => {
      expect(filtroEquiposVisibles({ id: '1', rol: 'admin', sucursalId: 's1' })).toBeUndefined();
    });

    it('gerente/empleado con su sucursal', () => {
      expect(filtroEquiposVisibles({ id: '1', rol: 'Gerente', sucursalId: 's1' })).toEqual({ sucursalId: 's1' });
      expect(filtroEquiposVisibles({ id: '1', rol: 'Empleado', sucursalId: 's2' })).toEqual({ sucursalId: 's2' });
    });

    it('sin sucursal asignada usa id imposible', () => {
      expect(filtroEquiposVisibles({ id: '1', rol: 'Gerente', sucursalId: null })).toEqual({ sucursalId: SIN_ALCANCE_EQUIPO });
    });
  });

  describe('transiciones', () => {
    it('retirado es terminal', () => {
      expect(esEstadoTerminal('retirado')).toBe(true);
      expect(esEstadoTerminal('funcionando')).toBe(false);
    });

    it('no permite cambiar estado si ya está retirado', () => {
      expect(esTransicionEstadoValida('retirado', 'funcionando')).toBe(false);
      expect(esTransicionEstadoValida('retirado', 'danado')).toBe(false);
    });

    it('permite misma transición', () => {
      expect(esTransicionEstadoValida('funcionando', 'funcionando')).toBe(true);
    });

    it('permite transiciones entre estados no terminales', () => {
      expect(esTransicionEstadoValida('funcionando', 'danado')).toBe(true);
      expect(esTransicionEstadoValida('danado', 'en_mantenimiento')).toBe(true);
      expect(esTransicionEstadoValida('en_mantenimiento', 'funcionando')).toBe(true);
      expect(esTransicionEstadoValida('funcionando', 'retirado')).toBe(true);
    });
  });

  describe('cambios', () => {
    it('detecta cambio de nombre', () => {
      expect(hayCambioNombre('Equipo  A', 'equipo a')).toBe(false);
      expect(hayCambioNombre('Equipo A', 'Equipo B')).toBe(true);
    });

    it('detecta cambio de texto', () => {
      expect(hayCambioTexto('obs', ' obs ')).toBe(false);
      expect(hayCambioTexto(null, '')).toBe(false);
      expect(hayCambioTexto('a', 'b')).toBe(true);
      expect(hayCambioTexto('a', null)).toBe(true);
    });

    it('requiere historial solo con cambios de estado u observaciones', () => {
      expect(requiereHistorial(true, false)).toBe(true);
      expect(requiereHistorial(false, true)).toBe(true);
      expect(requiereHistorial(false, false)).toBe(false);
      expect(requiereHistorial(true, true)).toBe(true);
    });
  });
});
