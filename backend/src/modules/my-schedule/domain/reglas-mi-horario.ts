// Reglas puras del horario propio (módulo MySchedule).
//
// No toca la base ni Nest: son funciones puras que resuelven qué turno toca
// cada día y validan el rango de fechas. Se prueban de forma aislada.

/** Tope de días que cubre una consulta de horario. */
export const MAXIMO_DIAS_HORARIO = 92;

/** Un turno en la respuesta del horario propio. */
export interface TurnoHorario {
  tipo: 'fijo' | 'variable';
  horaInicio: string | null;
  horaFin: string | null;
  diasSemana: string | null;
}

/** Una asignación con el horario de su turno, tal como la devuelve el repositorio. */
export interface AsignacionHorario {
  id: string;
  fechaInicio: string;
  fechaFin: string | null;
  turno: {
    tipo: 'fijo' | 'variable';
    horaInicio: string | null;
    horaFin: string | null;
    diasSemana: string | null;
  };
}

/**
 * Día "AAAA-MM-DD" desplazado `dias` (puede ser negativo).
 *
 * Se calcula en UTC para no depender de la zona del navegador: el backend
 * guarda los días de negocio como `date` (medianoche UTC).
 */
export function sumarDias(iso: string, dias: number): string {
  const [anio, mes, dia] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio!, mes! - 1, dia!));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/** Lunes de la semana que contiene `iso` (día ISO 1 = lunes). */
export function lunesDeSemana(iso: string): string {
  const [anio, mes, dia] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio!, mes! - 1, dia!));
  const diaUtc = fecha.getUTCDay(); // 0 = domingo ... 6 = sábado
  const desdeLunes = (diaUtc + 6) % 7;
  return sumarDias(iso, -desdeLunes);
}

/** Día "AAAA-MM-DD" de la semana actual en America/Lima. */
export function diaActualAmericaLima(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return partes;
}

/**
 * Normaliza y valida el rango de fechas de la consulta.
 *
 * - Si no se pasa nada, devuelve la semana actual (lunes a domingo) en
 *   America/Lima.
 * - Si solo se pasa un extremo, el otro coincide con él (un solo día).
 * - `desde` no puede ser posterior a `hasta`.
 * - El rango no puede superar `MAXIMO_DIAS_HORARIO` días (inclusive).
 */
export function rangoPorDefecto(): { desde: string; hasta: string } {
  const hoy = diaActualAmericaLima();
  const lunes = lunesDeSemana(hoy);
  return { desde: lunes, hasta: sumarDias(lunes, 6) };
}

/**
 * Valida un rango de fechas y lo normaliza a `{ desde, hasta }`.
 *
 * Lanza un `Error` con mensaje claro si el rango no es válido.
 */
export function validarRango(
  desde: string | undefined,
  hasta: string | undefined,
): { desde: string; hasta: string } {
  if (desde === undefined && hasta === undefined) {
    return rangoPorDefecto();
  }

  if (desde === undefined || hasta === undefined) {
    const unico = (desde ?? hasta)!;
    return { desde: unico, hasta: unico };
  }

  if (desde > hasta) {
    throw new Error(
      'La fecha "desde" no puede ser posterior a "hasta".',
    );
  }

  const dias = diasEntre(desde, hasta);
  if (dias > MAXIMO_DIAS_HORARIO) {
    throw new Error(
      `El rango no puede superar ${MAXIMO_DIAS_HORARIO} días (se pidieron ${dias}).`,
    );
  }

  return { desde, hasta };
}

/** Número de días inclusivos entre dos días "AAAA-MM-DD". */
export function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  const inicio = Date.UTC(a1!, m1! - 1, d1!);
  const fin = Date.UTC(a2!, m2! - 1, d2!);
  return Math.round((fin - inicio) / 86_400_000) + 1;
}

/** Todos los días "AAAA-MM-DD" del rango, inclusive. */
export function diasDelRango(desde: string, hasta: string): string[] {
  const total = diasEntre(desde, hasta);
  const dias: string[] = [];
  for (let i = 0; i < total; i += 1) {
    dias.push(sumarDias(desde, i));
  }
  return dias;
}

/**
 * El turno que toca en un día concreto, o `null` si ese día no hay turno.
 *
 * Reglas:
 *   - Si el empleado está cesado (`fechaCese`) y el día es posterior al cese,
 *     no hay turno.
 *   - Una asignación cubre un día si su rango de vigencia lo incluye
 *     (`fechaInicio <= dia <= fechaFin`).
 *   - Un turno **fijo** solo aplica los días de su `diasSemana`.
 *   - Un turno **variable** aplica todos los días de su vigencia.
 *   - Devuelve la primera asignación que aplica; el horario nunca debe tener
 *     dos turnos el mismo día (lo impone la regla de solapamiento del backend).
 */
export function turnoParaDia(
  diaIso: string,
  asignaciones: readonly AsignacionHorario[],
  fechaCese: string | null,
): TurnoHorario | null {
  if (fechaCese !== null && diaIso > fechaCese.slice(0, 10)) {
    return null;
  }

  for (const asignacion of asignaciones) {
    const inicio = asignacion.fechaInicio;
    const fin = asignacion.fechaFin ?? '9999-12-31';
    if (diaIso < inicio || diaIso > fin) {
      continue;
    }

    const { turno } = asignacion;
    if (turno.tipo === 'variable') {
      return {
        tipo: 'variable',
        horaInicio: null,
        horaFin: null,
        diasSemana: null,
      };
    }

    const diaNumero = diaIsoNumero(diaIso);
    const dias = (turno.diasSemana ?? '')
      .split(',')
      .map((t) => Number(t.trim()));
    if (dias.includes(diaNumero)) {
      return {
        tipo: 'fijo',
        horaInicio: turno.horaInicio,
        horaFin: turno.horaFin,
        diasSemana: turno.diasSemana,
      };
    }
  }

  return null;
}

/** Número ISO del día (1 = lunes ... 7 = domingo) de un "AAAA-MM-DD". */
function diaIsoNumero(iso: string): number {
  const [anio, mes, dia] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio!, mes! - 1, dia!));
  return fecha.getUTCDay() === 0 ? 7 : fecha.getUTCDay();
}
