// Reduce `request.user` al recorte minimo que exigen las reglas de alcance de
// asistencia.
import type { UsuarioAutenticado } from '../../auth/infrastructure/jwt/jwt.strategy';
import type { ActorAsistencia } from '../domain/rules/alcance';

/** El actor tal y como lo ve la asistencia. */
export function aActorAsistencia(usuario: UsuarioAutenticado): ActorAsistencia {
  return {
    id: usuario.id,
    rol: usuario.rol,
    sucursalId: usuario.sucursalId,
  };
}