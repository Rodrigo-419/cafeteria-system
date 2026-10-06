// Reduce `request.user` al recorte minimo que exigen las reglas de alcance.
//
// Vive fuera del controller porque las cuatro rutas lo necesitan y duplicarlo
// en cada una seria cuatro sitios donde anadir un campo y olvidarse de tres.
import type { UsuarioAutenticado } from '../../auth/infrastructure/jwt/jwt.strategy';
import type { ActorVentas } from '../domain/rules/alcance-ventas';

/** El actor tal y como lo ven las reglas de alcance de ventas. */
export function aActorVentas(usuario: UsuarioAutenticado): ActorVentas {
  return {
    id: usuario.id,
    rol: usuario.rol,
    sucursalId: usuario.sucursalId,
  };
}
