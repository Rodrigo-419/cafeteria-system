import {
  diasSeCruzan,
  diasSemanaDe,
  problemasDiasSemana,
} from './dias-semana';

describe('dias de la semana', () => {
  describe('problemasDiasSemana', () => {
    it('acepta una lista valida en orden ascendente', () => {
      expect(problemasDiasSemana('1,2,3,4,5')).toEqual([]);
      expect(problemasDiasSemana('7')).toEqual([]);
      expect(problemasDiasSemana('1, 2, 3')).toEqual([]);
    });

    it('rechaza una lista vacia', () => {
      expect(problemasDiasSemana('')).toContain(
        'diasSemana no puede estar vacio',
      );
    });

    it('rechaza un dia fuera del rango 1-7', () => {
      expect(problemasDiasSemana('1,8')).toContain(
        'El dia 8 esta fuera del rango 1-7',
      );
      expect(problemasDiasSemana('0,1')).toContain(
        'El dia 0 esta fuera del rango 1-7',
      );
    });

    it('rechaza un valor que no es numero', () => {
      expect(problemasDiasSemana('1,lunes')).toContain(
        '"lunes" no es un numero de dia valido',
      );
    });

    it('rechaza dias repetidos', () => {
      expect(problemasDiasSemana('1,1,2')).toContain(
        'Los dias de la semana no se pueden repetir',
      );
    });

    it('rechaza una lista desordenada', () => {
      expect(problemasDiasSemana('3,1')).toContain(
        'Los dias de la semana deben venir en orden ascendente',
      );
      expect(problemasDiasSemana('1,2,3')).not.toContain(
        'Los dias de la semana deben venir en orden ascendente',
      );
    });
  });

  describe('diasSemanaDe', () => {
    it('devuelve la lista de numeros', () => {
      expect(diasSemanaDe('1,3,5')).toEqual([1, 3, 5]);
    });

    it('devuelve vacio si no hay texto', () => {
      expect(diasSemanaDe(null)).toEqual([]);
      expect(diasSemanaDe('')).toEqual([]);
    });
  });

  describe('diasSeCruzan', () => {
    it('comparte al menos un dia', () => {
      expect(diasSeCruzan('1,2,3', '3,4,5')).toBe(true);
    });

    it('no comparte ningun dia', () => {
      expect(diasSeCruzan('1,2', '4,5')).toBe(false);
    });

    it('trata el hueco como sin dias', () => {
      expect(diasSeCruzan(null, '1,2')).toBe(false);
      expect(diasSeCruzan('1,2', null)).toBe(false);
    });
  });
});
