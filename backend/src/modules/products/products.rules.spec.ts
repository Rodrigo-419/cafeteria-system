import {
  esPrecioValido,
  estadosVisiblesConFiltro,
  estadosVisiblesPorRol,
  esVarianteBase,
  mismoNombre,
  normalizarNombre,
  NOMBRE_VARIANTE_BASE,
  PRECIO_DECIMALES,
  PRECIO_MAXIMO,
  PRECIO_MINIMO,
  puedeEditarPrecios,
  puedeVerPrecios,
  precioATextoDecimal,
  problemasPrecio,
  tieneMasDeDosDecimales,
  type ActorProductos,
} from './products.rules';
import { ROL_ADMIN, ROL_EMPLEADO, ROL_GERENTE } from '../users/domain/roles';

const ROL_DESCONOCIDO = 'supervisor';
const ROL_NULO = null;
const SIN_SUCURSAL: ActorProductos = { id: 'x', rol: null, sucursalId: null };

function actor(rol: string | null, sucursalId: string | null = 'suc-norte'): ActorProductos {
  return { id: `usr-${String(rol)}`, rol, sucursalId };
}

describe('products.rules', () => {
  describe('NOMBRE_VARIANTE_BASE', () => {
    it('coincide con la variante base que crea el seed, con tilde y mayuscula', () => {
      expect(NOMBRE_VARIANTE_BASE).toBe('Única');
    });
  });

  describe('puedeVerPrecios', () => {
    it('el Admin ve cualquier sucursal, incluida otra distinta a la suya', () => {
      expect(puedeVerPrecios(actor(ROL_ADMIN, 'suc-centro'), 'suc-norte')).toBe(true);
      expect(puedeVerPrecios(actor(ROL_ADMIN, null), 'suc-norte')).toBe(true);
    });

    it('el Gerente ve solo su propia sucursal', () => {
      expect(puedeVerPrecios(actor(ROL_GERENTE), 'suc-norte')).toBe(true);
      expect(puedeVerPrecios(actor(ROL_GERENTE), 'suc-sur')).toBe(false);
    });

    it('el Empleado ve solo su propia sucursal', () => {
      expect(puedeVerPrecios(actor(ROL_EMPLEADO), 'suc-norte')).toBe(true);
      expect(puedeVerPrecios(actor(ROL_EMPLEADO), 'suc-sur')).toBe(false);
    });

    it('un Gerente o Empleado sin sucursal no ve nada, ni la suya', () => {
      expect(puedeVerPrecios(actor(ROL_GERENTE, null), 'suc-norte')).toBe(false);
      expect(puedeVerPrecios(actor(ROL_EMPLEADO, null), 'suc-norte')).toBe(false);
    });

    it('un rol desconocido no ve nada, aunque encaje la sucursal', () => {
      expect(puedeVerPrecios(actor(ROL_DESCONOCIDO), 'suc-norte')).toBe(false);
    });

    it('un rol nulo o vacio no ve nada', () => {
      expect(puedeVerPrecios(actor(ROL_NULO), 'suc-norte')).toBe(false);
      expect(puedeVerPrecios(actor(''), 'suc-norte')).toBe(false);
    });
  });

  describe('puedeEditarPrecios', () => {
    it('el Gerente edita precios en su propia sucursal', () => {
      expect(puedeEditarPrecios(actor(ROL_GERENTE), 'suc-norte')).toBe(true);
    });

    it('el Gerente no edita precios en otra sucursal', () => {
      expect(puedeEditarPrecios(actor(ROL_GERENTE), 'suc-sur')).toBe(false);
    });

    it('el Admin NO edita precios, pese a verlos todos', () => {
      expect(puedeEditarPrecios(actor(ROL_ADMIN, 'suc-centro'), 'suc-norte')).toBe(false);
      expect(puedeEditarPrecios(actor(ROL_ADMIN, null), 'suc-norte')).toBe(false);
    });

    it('el Empleado no edita precios de su propia sucursal', () => {
      expect(puedeEditarPrecios(actor(ROL_EMPLEADO), 'suc-norte')).toBe(false);
    });

    it('un rol desconocido no edita precios', () => {
      expect(puedeEditarPrecios(actor(ROL_DESCONOCIDO), 'suc-norte')).toBe(false);
    });

    it('un Gerente sin sucursal no edita precios de ninguna', () => {
      expect(puedeEditarPrecios(actor(ROL_GERENTE, null), 'suc-norte')).toBe(false);
    });

    it('deja al Gerente como el unico actor que puede editar precios', () => {
      const actores: ActorProductos[] = [
        actor(ROL_ADMIN),
        actor(ROL_ADMIN, 'suc-centro'),
        actor(ROL_EMPLEADO),
        actor(ROL_DESCONOCIDO),
        actor(ROL_NULO),
        SIN_SUCURSAL,
      ];

      expect(actores.every((a) => !puedeEditarPrecios(a, 'suc-norte'))).toBe(true);
    });
  });

  describe('estadosVisiblesPorRol', () => {
    it('el Admin ve activo e inactivo', () => {
      expect(estadosVisiblesPorRol(ROL_ADMIN)).toEqual(['activo', 'inactivo']);
    });

    it('el Gerente ve activo e inactivo', () => {
      expect(estadosVisiblesPorRol(ROL_GERENTE)).toEqual(['activo', 'inactivo']);
    });

    it('el Empleado ve solo lo activo', () => {
      expect(estadosVisiblesPorRol(ROL_EMPLEADO)).toEqual(['activo']);
    });

    it('un rol desconocido no ve ningun estado', () => {
      expect(estadosVisiblesPorRol(ROL_DESCONOCIDO)).toEqual([]);
    });

    it('un rol nulo no ve ningun estado', () => {
      expect(estadosVisiblesPorRol(ROL_NULO)).toEqual([]);
      expect(estadosVisiblesPorRol(undefined)).toEqual([]);
    });

    it('la lista del Empleado es un subconjunto de la del Gerente', () => {
      const empleado = estadosVisiblesPorRol(ROL_EMPLEADO);
      const gerente = estadosVisiblesPorRol(ROL_GERENTE);

      expect(gerente).toEqual(expect.arrayContaining(empleado));
    });
  });

  describe('estadosVisiblesConFiltro', () => {
    it('sin filtro, el Admin ve los dos estados', () => {
      expect(estadosVisiblesConFiltro({ rol: ROL_ADMIN })).toEqual(['activo', 'inactivo']);
    });

    it('sin filtro, el Empleado ve solo lo activo', () => {
      expect(estadosVisiblesConFiltro({ rol: ROL_EMPLEADO })).toEqual(['activo']);
    });

    it('el Gerente puede filtrar por inactivo', () => {
      expect(estadosVisiblesConFiltro({ rol: ROL_GERENTE, filtro: 'inactivo' })).toEqual([
        'inactivo',
      ]);
    });

    it('el Empleado que filtra por inactivo no ve nada, en vez de saltarse el filtro', () => {
      expect(estadosVisiblesConFiltro({ rol: ROL_EMPLEADO, filtro: 'inactivo' })).toEqual([]);
    });

    it('un rol desconocido con filtro tampoco ve nada', () => {
      expect(estadosVisiblesConFiltro({ rol: ROL_DESCONOCIDO, filtro: 'activo' })).toEqual([]);
    });

    it('el filtro nunca amplia lo que el rol ve por defecto', () => {
      const pedido = estadosVisiblesConFiltro({ rol: ROL_EMPLEADO, filtro: 'activo' });

      expect(pedido.every((e) => estadosVisiblesPorRol(ROL_EMPLEADO).includes(e))).toBe(true);
    });
  });

  describe('normalizarNombre', () => {
    it('recorta los espacios de los extremos', () => {
      expect(normalizarNombre('   Cafe   ')).toBe('cafe');
    });

    it('pasa a minusculas', () => {
      expect(normalizarNombre('CAFÉ')).toBe('café');
    });

    it('colapsa separaciones internas repetidas a una sola', () => {
      expect(normalizarNombre('Cafe   con   leche')).toBe('cafe con leche');
    });

    it('deja intacto un nombre ya limpio', () => {
      expect(normalizarNombre('Cafe con leche')).toBe('cafe con leche');
    });

    it('devuelve cadena vacia para una cadena de espacios', () => {
      expect(normalizarNombre('     ')).toBe('');
    });
  });

  describe('mismoNombre', () => {
    it('trata como iguales nombres que solo difieren en mayusculas', () => {
      expect(mismoNombre('Cafe', 'cafe')).toBe(true);
      expect(mismoNombre('CAFÉ', 'café')).toBe(true);
    });

    it('trata como iguales nombres que solo difieren en espacios sobrantes', () => {
      expect(mismoNombre('  Cafe con leche  ', 'Cafe  con  leche')).toBe(true);
    });

    it('distingue nombres realmente distintos', () => {
      expect(mismoNombre('Cafe', 'Jugo')).toBe(false);
      expect(mismoNombre('Cafe con leche', 'Cafe')).toBe(false);
    });

    it('es simetrico', () => {
      expect(mismoNombre('Cafe', ' cafe ')).toBe(mismoNombre(' cafe ', 'Cafe'));
    });
  });

  describe('esVarianteBase', () => {
    it('reconoce la variante base con su nombre exacto', () => {
      expect(esVarianteBase(NOMBRE_VARIANTE_BASE)).toBe(true);
    });

    it('reconoce la variante base ignorando mayusculas y espacios', () => {
      expect(esVarianteBase('única')).toBe(true);
      expect(esVarianteBase('  ÚNICA  ')).toBe(true);
      expect(esVarianteBase('Ú nica')).toBe(false);
    });

    it('no confunde otras variantes con la base', () => {
      expect(esVarianteBase('Chico')).toBe(false);
      expect(esVarianteBase('Mediano')).toBe(false);
      expect(esVarianteBase('Grande')).toBe(false);
      expect(esVarianteBase('')).toBe(false);
    });
  });

  describe('tieneMasDeDosDecimales', () => {
    it('acepta hasta dos decimales', () => {
      expect(tieneMasDeDosDecimales(1)).toBe(false);
      expect(tieneMasDeDosDecimales(1.2)).toBe(false);
      expect(tieneMasDeDosDecimales(1.23)).toBe(false);
    });

    it('rechaza tres o mas decimales', () => {
      expect(tieneMasDeDosDecimales(1.234)).toBe(true);
      expect(tieneMasDeDosDecimales(0.125)).toBe(true);
    });

    it('no revienta con notacion exponencial', () => {
      expect(() => tieneMasDeDosDecimales(1e-7)).not.toThrow();
      expect(() => tieneMasDeDosDecimales(1e21)).not.toThrow();
    });
  });

  describe('problemasPrecio', () => {
    it('acepta un precio valido sin problemas', () => {
      expect(problemasPrecio(12.5)).toEqual([]);
      expect(problemasPrecio(0.01)).toEqual([]);
      expect(problemasPrecio(100000)).toEqual([]);
      expect(problemasPrecio(0.1)).toEqual([]);
    });

    it('rechaza un numero fuera del rango, por debajo', () => {
      expect(problemasPrecio(0)).toEqual([
        `El precio debe estar entre ${PRECIO_MINIMO} y ${PRECIO_MAXIMO}`,
      ]);
      expect(problemasPrecio(-1)).not.toEqual([]);
    });

    it('rechaza un numero fuera del rango, por encima', () => {
      expect(problemasPrecio(100000.01)).toEqual([
        `El precio debe estar entre ${PRECIO_MINIMO} y ${PRECIO_MAXIMO}`,
      ]);
      expect(problemasPrecio(999999)).not.toEqual([]);
    });

    it('rechaza mas de dos decimales', () => {
      expect(problemasPrecio(1.234)).toEqual([
        'El precio no puede tener mas de 2 decimales',
      ]);
    });

    it('acumula los dos problemas cuando fallan rango y decimales', () => {
      expect(problemasPrecio(1000000.555)).toHaveLength(2);
    });

    it('rechaza lo que no es un numero', () => {
      expect(problemasPrecio('10')).toEqual(['El precio debe ser un numero']);
      expect(problemasPrecio(null)).toEqual(['El precio debe ser un numero']);
      expect(problemasPrecio(undefined)).toEqual(['El precio debe ser un numero']);
      expect(problemasPrecio({})).toEqual(['El precio debe ser un numero']);
      expect(problemasPrecio([])).toEqual(['El precio debe ser un numero']);
    });

    it('rechaza NaN e Infinity sin lanzar', () => {
      expect(problemasPrecio(Number.NaN)).toEqual(['El precio debe ser un numero']);
      expect(problemasPrecio(Number.POSITIVE_INFINITY)).toEqual([
        'El precio debe ser un numero',
      ]);
      expect(problemasPrecio(Number.NEGATIVE_INFINITY)).toEqual([
        'El precio debe ser un numero',
      ]);
    });

    it('devuelve mensajes utilisables como cuerpo de un 400', () => {
      for (const problemas of [
        problemasPrecio(1e-7),
        problemasPrecio('x'),
        problemasPrecio(1.234),
      ]) {
        expect(problemas.length).toBeGreaterThan(0);
        expect(problemas.every((p) => typeof p === 'string' && p.length > 0)).toBe(true);
      }
    });
  });

  describe('esPrecioValido', () => {
    it('acepta los precios validos', () => {
      expect(esPrecioValido(0.01)).toBe(true);
      expect(esPrecioValido(100)).toBe(true);
      expect(esPrecioValido(99.99)).toBe(true);
      expect(esPrecioValido(100000)).toBe(true);
    });

    it('rechaza los limites excluidos', () => {
      expect(esPrecioValido(0)).toBe(false);
      expect(esPrecioValido(0.001)).toBe(false);
      expect(esPrecioValido(100000.01)).toBe(false);
    });

    it('rechaza mas de dos decimales', () => {
      expect(esPrecioValido(1.001)).toBe(false);
      expect(esPrecioValido(10.5555)).toBe(false);
    });

    it('coincide con problemasPrecio vacio', () => {
      const muestras: unknown[] = [0, 0.01, 1.234, 99.99, 100000, 100001, '5', null];

      for (const muestra of muestras) {
        expect(esPrecioValido(muestra)).toBe(problemasPrecio(muestra).length === 0);
      }
    });
  });

  describe('precioATextoDecimal', () => {
    it('fija exactamente dos decimales', () => {
      expect(precioATextoDecimal(10)).toBe('10.00');
      expect(precioATextoDecimal(10.5)).toBe('10.50');
      expect(precioATextoDecimal(10.05)).toBe('10.05');
    });

    it('redondea a dos decimales', () => {
      expect(precioATextoDecimal(10.456)).toBe('10.46');
      expect(precioATextoDecimal(0.014)).toBe('0.01');
    });

    it('respeta PRECIO_DECIMALES', () => {
      expect(PRECIO_DECIMALES).toBe(2);
      expect(precioATextoDecimal(1).split('.')[1]).toHaveLength(PRECIO_DECIMALES);
    });

    it('el texto que produce vuelve a ser un precio valido', () => {
      for (const precio of [0.01, 1, 12.5, 99.99, 100000]) {
        expect(esPrecioValido(Number(precioATextoDecimal(precio)))).toBe(true);
      }
    });
  });
});
