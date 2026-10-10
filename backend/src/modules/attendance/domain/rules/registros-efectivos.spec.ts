import {
  derivarAsistencia,
  entradasAbiertas,
  eventosEfectivos,
  REGISTRO_ENTRADA,
  REGISTRO_SALIDA,
  type RegistroAsistenciaFila,
} from './registros-efectivos';

function fila(
  id: string,
  tipo: string,
  fechaHora: string,
  extra: Partial<RegistroAsistenciaFila> = {},
): RegistroAsistenciaFila {
  return {
    id,
    tipo,
    fechaHora: new Date(fechaHora),
    esCorreccion: false,
    registroOriginalId: null,
    ...extra,
  };
}

function correccion(
  id: string,
  originalId: string,
  tipo: string,
  fechaHora: string,
): RegistroAsistenciaFila {
  return fila(id, tipo, fechaHora, {
    esCorreccion: true,
    registroOriginalId: originalId,
  });
}

const DIA = '2026-10-09';

describe('registros efectivos de asistencia', () => {
  describe('eventosEfectivos', () => {
    it('usa la hora de la correccion del mismo tipo en vez de la original', () => {
      const entrada = fila('e1', REGISTRO_ENTRADA, `${DIA}T08:00:00.000Z`);
      const salida = fila('s1', REGISTRO_SALIDA, `${DIA}T17:00:00.000Z`);
      const correccionEntrada = correccion('ce', 'e1', REGISTRO_ENTRADA, `${DIA}T08:30:00.000Z`);

      const eventos = eventosEfectivos([entrada, salida, correccionEntrada]);

      const eventoEntrada = eventos.find((e) => e.tipo === REGISTRO_ENTRADA);
      expect(eventoEntrada?.fechaHora.toISOString()).toBe(
        `${DIA}T08:30:00.000Z`,
      );
      expect(eventoEntrada?.correccionId).toBe('ce');
    });

    it('una correccion de tipo contrario a una entrada añade una salida', () => {
      const entrada = fila('e1', REGISTRO_ENTRADA, `${DIA}T08:00:00.000Z`);
      const cierre = correccion('cc', 'e1', REGISTRO_SALIDA, `${DIA}T18:00:00.000Z`);

      const eventos = eventosEfectivos([entrada, cierre]);

      expect(eventos).toHaveLength(2);
      const salida = eventos.find((e) => e.tipo === REGISTRO_SALIDA);
      expect(salida?.fechaHora.toISOString()).toBe(`${DIA}T18:00:00.000Z`);
      expect(salida?.originalId).toBe('e1');
    });

    it('ignora correcciones cuyo original no viene en la lista', () => {
      const entrada = fila('e1', REGISTRO_ENTRADA, `${DIA}T08:00:00.000Z`);
      const huerfana = correccion('cx', 'desconocida', REGISTRO_ENTRADA, `${DIA}T09:00:00.000Z`);

      expect(eventosEfectivos([entrada, huerfana])).toHaveLength(1);
    });
  });

  describe('entradasAbiertas', () => {
    it('una entrada sin salida queda abierta', () => {
      const entrada = fila('e1', REGISTRO_ENTRADA, `${DIA}T08:00:00.000Z`);
      expect(entradasAbiertas(eventosEfectivos([entrada]))).toHaveLength(1);
    });

    it('la salida cierra la entrada mas reciente', () => {
      const a = fila('a', REGISTRO_ENTRADA, `${DIA}T08:00:00.000Z`);
      const b = fila('b', REGISTRO_ENTRADA, `${DIA}T08:05:00.000Z`);
      const c = fila('c', REGISTRO_SALIDA, `${DIA}T09:00:00.000Z`);
      const d = fila('d', REGISTRO_SALIDA, `${DIA}T09:05:00.000Z`);

      const abiertas = entradasAbiertas(eventosEfectivos([a, b, c, d]));
      expect(abiertas).toHaveLength(0);
    });

    it('una salida con una sola entrada deja la anterior anteriormente abierta viva', () => {
      const a = fila('a', REGISTRO_ENTRADA, `${DIA}T08:00:00.000Z`);
      const b = fila('b', REGISTRO_ENTRADA, `${DIA}T08:05:00.000Z`);
      const c = fila('c', REGISTRO_SALIDA, `${DIA}T09:00:00.000Z`);

      const abiertas = entradasAbiertas(eventosEfectivos([a, b, c]));
      expect(abiertas.map((e) => e.originalId)).toEqual(['a']);
    });

    it('un cierre administrativo deja la entrada cerrada', () => {
      const entrada = fila('e1', REGISTRO_ENTRADA, `${DIA}T08:00:00.000Z`);
      const cierre = correccion('cc', 'e1', REGISTRO_SALIDA, `${DIA}T18:00:00.000Z`);

      expect(entradasAbiertas(eventosEfectivos([entrada, cierre]))).toHaveLength(0);
    });

    it('una entrada abierta de un dia anterior sigue abierta junto a la nueva', () => {
      const deAyer = fila('ayer', REGISTRO_ENTRADA, '2026-10-08T20:00:00.000Z');
      const deHoy = fila('hoy', REGISTRO_ENTRADA, `${DIA}T08:00:00.000Z`);

      const abiertas = entradasAbiertas(eventosEfectivos([deAyer, deHoy]));
      expect(abiertas.map((e) => e.originalId)).toEqual(['ayer', 'hoy']);
    });
  });

  describe('derivarAsistencia', () => {
    it('marca abierta solo una entrada sin salida efectiva posterior', () => {
      const entrada = fila('e1', REGISTRO_ENTRADA, `${DIA}T08:00:00.000Z`);
      const salida = fila('s1', REGISTRO_SALIDA, `${DIA}T17:00:00.000Z`);
      const suelta = fila('e2', REGISTRO_ENTRADA, `${DIA}T19:00:00.000Z`);

      const derivados = derivarAsistencia([entrada, salida, suelta]).registros;

      const deLaEntrada = derivados.find((r) => r.id === 'e1');
      const deLaSuelta = derivados.find((r) => r.id === 'e2');
      expect(deLaEntrada?.abierta).toBe(false);
      expect(deLaSuelta?.abierta).toBe(true);
    });

    it('una salida corregida deja la entrada con su hora efectiva', () => {
      const entrada = fila('e1', REGISTRO_ENTRADA, `${DIA}T08:00:00.000Z`);
      const salida = fila('s1', REGISTRO_SALIDA, `${DIA}T17:00:00.000Z`);
      const correccionSalida = correccion('cs', 's1', REGISTRO_SALIDA, `${DIA}T17:30:00.000Z`);

      const derivados = derivarAsistencia([entrada, salida, correccionSalida]).registros;
      const deLaSalida = derivados.find((r) => r.id === 's1');

      expect(deLaSalida?.corregido).toBe(true);
      expect(deLaSalida?.abierta).toBe(false);
    });

    it('ordena los registros por hora efectiva descendente', () => {
      const entrada = fila('e1', REGISTRO_ENTRADA, `${DIA}T08:00:00.000Z`);
      const salida = fila('s1', REGISTRO_SALIDA, `${DIA}T17:00:00.000Z`);
      const correccionEntrada = correccion('ce', 'e1', REGISTRO_ENTRADA, `${DIA}T12:00:00.000Z`);

      const derivados = derivarAsistencia([entrada, salida, correccionEntrada]).registros;
      expect(derivados[0]?.id).toBe('s1');
      expect(derivados[1]?.id).toBe('e1');
      expect(derivados[1]?.fechaHora.toISOString()).toBe(`${DIA}T12:00:00.000Z`);
    });
  });
});