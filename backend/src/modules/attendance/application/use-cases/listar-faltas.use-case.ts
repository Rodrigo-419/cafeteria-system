// Caso de uso: listar faltas de un rango.
//
// Una falta es un dia con asignacion vigente de un turno FIJO cuyo `diasSemana`
// incluye ese dia, sin entrada efectiva y sin justificacion. El rango es
// obligatorio y no puede superar 92 dias. Los dias futuros no cuentan todavia:
// una falta solo se puede afirmar de un dia ya pasado (o el de hoy).
// Limitacion: los turnos VARIABLES no generan faltas.
//
// El calculo vive en la regla pura `calcularFaltas`, compartida con el reporte
// comparativo; aqui solo se resuelven el alcance, los filtros y el rango.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { diaUtc, fechaLocalDe } from '../../domain/fechas';
import { filtroAlcanceAsistencia, type ActorAsistencia } from '../../domain/rules/alcance';
import {
  calcularFaltas,
  type FaltaCalculada,
} from '../../domain/rules/calculo-faltas';
import { AttendanceRepository } from '../../infrastructure/attendance.repository';

const MILISEGUNDOS_DIA = 86_400_000;
const MAXIMO_DIAS_RANGO = 92;

export type ListarFaltasFiltros = {
  desde: string;
  hasta: string;
  empleadoId?: string;
  sucursalId?: string;
};

export type FaltaItem = FaltaCalculada;

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

    const items = calcularFaltas({
      empleados,
      registros,
      justificaciones,
      asignaciones,
      desde: filtros.desde,
      hasta: filtros.hasta,
      hoy: fechaLocalDe(new Date()),
    });

    return { items, total: items.length };
  }
}
