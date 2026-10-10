// Regla de dominio: registros efectivos de asistencia.
//
// Una marcacion original es inmutable (un trigger lo impide). Una correccion no
// es una marcacion nueva: es una fila aparte que APUNTA a la original y sustituye
// su hora. "Registro efectivo" es lo que de verdad vale a la hora de leer:
//
//   - El evento `tipo` de la original ocurre en la hora de la correccion del
//     MISMO tipo si existe; si no, en la hora de la original.
//   - Si la original es una entrada y tiene una correccion de tipo `salida`,
//     esa correccion es un CIERRE ADMINISTRATIVO: añade un evento `salida`.
//
// Con esos eventos, ordenados por hora, se emparejan como una pila: cada salida
// cierra la entrada abierta MAS RECIENTE. Lo que quede en la pila son entradas
// abiertas. Este modulo es puro: se prueba sin base de datos ni reloj.
//
// Limitacion conocida: el emparejamiento es por orden temporal, no por turno.
// Un turno de noche que cruce medianoche se empareja igual mientras las horas
// sean coherentes; si dos entradas quedan sin cerrar, ambas se consideran
// abiertas.

export const REGISTRO_ENTRADA = 'entrada';
export const REGISTRO_SALIDA = 'salida';

/** Fila de `registro_asistencia` tal como la necesita esta regla. */
export type RegistroAsistenciaFila = {
  id: string;
  tipo: string;
  fechaHora: Date;
  esCorreccion: boolean;
  registroOriginalId: string | null;
};

/** Evento efectivo derivado de una original (y, si aplica, de su correccion). */
export type EventoEfectivo = {
  tipo: string;
  fechaHora: Date;
  /** Original a la que pertenece el evento; tambien identifica la entrada. */
  originalId: string;
  /** Correccion que produjo el evento, o null si viene de la original. */
  correccionId: string | null;
};

/** Registro efectivo listo para la respuesta: una fila por original. */
export type RegistroDerivado = {
  id: string;
  tipo: string;
  fechaHora: Date;
  abierta: boolean;
  corregido: boolean;
};

export type DerivacionAsistencia = {
  /** Una entrada por original, ordenados por hora efectiva descendente. */
  registros: RegistroDerivado[];
  /** Eventos de entrada que no tienen salida efectiva posterior. */
  entradasAbiertas: EventoEfectivo[];
};

function compararEventos(a: EventoEfectivo, b: EventoEfectivo): number {
  const porHora = a.fechaHora.getTime() - b.fechaHora.getTime();
  if (porHora !== 0) {
    return porHora;
  }

  // A igual hora, una entrada se procesa antes que una salida: asi una salida
  // con el mismo instante no cierra a una entrada posterior del mismo tramo.
  if (a.tipo !== b.tipo) {
    return a.tipo === REGISTRO_ENTRADA ? -1 : 1;
  }

  return a.originalId < b.originalId ? -1 : 1;
}

/**
 * Eventos efectivos de un conjunto de registros, ordenados por hora.
 *
 * Debe recibirse el historial COMPLETO del empleado (originales y correcciones):
 * una correccion cuyo original no venga en la lista se ignora.
 */
export function eventosEfectivos(
  registros: readonly RegistroAsistenciaFila[],
): EventoEfectivo[] {
  const correccionesPorOriginal = new Map<string, RegistroAsistenciaFila[]>();
  for (const registro of registros) {
    if (registro.esCorreccion && registro.registroOriginalId !== null) {
      const lista = correccionesPorOriginal.get(registro.registroOriginalId) ?? [];
      lista.push(registro);
      correccionesPorOriginal.set(registro.registroOriginalId, lista);
    }
  }

  const eventos: EventoEfectivo[] = [];

  for (const original of registros) {
    if (original.esCorreccion) {
      continue;
    }

    const correcciones = correccionesPorOriginal.get(original.id) ?? [];
    const mismaTipo = correcciones.find((c) => c.tipo === original.tipo) ?? null;
    const otraTipo = correcciones.find((c) => c.tipo !== original.tipo) ?? null;

    eventos.push({
      tipo: original.tipo,
      fechaHora: mismaTipo?.fechaHora ?? original.fechaHora,
      originalId: original.id,
      correccionId: mismaTipo?.id ?? null,
    });

    if (otraTipo !== null) {
      eventos.push({
        tipo: otraTipo.tipo,
        fechaHora: otraTipo.fechaHora,
        originalId: original.id,
        correccionId: otraTipo.id,
      });
    }
  }

  return eventos.sort(compararEventos);
}

/** Entradas efectivas que quedan sin una salida efectiva posterior. */
export function entradasAbiertas(
  eventos: readonly EventoEfectivo[],
): EventoEfectivo[] {
  const pila: EventoEfectivo[] = [];

  for (const evento of eventos) {
    if (evento.tipo === REGISTRO_ENTRADA) {
      pila.push(evento);
    } else if (evento.tipo === REGISTRO_SALIDA && pila.length > 0) {
      pila.pop();
    }
  }

  return pila;
}

/** Hora efectiva de una original: la de su correccion del mismo tipo, o la suya. */
export function fechaHoraEfectivaDe(
  original: RegistroAsistenciaFila,
  correccionesDelOriginal: readonly RegistroAsistenciaFila[],
): Date {
  const mismaTipo =
    correccionesDelOriginal.find((c) => c.tipo === original.tipo) ?? null;
  return mismaTipo?.fechaHora ?? original.fechaHora;
}

/**
 * Deriva el estado efectivo del historial de un empleado.
 *
 * Devuelve una fila por original (con su hora efectiva y si su entrada sigue
 * abierta) y la lista de entradas abiertas.
 */
export function derivarAsistencia(
  registros: readonly RegistroAsistenciaFila[],
): DerivacionAsistencia {
  const eventos = eventosEfectivos(registros);
  const abiertas = entradasAbiertas(eventos);
  const abiertasIds = new Set(abiertas.map((evento) => evento.originalId));

  const correccionesPorOriginal = new Map<string, RegistroAsistenciaFila[]>();
  for (const registro of registros) {
    if (registro.esCorreccion && registro.registroOriginalId !== null) {
      const lista = correccionesPorOriginal.get(registro.registroOriginalId) ?? [];
      lista.push(registro);
      correccionesPorOriginal.set(registro.registroOriginalId, lista);
    }
  }

  const derivados: RegistroDerivado[] = [];
  for (const original of registros) {
    if (original.esCorreccion) {
      continue;
    }

    const correcciones = correccionesPorOriginal.get(original.id) ?? [];
    derivados.push({
      id: original.id,
      tipo: original.tipo,
      fechaHora: fechaHoraEfectivaDe(original, correcciones),
      abierta:
        original.tipo === REGISTRO_ENTRADA && abiertasIds.has(original.id),
      corregido: correcciones.length > 0,
    });
  }

  derivados.sort((a, b) => b.fechaHora.getTime() - a.fechaHora.getTime());

  return { registros: derivados, entradasAbiertas: abiertas };
}
