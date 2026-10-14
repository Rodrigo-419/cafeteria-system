// Caso de uso: listar la auditoria con filtros y paginado.
//
// El alcance sale del rol: el Admin ve todo y el Gerente solo lo suyo. Las
// fechas se interpretan como dias locales (America/Lima) y, si se envia un
// rango, no puede pasar de 92 dias.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { construirRango } from '../domain/fechas';
import {
  AccionAuditoria,
  EntidadAuditoria,
} from '../domain/evento-auditoria';
import {
  AuditoriaRepository,
  PaginaAuditoria,
} from '../infrastructure/auditoria.repository';
import { ActorAuditoria, alcanceDeActor } from './alcance-auditoria';

export type FiltrosListarAuditoria = {
  page: number;
  limit: number;
  actorId?: string;
  entidad?: EntidadAuditoria;
  entidadId?: string;
  accion?: AccionAuditoria;
  sucursalId?: string;
  desde?: string;
  hasta?: string;
};

@Injectable()
export class ListarAuditoriaUseCase {
  constructor(private readonly auditoria: AuditoriaRepository) {}

  async ejecutar(
    actor: ActorAuditoria,
    filtros: FiltrosListarAuditoria,
  ): Promise<PaginaAuditoria> {
    const alcance = alcanceDeActor(actor);
    if (alcance === null) {
      throw new ForbiddenException('No tienes acceso a la auditoria');
    }

    let rango;
    try {
      rango = construirRango(filtros.desde, filtros.hasta);
    } catch (error) {
      // `construirRango` valida el formato, el orden y el tope de dias.
      throw new BadRequestException((error as Error).message);
    }

    return this.auditoria.listar(
      {
        page: filtros.page,
        limit: filtros.limit,
        actorId: filtros.actorId,
        entidad: filtros.entidad,
        entidadId: filtros.entidadId,
        accion: filtros.accion,
        sucursalId: filtros.sucursalId,
        creadoDesde: rango.gte,
        creadoHastaExclusivo: rango.lt,
      },
      alcance,
    );
  }
}
