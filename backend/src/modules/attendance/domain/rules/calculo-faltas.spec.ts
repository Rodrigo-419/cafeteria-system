// Pruebas de la regla pura de calculo de faltas.
//
// Se ejercita sin base de datos ni reloj: `hoy` entra por parametro. El
// calendario de referencia es la semana del 5 al 11 de octubre de 2026, con el
// 5 (lunes) como dia ISO 1 y el 10 (sabado) como dia ISO 6.
import {
  calcularFaltas,
  diaSiguiente,
  type AsignacionParaFaltas,
  type EmpleadoParaFaltas,
  type JustificacionParaFaltas,
  type RegistroParaFaltas,
} from './calculo-faltas';

const LUNES = '2026-10-05';

const empleadoAna: EmpleadoParaFaltas = {
  id: 'ana',
  nombre: 'Ana',
  sucursalId: 'sucursal-centro',
};

const empleadoBeto: EmpleadoParaFaltas = {
  id: 'beto',
  nombre: 'Beto',
  sucursalId: 'sucursal-centro',
};

/** Entrada original, abierta. */
function entrada(
  empleadoId: string,
  id: string,
  fechaHora: string,
): RegistroParaFaltas {
  return {
    id,
    empleadoId,
    tipo: 'entrada',
    fechaHora: new Date(fechaHora),
    esCorreccion: false,
    registroOriginalId: null,
  };
}

/** Correccion que sustituye la hora de una original. */
function correccion(
  empleadoId: string,
  id: string,
  originalId: string,
  tipo: 'entrada' | 'salida',
  fechaHora: string,
): RegistroParaFaltas {
  return {
    id,
    empleadoId,
    tipo,
    fechaHora: new Date(fechaHora),
    esCorreccion: true,
    registroOriginalId: originalId,
  };
}

const turnoFijo: AsignacionParaFaltas = {
  empleadoId: 'ana',
  fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
  fechaFin: null,
  turno: { tipo: 'fijo', diasSemana: '1,2,3,4,5' },
};

describe('calcularFaltas', () => {
  it('marca los dias laborables sin entrada ni justificacion', () => {
    const faltas = calcularFaltas({
      empleados: [empleadoAna],
      registros: [],
      justificaciones: [],
      asignaciones: [turnoFijo],
      desde: LUNES,
      hasta: '2026-10-11',
      hoy: '2026-10-11',
    });

    // Lunes a viernes; el sabado y el domingo no los exige el turno.
    expect(faltas.map((falta) => falta.fecha)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
    expect(faltas.every((falta) => falta.empleadoId === 'ana')).toBe(true);
    expect(faltas[0]?.empleadoNombre).toBe('Ana');
    expect(faltas[0]?.sucursalId).toBe('sucursal-centro');
  });

  it('una entrada efectiva ese dia lo saca de faltas', () => {
    // Entrada a las 10:00 de Lima (15:00 UTC) del martes.
    const registros = [entrada('ana', 'r1', '2026-10-06T15:00:00.000Z')];

    const faltas = calcularFaltas({
      empleados: [empleadoAna],
      registros,
      justificaciones: [],
      asignaciones: [turnoFijo],
      desde: LUNES,
      hasta: '2026-10-09',
      hoy: '2026-10-09',
    });

    expect(faltas.map((falta) => falta.fecha)).not.toContain('2026-10-06');
    expect(faltas).toHaveLength(4);
  });

  it('una justificacion ese dia lo saca de faltas', () => {
    const justificaciones: JustificacionParaFaltas[] = [
      { empleadoId: 'ana', fecha: new Date('2026-10-07T00:00:00.000Z') },
    ];

    const faltas = calcularFaltas({
      empleados: [empleadoAna],
      registros: [],
      justificaciones,
      asignaciones: [turnoFijo],
      desde: LUNES,
      hasta: '2026-10-09',
      hoy: '2026-10-09',
    });

    expect(faltas.map((falta) => falta.fecha)).not.toContain('2026-10-07');
    expect(faltas).toHaveLength(4);
  });

  it('un turno variable no genera faltas', () => {
    const variable: AsignacionParaFaltas = {
      empleadoId: 'ana',
      fechaInicio: new Date('2026-01-01T00:00:00.000Z'),
      fechaFin: null,
      turno: { tipo: 'variable', diasSemana: null },
    };

    const faltas = calcularFaltas({
      empleados: [empleadoAna],
      registros: [],
      justificaciones: [],
      asignaciones: [variable],
      desde: LUNES,
      hasta: '2026-10-09',
      hoy: '2026-10-09',
    });

    expect(faltas).toEqual([]);
  });

  it('recorta el rango a hoy y no adelanta faltas futuras', () => {
    const faltas = calcularFaltas({
      empleados: [empleadoAna],
      registros: [],
      justificaciones: [],
      asignaciones: [turnoFijo],
      desde: LUNES,
      hasta: '2026-10-20',
      hoy: '2026-10-07',
    });

    expect(faltas.map((falta) => falta.fecha)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ]);
  });

  it('devuelve vacio si desde es posterior a hoy', () => {
    const faltas = calcularFaltas({
      empleados: [empleadoAna],
      registros: [],
      justificaciones: [],
      asignaciones: [turnoFijo],
      desde: '2026-10-12',
      hasta: '2026-10-20',
      hoy: '2026-10-09',
    });

    expect(faltas).toEqual([]);
  });

  it('una correccion mueve el dia de la entrada efectiva', () => {
    // Original el lunes a las 23:00 de Lima (04:00 UTC del martes) y correccion
    // al martes a las 09:00 de Lima (14:00 UTC del martes): el dia efectivo
    // pasa del lunes al martes.
    const registros = [
      entrada('ana', 'r1', '2026-10-06T04:00:00.000Z'),
      correccion('ana', 'c1', 'r1', 'entrada', '2026-10-06T14:00:00.000Z'),
    ];

    const faltas = calcularFaltas({
      empleados: [empleadoAna],
      registros,
      justificaciones: [],
      asignaciones: [turnoFijo],
      desde: LUNES,
      hasta: '2026-10-09',
      hoy: '2026-10-09',
    });

    const fechas = faltas.map((falta) => falta.fecha);
    expect(fechas).toContain('2026-10-05');
    expect(fechas).not.toContain('2026-10-06');
  });

  it('ordena por fecha y luego por nombre de empleado', () => {
    const turnoBeto: AsignacionParaFaltas = {
      ...turnoFijo,
      empleadoId: 'beto',
    };

    const faltas = calcularFaltas({
      empleados: [empleadoBeto, empleadoAna],
      registros: [],
      justificaciones: [],
      asignaciones: [turnoBeto, turnoFijo],
      desde: LUNES,
      hasta: '2026-10-05',
      hoy: '2026-10-05',
    });

    expect(faltas.map((falta) => falta.empleadoNombre)).toEqual(['Ana', 'Beto']);
  });
});

describe('diaSiguiente', () => {
  it('avanza un dia de calendario', () => {
    expect(diaSiguiente('2026-10-05')).toBe('2026-10-06');
    expect(diaSiguiente('2026-10-31')).toBe('2026-11-01');
    expect(diaSiguiente('2026-12-31')).toBe('2027-01-01');
  });
});
