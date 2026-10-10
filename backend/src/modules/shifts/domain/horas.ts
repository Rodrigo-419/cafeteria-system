// Conversion entre una hora "HH:mm" y el `Date` con el que Prisma representa una
// columna `time` de PostgreSQL.
//
// Se comprobo contra la base: una columna `@db.Time` de Prisma llega y se
// guarda como un `Date` anclado a `1970-01-01` en UTC. Toda la API habla en
// "HH:mm" y esta es la unica frontera donde se traduce, para que el resto del
// codigo no arrastre ese detalle de Prisma.

function dosDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/** Convierte una hora valida "HH:mm" en el `Date` que guarda Prisma. */
export function horaADate(hora: string): Date {
  return new Date(`1970-01-01T${hora}:00.000Z`);
}

/** Convierte el `Date` que devuelve Prisma en una hora "HH:mm". */
export function fechaAHora(fecha: Date | null): string | null {
  if (fecha === null) {
    return null;
  }

  return `${dosDigitos(fecha.getUTCHours())}:${dosDigitos(fecha.getUTCMinutes())}`;
}
