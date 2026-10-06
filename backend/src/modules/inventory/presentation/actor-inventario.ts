// Reduce `request.user` al recorte minimo que exigen las reglas de alcance.
//
// Vive fuera de los controllers porque los cuatro lo necesitan y duplicarlo en
// cada uno seria cuatro sitios donde anadir un campo y olvidarse de tres.
import type { UsuarioAutenticado } from '../../auth/infrastructure/jwt/jwt.strategy';
import type { ActorInventario } from '../domain/rules/alcance-inventario';

/** El actor tal y como lo ven las reglas de alcance de inventario. */
export function aActorInventario(usuario: UsuarioAutenticado): ActorInventario {
  return {
    id: usuario.id,
    rol: usuario.rol,
    sucursalId: usuario.sucursalId,
  };
}
