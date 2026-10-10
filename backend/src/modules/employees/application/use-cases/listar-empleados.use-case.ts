// Caso de uso: listar empleados con paginado y filtros, limitado por alcance.
// Un Admin ve todos; un Gerente solo los empleados de usuarios Empleado de su
// sucursal.
import { Injectable } from '@nestjs/common';
import {
  filtroAlcanceEmpleados,
  type ActorEmpleados,
} from '../../domain/rules/alcance';
import {
  EmployeesRepository,
  type EmpleadoRespuesta,
  type FiltrosListadoEmpleados,
} from '../../infrastructure/employees.repository';

export const PAGE_POR_DEFECTO = 1;
export const LIMIT_POR_DEFECTO = 20;
export const LIMIT_MAXIMO = 100;

export type ResultadoListadoEmpleados = {
  data: EmpleadoRespuesta[];
  total: number;
  page: number;
  limit: number;
  totalPaginas: number;
};

@Injectable()
export class ListarEmpleadosUseCase {
  constructor(private readonly employeesRepository: EmployeesRepository) {}

  async ejecutar(
    actor: ActorEmpleados,
    filtros: {
      page?: number;
      limit?: number;
      sucursalId?: string;
      estado?: string;
      q?: string;
    },
  ): Promise<ResultadoListadoEmpleados> {
    const page = filtros.page ?? PAGE_POR_DEFECTO;
    const limit = Math.min(filtros.limit ?? LIMIT_POR_DEFECTO, LIMIT_MAXIMO);

    const alcance = filtroAlcanceEmpleados(actor);
    const busqueda = filtros.q?.trim();

    const filtrosNormalizados: FiltrosListadoEmpleados = {
      page,
      limit,
      ...(filtros.sucursalId !== undefined ? { sucursalId: filtros.sucursalId } : {}),
      ...(filtros.estado !== undefined ? { estado: filtros.estado } : {}),
      ...(busqueda !== undefined && busqueda.length > 0 ? { busqueda } : {}),
    };

    // El alcance del actor se combina con los filtros pedidos: nunca se puede
    // ampliar el alcance con un filtro.
    const data = await this.employeesRepository.listar(filtrosNormalizados, alcance);
    const total = await this.employeesRepository.contar(filtrosNormalizados, alcance);

    return {
      data,
      total,
      page,
      limit,
      totalPaginas: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }
}
