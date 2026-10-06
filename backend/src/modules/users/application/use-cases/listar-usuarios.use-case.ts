// Caso de uso: listar usuarios con paginado y filtros, limitado por alcance.
// Un Admin ve todos; un Gerente solo los Empleados de su sucursal.
import { Injectable } from '@nestjs/common';
import { filtroAlcanceListado, Actor } from '../../domain/rules/alcance';
import {
  FiltrosListadoUsuarios,
  UsuarioRespuesta,
  UsersRepository,
} from '../../infrastructure/users.repository';

export const PAGE_POR_DEFECTO = 1;
export const LIMIT_POR_DEFECTO = 20;
export const LIMIT_MAXIMO = 100;

export type ResultadoListado<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPaginas: number;
};

@Injectable()
export class ListarUsuariosUseCase {
  constructor(private readonly usersRepository: UsersRepository) {}

  async ejecutar(
    actor: Actor,
    filtros: {
      page?: number;
      limit?: number;
      sucursalId?: string;
      rol?: string;
      estado?: string;
      q?: string;
    },
  ): Promise<ResultadoListado<UsuarioRespuesta>> {
    const page = filtros.page ?? PAGE_POR_DEFECTO;
    const limit = Math.min(filtros.limit ?? LIMIT_POR_DEFECTO, LIMIT_MAXIMO);

    const alcance = filtroAlcanceListado(actor);
    const busqueda = filtros.q?.trim();

    const filtrosNormalizados: FiltrosListadoUsuarios = {
      page,
      limit,
      ...(filtros.sucursalId !== undefined ? { sucursalId: filtros.sucursalId } : {}),
      ...(filtros.rol !== undefined ? { rol: filtros.rol } : {}),
      ...(filtros.estado !== undefined ? { estado: filtros.estado } : {}),
      ...(busqueda !== undefined && busqueda.length > 0 ? { busqueda } : {}),
    };

    // El alcance del actor se combina con los filtros pedidos: nunca se
    // puede ampliar el alcance con un filtro.
    const data = await this.usersRepository.listar(
      filtrosNormalizados,
      alcance,
    );
    const total = await this.usersRepository.contar(filtrosNormalizados, alcance);

    return {
      data,
      total,
      page,
      limit,
      totalPaginas: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }
}