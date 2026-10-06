// Calendario local del negocio.
//
// Una venta se anula "el mismo dia" y se filtra "por el dia", pero el servidor
// guarda en UTC. Sin una zona horaria explicita, una venta hecha a las 19:30
// del lunes en Lima (UTC-5) se guarda como 00:30 del martes y el sistema
// creeria que es de otro dia: la regla de anulacion dejaria de coincidir con lo
// que el cajero ve en la pantalla.
//
// Por eso todas las funciones de aqui reciben la zona y el instante por
// parametro, con un valor por defecto fijo. Son puras: se prueban sin fecha del
// sistema y sin base de datos.

/** Zona horaria con la que se calcula el dia del negocio. Lima no aplica DST. */
export const ZONA_HORARIA_NEGOCIO = 'America/Lima';

const FORMATO_FECHA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA_NEGOCIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const FORMATO_INSTANTE = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_HORARIA_NEGOCIO,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/**
 * Dia local (`YYYY-MM-DD`) en el que cae un instante.
 *
 * El formateador se crea con la zona por defecto del negocio. Para cualquier
 * otra zona se construye uno aparte, que es raro y solo pasa en las pruebas.
 */
export function fechaLocalDe(
  instante: Date,
  zona: string = ZONA_HORARIA_NEGOCIO,
): string {
  const formato = zona === ZONA_HORARIA_NEGOCIO ? FORMATO_FECHA : new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formato.format(instante);
}

/** true si los dos instantes caen en el mismo dia local. */
export function mismoDiaLocal(
  a: Date,
  b: Date,
  zona: string = ZONA_HORARIA_NEGOCIO,
): boolean {
  return fechaLocalDe(a, zona) === fechaLocalDe(b, zona);
}

/**
 * true si el texto es un dia de calendario real en formato `YYYY-MM-DD`.
 *
 * `2026-02-30` no lo es, y un filtro con esa fecha tendria que responder 400
 * en vez de devolver silenciosamente un rango vacio. Se comprueba componiendo
 * el dia de nuevo: si al montarlo no vuelve a salir lo que decia el texto, la
 * fecha no existe.
 */
export function esFechaLocal(valor: unknown): boolean {
  if (typeof valor !== 'string') {
    return false;
  }

  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(valor);
  if (!coincidencia) {
    return false;
  }

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);

  const compuesta = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    compuesta.getUTCFullYear() === anio &&
    compuesta.getUTCMonth() === mes - 1 &&
    compuesta.getUTCDate() === dia
  );
}

/**
 * Desplazamiento de la zona respecto a UTC, en milisegundos, en un instante.
 *
 * `Date.UTC(...) - instante`: si la hora local es 00:00 y la UTC 05:00, la
 * diferencia sale negativa (-5h), que es exactamente lo que hay que restar al
 * dia local para obtener su instante UTC.
 */
function desfaseDeZona(instante: Date, zona: string): number {
  const partes = FORMATO_INSTANTE.resolvedOptions().timeZone === zona
    ? FORMATO_INSTANTE
    : new Intl.DateTimeFormat('en-US', {
        timeZone: zona,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

  const campos = new Map(
    partes
      .formatToParts(instante)
      .map((parte) => [parte.type, parte.value]),
  );

  const interpretado = Date.UTC(
    Number(campos.get('year')),
    Number(campos.get('month')) - 1,
    Number(campos.get('day')),
    // `hour12: false` puede dar "24" a medianoche en algunas plataformas.
    Number(campos.get('hour')) % 24,
    Number(campos.get('minute')),
    Number(campos.get('second')),
  );

  return interpretado - instante.getTime();
}

/**
 * Instante UTC en el que empieza un dia local.
 *
 * Se calcula en dos pasos porque el desfase depende del propio instante: en una
 * zona con horario de verano, el primer calculo puede caer al otro lado del
 * cambio y desplazar el dia una hora de mas. Con dos iteraciones ya se fija el
 * valor estable. America/Lima no tiene DST, pero la funcion no debe romperse
 * si alguien la reutiliza en otra zona.
 *
 * @param fecha dia local en formato `YYYY-MM-DD`; se comprueba con `esFechaLocal`.
 * @param hora hora local del dia (0 = medianoche), para rangos de otra clase.
 * @throws RangeError si la fecha no es un dia de calendario valido.
 */
export function instanteDeFechaLocal(
  fecha: string,
  zona: string = ZONA_HORARIA_NEGOCIO,
  hora = 0,
): Date {
  if (!esFechaLocal(fecha)) {
    throw new RangeError(`Fecha local no valida: ${fecha}`);
  }

  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  const pretendido = Date.UTC(anio, mes - 1, dia, hora);

  const primerDesfase = desfaseDeZona(new Date(pretendido), zona);
  const segundoDesfase = desfaseDeZona(new Date(pretendido - primerDesfase), zona);

  return new Date(pretendido - segundoDesfase);
}

/**
 * Rango `[desde, hasta)` de un dia local, en UTC, para filtrar `createdAt`.
 *
 * `hasta` es el inicio del dia siguiente y es exclusivo: si no lo fuera, una
 * venta guardada exactamente a medianoche entraria en dos dias a la vez.
 */
export function rangoDelDiaLocal(
  fecha: string,
  zona: string = ZONA_HORARIA_NEGOCIO,
): { desde: Date; hasta: Date } {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  const siguiente = new Date(Date.UTC(anio, mes - 1, dia + 1))
    .toISOString()
    .slice(0, 10);

  return {
    desde: instanteDeFechaLocal(fecha, zona),
    hasta: instanteDeFechaLocal(siguiente, zona),
  };
}
