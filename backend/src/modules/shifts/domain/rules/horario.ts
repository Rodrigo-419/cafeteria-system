// Regla de dominio: franja horaria de un turno.
//
// Un turno FIJO exige hora de inicio y de fin. Un turno VARIABLE puede no
// tenerlas, pero si trae una tiene que traer la otra: media franja no describe
// nada.
//
// En Fase 1 no hay turnos nocturnos, asi que la hora de fin siempre debe ser
// posterior a la de inicio el mismo dia. Un turno que cruzara la medianoche (por
// ejemplo 22:00-06:00) requiere decidir a que dia pertenece cada tramo, y eso se
// deja fuera de esta fase a proposito.

const PATRON_HORA = /^([01]\d|2[0-3]):[0-5]\d$/u;

/** true si el texto es una hora "HH:mm" de 24 horas. */
export function esHoraValida(valor: string | null): valor is string {
  return valor !== null && PATRON_HORA.test(valor);
}

/** Minutos desde medianoche de una hora valida "HH:mm". */
export function minutosDeHora(valor: string): number {
  const [horas, minutos] = valor.split(':').map((parte) => Number(parte));
  return horas * 60 + minutos;
}

/**
 * Problemas de la franja horaria de un turno. Lista vacia si es coherente.
 *
 * Recibe el tipo y las horas tal y como llegan de la peticion (texto o nada),
 * para que el mismo chequeo sirva en el alta y en la edicion.
 */
export function problemasHorarioTurno(entrada: {
  tipo: string;
  horaInicio?: string | null;
  horaFin?: string | null;
}): string[] {
  const horaInicio = entrada.horaInicio ?? null;
  const horaFin = entrada.horaFin ?? null;
  const tieneInicio = horaInicio !== null && horaInicio !== '';
  const tieneFin = horaFin !== null && horaFin !== '';

  if (entrada.tipo === 'fijo' && (!tieneInicio || !tieneFin)) {
    return ['Un turno fijo debe tener hora de inicio y de fin'];
  }

  if (!tieneInicio && !tieneFin) {
    return [];
  }

  if (tieneInicio !== tieneFin) {
    return [
      'Un turno variable debe indicar hora de inicio y de fin, o ninguna de las dos',
    ];
  }

  if (horaInicio === null || horaFin === null) {
    // Inalcanzable tras los chequeos anteriores; deja el tipo estrechado.
    return [];
  }

  const problemas: string[] = [];
  if (!esHoraValida(horaInicio)) {
    problemas.push('La hora de inicio debe tener el formato HH:mm');
  }
  if (!esHoraValida(horaFin)) {
    problemas.push('La hora de fin debe tener el formato HH:mm');
  }
  if (problemas.length > 0) {
    return problemas;
  }

  if (minutosDeHora(horaFin) <= minutosDeHora(horaInicio)) {
    problemas.push('La hora de fin debe ser posterior a la hora de inicio');
  }

  return problemas;
}
