import { REGISTRO_ENTRADA, REGISTRO_SALIDA } from './registros-efectivos';
import {
  cierrePosteriorAEntrada,
  correccionFutura,
  esCierreAdministrativo,
  permiteCorreccion,
} from './correccion';

describe('validez de correcciones', () => {
  describe('permiteCorreccion', () => {
    it('permite corregir el mismo tipo', () => {
      expect(permiteCorreccion(REGISTRO_ENTRADA, REGISTRO_ENTRADA)).toBe(true);
      expect(permiteCorreccion(REGISTRO_SALIDA, REGISTRO_SALIDA)).toBe(true);
    });

    it('permite el cierre administrativo de una entrada', () => {
      expect(permiteCorreccion(REGISTRO_ENTRADA, REGISTRO_SALIDA)).toBe(true);
    });

    it('rechaza convertir una salida en entrada', () => {
      expect(permiteCorreccion(REGISTRO_SALIDA, REGISTRO_ENTRADA)).toBe(false);
    });
  });

  describe('esCierreAdministrativo', () => {
    it('solo es cierre cuando el original es una entrada y la correccion salida', () => {
      expect(esCierreAdministrativo(REGISTRO_ENTRADA, REGISTRO_SALIDA)).toBe(true);
      expect(esCierreAdministrativo(REGISTRO_ENTRADA, REGISTRO_ENTRADA)).toBe(false);
      expect(esCierreAdministrativo(REGISTRO_SALIDA, REGISTRO_SALIDA)).toBe(false);
    });
  });

  describe('correccionFutura', () => {
    it('es futura si supera el momento actual', () => {
      const ahora = new Date('2026-10-10T12:00:00.000Z');
      expect(correccionFutura(new Date('2026-10-10T12:00:01.000Z'), ahora)).toBe(true);
      expect(correccionFutura(new Date('2026-10-10T12:00:00.000Z'), ahora)).toBe(false);
      expect(correccionFutura(new Date('2026-10-10T11:59:59.000Z'), ahora)).toBe(false);
    });
  });

  describe('cierrePosteriorAEntrada', () => {
    it('el cierre debe ser estrictamente posterior a la entrada efectiva', () => {
      const entrada = new Date('2026-10-09T08:00:00.000Z');
      expect(cierrePosteriorAEntrada(entrada, new Date('2026-10-09T18:00:00.000Z'))).toBe(true);
      expect(cierrePosteriorAEntrada(entrada, new Date('2026-10-09T08:00:00.000Z'))).toBe(false);
      expect(cierrePosteriorAEntrada(entrada, new Date('2026-10-09T07:59:59.000Z'))).toBe(false);
    });
  });
});