// Caso de uso: historial de auditoria de un usuario concreto.
//
// El Admin ve el historial de cualquiera. Un Gerente solo si el usuario es hoy
// un Empleado de su sucursal; en caso contrario responde 404, para no revelar
// que el usuario existe. El alcance sigue el rol y la sucursal ACTUALES del
// usuario afectado: si un Empleado cambia de sucursal, su historial anterior
// pasa a verlo el Gerente de la sucursal nueva.
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ROL_EMPLEADO } from '../../users/domain/roles';
import {
  AuditoriaRepository,
  PaginaAuditoria,
} from '../infrastructure/auditoria.repository';
import { ActorAuditoria, alcanceDeActor } from './alcance-auditoria';

@Injectable()
export class HistorialUsuarioUseCase {
  constructor(private readonly auditoria: AuditoriaRepository) {}

  async ejecutar(
    actor: ActorAuditoria,
    usuarioId: string,
    paginacion: { page: number; limit: number },
  ): Promise<PaginaAuditoria> {
    const alcance = alcanceDeActor(actor);
    if (alcance === null) {
      throw new ForbiddenException('No tienes acceso a la auditoria');
    }

    const objetivo = await this.auditoria.buscarAlcanceUsuario(usuarioId);
    if (objetivo === null) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (
      alcance.tipo === 'sucursal' &&
      !(
        objetivo.rol === ROL_EMPLEADO &&
        objetivo.sucursalId === alcance.sucursalId
      )
    ) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.auditoria.historialDeUsuario(
      usuarioId,
      paginacion.page,
      paginacion.limit,
    );
  }
}
