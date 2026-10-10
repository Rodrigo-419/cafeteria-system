// Caso de uso: listar faltas de un rango.
//
// Una falta es un dia con asignacion vigente de un turno FIJO cuyo `diasSemana`
// incluye ese dia, sin entrada efectiva y sin justificacion. El rango es
// obligatorio y no puede superar 92 dias. Los dias futuros no cuentan todavia:
// una falta solo se puede afirmar de un dia ya pasado (o el de hoy).
// Limitacion: los turnos VARIABLES no generan faltas.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { diaUtc, fechaIsoDe, fechaLocalDe } from '../../domain/fechas';
import { filtroAlcanceAsistencia, type ActorAsistencia } from '../../domain/rules/alcance';
import {
  asignacionVigenteElDia,
  esFalta,
  turnoExigeDia,
  type TurnoDeAsignacion,
} from '../../domain/rules/falta';
import {
  derivarAsistencia,
  REGISTRO_ENTRADA,
} from '../../domain/rules/registros-efectivos';
import { AttendanceRepository } from '../../infrastructure/attendance.repository';

const MILISEGUNDOS_DIA = 86_400_000;
const MAXIMO_DIAS_RANGO = 92;

export type ListarFaltasFiltros = {
  desde: string;
  hasta: string;
  empleadoId?: string;
  sucursalId?: string;
};

export type FaltaItem = {
  empleadoId: string;
  empleadoNombre: string;
  sucursalId: string;
  fecha: string;
  turno: TurnoDeAsignacion;
};

export type ListarFaltasRespuesta = {
  items: FaltaItem[];
  total: number;
};

@Injectable()
export class ListarFaltasUseCase {
  constructor(private readonly repository: AttendanceRepository) {}

  async ejecutar(
    actor: ActorAsistencia,
    filtros: ListarFaltasFiltros,
  ): Promise<ListarFaltasRespuesta> {
    if (filtros.hasta < filtros.desde) {
      throw new BadRequestException(
        'El filtro hasta no puede ser anterior a desde',
      );
    }

    const totalDias =
      (diaUtc(filtros.hasta).getTime() - diaUtc(filtros.desde).getTime()) /
        MILISEGUNDOS_DIA +
      1;
    if (totalDias > MAXIMO_DIAS_RANGO) {
      throw new BadRequestException(
        `El rango de faltas no puede superar ${MAXIMO_DIAS_RANGO} dias`,
      );
    }

    const alcance = filtroAlcanceAsistencia(actor);
    const empleados = await this.repository.listarEmpleadosDeAlcance(alcance, {
      empleadoId: filtros.empleadoId,
      sucursalId: filtros.sucursalId,
    });

    if (
      (filtros.empleadoId !== undefined || filtros.sucursalId !== undefined) &&
      empleados.length === 0
    ) {
      throw new NotFoundException(
        'El empleado o la sucursal no esta dentro de tu alcance',
      );
    }

    if (empleados.length === 0) {
      return { items: [], total: 0 };
    }

    const hoy = fechaLocalDe(new Date());
    const hastaEfectiva = filtros.hasta < hoy ? filtros.hasta : hoy;
    if (filtros.desde > hastaEfectiva) {
      return { items: [], total: 0 };
    }

    const ids = empleados.map((empleado) => empleado.id);
    const registros = await this.repository.listarRegistrosDeEmpleados(ids);
    const justificaciones =
      await this.repository.listarJustificacionesDeEmpleados(
        ids,
        diaUtc(filtros.desde),
        diaUtc(filtros.hasta),
      );
    const asignaciones =
      await this.repository.listarAsignacionesDeEmpleados(ids);

    const entradasPorEmpleado = new Map<string, Set<string>>();
    const historialPorEmpleado = new Map<string, typeof registros>();
    for (const registro of registros) {
      const historial = historialPorEmpleado.get(registro.empleadoId) ?? [];
      historial.push(registro);
      historialPorEmpleado.set(registro.empleadoId, historial);
    }
    for (const [empleadoId, historial] of historialPorEmpleado) {
      const entradas = new Set<string>();
      for (const derivado of derivarAsistencia(historial).registros) {
        if (derivado.tipo === REGISTRO_ENTRADA) {
          entradas.add(fechaLocalDe(derivado.fechaHora));
        }
      }
      entradasPorEmpleado.set(empleadoId, entradas);
    }

    const justificadasPorEmpleado = new Map<string, Set<string>>();
    for (const justificacion of justificaciones) {
      const dias =
        justificadasPorEmpleado.get(justificacion.empleadoId) ?? new Set();
      dias.add(fechaIsoDe(justificacion.fecha));
      justificadasPorEmpleado.set(justificacion.empleadoId, dias);
    }

    const items: FaltaItem[] = [];

    for (const empleado of empleados) {
      const asignacionesDelEmpleado = asignaciones.filter(
        (asignacion) => asignacion.empleadoId === empleado.id,
      );
      const entradas = entradasPorEmpleado.get(empleado.id) ?? new Set();
      const justificadas =
        justificadasPorEmpleado.get(empleado.id) ?? new Set();

      for (
        let dia = filtros.desde;
        dia <= hastaEfectiva;
        dia = diaSiguiente(dia)
      ) {
        const turnoQueExige = asignacionesDelEmpleado.find(
          (asignacion) =>
            asignacionVigenteElDia({
              fechaInicio: fechaIsoDe(asignacion.fechaInicio),
              fechaFin:
                asignacion.fechaFin === null
                  ? null
                  : fechaIsoDe(asignacion.fechaFin),
              fecha: dia,
            }) && turnoExigeDia(asignacion.turno, dia),
        );

        if (turnoQueExige === undefined) {
          continue;
        }

        if (
          esFalta({
            turno: turnoQueExige.turno,
            fecha: dia,
            tieneEntrada: entradas.has(dia),
            tieneJustificacion: justificadas.has(dia),
          })
        ) {
          items.push({
            empleadoId: empleado.id,
            empleadoNombre: empleado.nombre,
            sucursalId: empleado.sucursalId,
            fecha: dia,
            turno: turnoQueExige.turno,
          });
        }
      }
    }

    items.sort(
      (a, b) =>
        (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0) ||
        (a.empleadoNombre < b.empleadoNombre ? -1 : 1),
    );

    return { items, total: items.length };
  }
}

function diaSiguiente(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  return fechaIsoDe(new Date(Date.UTC(anio, mes - 1, dia + 1)));
}