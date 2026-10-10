import { REGISTRO_ENTRADA, REGISTRO_SALIDA } from './registros-efectivos';
import { problemaMarcaje } from './marcaje';

describe('problema de marcaje', () => {
  const DIA = '2026-10-10';

  it('permite una entrada cuando no hay ninguna abierta', () => {
    expect(problemaMarcaje(REGISTRO_ENTRADA, DIA, [])).toBeNull();
  });

  it('permite una entrada cuando la abierta es de un dia anterior', () => {
    const abiertas = [{ diaLocal: '2026-10-09' }];
    expect(problemaMarcaje(REGISTRO_ENTRADA, DIA, abiertas)).toBeNull();
  });

  it('rechaza doble entrada con una abierta del mismo dia', () => {
    const abiertas = [{ diaLocal: DIA }];
    expect(problemaMarcaje(REGISTRO_ENTRADA, DIA, abiertas)).toBe(
      'Ya hay una entrada abierta de hoy',
    );
  });

  it('permite una salida cuando hay una entrada abierta del mismo dia', () => {
    const abiertas = [{ diaLocal: DIA }];
    expect(problemaMarcaje(REGISTRO_SALIDA, DIA, abiertas)).toBeNull();
  });

  it('rechaza una salida sin entrada abierta del mismo dia', () => {
    expect(problemaMarcaje(REGISTRO_SALIDA, DIA, [])).toBe(
      'No hay una entrada abierta de hoy para cerrar',
    );
  });

  it('rechaza una salida cuando la unica abierta es de ayer', () => {
    const abiertas = [{ diaLocal: '2026-10-09' }];
    expect(problemaMarcaje(REGISTRO_SALIDA, DIA, abiertas)).toBe(
      'No hay una entrada abierta de hoy para cerrar',
    );
  });

  it('rechaza un tipo de marcaje desconocido', () => {
    expect(problemaMarcaje('pausa', DIA, [])).toBe('Tipo de marcaje no valido');
  });
});