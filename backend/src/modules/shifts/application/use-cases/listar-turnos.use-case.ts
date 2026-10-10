// Caso de uso: listar turnos con paginado y filtros, limitado por alcance.
// Un Admin ve todos; un Gerente solo los turnos de su sucursal.
import { Injectable } from '@nestjs/common';
import {
  filtroAlcanceTurnos,
  type ActorTurnos,
} from '../../domain/rules/alcance';
import {
  ShiftsRepository,
  type FiltrosListadoTurnos,
  type TurnoRespuesta,
} from '../../infrastructure/shifts.repository';

export const PAGE_POR_DEFECTO = 1;
export const LIMIT_POR_DEFECTO = 20;
export const LIMIT_MAXIMO = 100;

export type ResultadoListadoTurnos = {
  data: TurnoRespuesta[];
  total: number;
  page: number;
  limit: number;
  totalPaginas: number;
};

@Injectable()
export class ListarTurnosUseCase {
  constructor(private readonly shiftsRepository: ShiftsRepository) {}

  async ejecutar(
    actor: ActorTurnos,
    filtros: {
      page?: number;
      limit?: number;
      sucursalId?: string;
      tipo?: string;
    },
  ): Promise<ResultadoListadoTurnos> {
    const page = filtros.page ?? PAGE_POR_DEFECTO;
    const limit = Math.min(filtros.limit ?? LIMIT_POR_DEFECTO, LIMIT_MAXIMO);

    const filtrosNormalizados: FiltrosListadoTurnos = {
      page,
      limit,
      ...(filtros.sucursalId !== undefined ? { sucursalId: filtros.sucursalId } : {}),
      ...(filtros.tipo !== undefined ? { tipo: filtros.tipo } : {}),
    };

    const alcance = filtroAlcanceTurnos(actor);
    const data = await this.shiftsRepository.listarTurnos(filtrosNormalizados, alcance);
    const total = await this.shiftsRepository.contarTurnos(filtrosNormalizados, alcance);

    return {
      data,
      total,
      page,
      limit,
      totalPaginas: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }
}
