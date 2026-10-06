import { mismoNombre, normalizarNombre } from './nombres';

describe('comparacion de nombres', () => {
  describe('normalizarNombre', () => {
    it('recorta los espacios de los extremos', () => {
      expect(normalizarNombre('   Cafe   ')).toBe('cafe');
    });

    it('pasa a minusculas', () => {
      expect(normalizarNombre('LECHE')).toBe('leche');
    });

    it('colapsa separaciones internas repetidas a una sola', () => {
      expect(normalizarNombre('Cafe   con   leche')).toBe('cafe con leche');
    });

    it('deja intacto un nombre ya limpio', () => {
      expect(normalizarNombre('Harina de trigo')).toBe('harina de trigo');
    });

    it('devuelve cadena vacia para una cadena de espacios', () => {
      expect(normalizarNombre('     ')).toBe('');
    });
  });

  describe('mismoNombre', () => {
    it('trata como iguales los que solo difieren en mayusculas', () => {
      expect(mismoNombre('Leche', 'leche')).toBe(true);
      expect(mismoNombre('LECHE', 'Leche')).toBe(true);
    });

    it('trata como iguales los que solo difieren en espacios sobrantes', () => {
      expect(mismoNombre('  Cafe con leche  ', 'Cafe  con  leche')).toBe(true);
    });

    it('distingue los nombres realmente distintos', () => {
      expect(mismoNombre('Leche', 'Cafe')).toBe(false);
      expect(mismoNombre('Cafe con leche', 'Cafe')).toBe(false);
    });

    it('es simetrico', () => {
      expect(mismoNombre('Leche', ' leche ')).toBe(mismoNombre(' leche ', 'Leche'));
    });
  });
});
