// Caso de uso: listar asignaciones con paginado y filtros, limitado por alcance.
// Un Admin ve todas; un Gerente solo las de empleados con usuario Empleado de su
// sucursal.
import { Injectable } from '@nestjs/common';
import { fechaLocalDe } from '../../domain/fechas';
import {
  alcanceEmpleadosParaAsignaciones,
  type ActorTurnos,
} from '../../domain/rules/alcance';
import {
  ShiftsRepository,
  type AsignacionRespuesta,
  type FiltrosListadoAsignaciones,
} from '../../infrastructure/shifts.repository';

export const PAGE_POR_DEFECTO = 1;
export const LIMIT_POR_DEFECTO = 20;
export const LIMIT_MAXIMO = 100;

export type ResultadoListadoAsignaciones = {
  data: AsignacionRespuesta[];
  total: number;
  page: number;
  limit: number;
  totalPaginas: number;
};

@Injectable()
export class ListarAsignacionesUseCase {
  constructor(private readonly shiftsRepository: ShiftsRepository) {}

  async ejecutar(
    actor: ActorTurnos,
    filtros: {
      page?: number;
      limit?: number;
      empleadoId?: string;
      turnoId?: string;
      vigente?: boolean;
    },
  ): Promise<ResultadoListadoAsignaciones> {
    const page = filtros.page ?? PAGE_POR_DEFECTO;
    const limit = Math.min(filtros.limit ?? LIMIT_POR_DEFECTO, LIMIT_MAXIMO);

    const filtrosNormalizados: FiltrosListadoAsignaciones = {
      page,
      limit,
      hoy: fechaLocalDe(new Date()),
      ...(filtros.empleadoId !== undefined ? { empleadoId: filtros.empleadoId } : {}),
      ...(filtros.turnoId !== undefined ? { turnoId: filtros.turnoId } : {}),
      ...(filtros.vigente !== undefined ? { vigente: filtros.vigente } : {}),
    };

    const alcance = alcanceEmpleadosParaAsignaciones(actor);
    const data = await this.shiftsRepository.listarAsignaciones(
      filtrosNormalizados,
      alcance,
    );
    const total = await this.shiftsRepository.contarAsignaciones(
      filtrosNormalizados,
      alcance,
    );

    return {
      data,
      total,
      page,
      limit,
      totalPaginas: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }
}
