import { CATALOGO_EXPORTS } from './catalogo';
import { CONJUNTOS } from '../domain/limites';

describe('catalogo exports', () => {
  it('has all CONJUNTOS', () => {
    for (const conjunto of CONJUNTOS) {
      expect(CATALOGO_EXPORTS[conjunto]).toBeDefined();
    }
  });

  it('each conjunto has required fields', () => {
    for (const conjunto of CONJUNTOS) {
      const item = CATALOGO_EXPORTS[conjunto];
      expect(item.clave).toBe(conjunto);
      expect(item.etiqueta).toBeDefined();
      expect(Array.isArray(item.columnas)).toBe(true);
      expect(item.columnas.length).toBeGreaterThan(0);
      expect(typeof item.permisoLectura).toBe('string');
      expect(typeof item.obtenerDatos).toBe('function');
    }
  });

  it('columns are in Spanish without internal ids', () => {
    for (const conjunto of CONJUNTOS) {
      const item = CATALOGO_EXPORTS[conjunto];
      for (const col of item.columnas) {
        expect(typeof col).toBe('string');
        expect(col).not.toMatch(/^[a-z]+_id$/i);
        expect(col).not.toMatch(/^id$/i);
        expect(col).not.toMatch(/uuid/i);
        expect(col).not.toMatch(/hash|pin|password|contraseña/i);
      }
    }
  });

  it('cada conjunto tiene permiso de lectura válido', () => {
    const permisosValidos = ['ventas.ver','carta.ver','stock.ver','movimientos.ver','empleados.ver','turnos.ver','asignaciones.ver','asistencia.ver','faltas.ver','equipos.ver','usuarios.ver','sucursales.ver','reportes.ver','auditoria.ver'];
    for (const conjunto of CONJUNTOS) {
      const item = CATALOGO_EXPORTS[conjunto];
      expect(permisosValidos).toContain(item.permisoLectura);
    }
  });

  it('cada conjunto tiene columnas en español sin ids internos ni datos sensibles', () => {
    for (const conjunto of CONJUNTOS) {
      const item = CATALOGO_EXPORTS[conjunto];
      expect(Array.isArray(item.columnas)).toBe(true);
      expect(item.columnas.length).toBeGreaterThan(0);
      for (const col of item.columnas) {
        expect(col).not.toMatch(/_id$/i);
        expect(col).not.toMatch(/^id$/i);
        expect(col).not.toMatch(/password|contraseña|hash|pin|token/i);
      }
    }
  });
});
