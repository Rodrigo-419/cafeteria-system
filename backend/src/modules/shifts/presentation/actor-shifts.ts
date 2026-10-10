// Reduce `request.user` al recorte minimo que exigen las reglas de alcance de
// turnos. Vive fuera del controller porque todas las rutas lo necesitan.
import type { UsuarioAutenticado } from '../../auth/infrastructure/jwt/jwt.strategy';
import type { ActorTurnos } from '../domain/rules/alcance';

/** El actor tal y como lo ven las reglas de alcance de turnos. */
export function aActorTurnos(usuario: UsuarioAutenticado): ActorTurnos {
  return {
    id: usuario.id,
    rol: usuario.rol,
    sucursalId: usuario.sucursalId,
    permisosEfectivos: usuario.permisosEfectivos,
  };
}
