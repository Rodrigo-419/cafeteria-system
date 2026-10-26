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
    // Codigos que existen en el seed (no se inventan permisos nuevos).
    const permisosValidos = [
      'ventas.ver',
      'productos.ver',
      'insumos.ver',
      'inventario.registrar',
      'empleados.crear_editar',
      'turnos.editar',
      'asistencia.ver',
      'equipo.ver',
      'usuarios.crear_editar',
      'sucursales.ver',
      'reportes.comparativos.ver',
    ];
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
