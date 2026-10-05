// Decorador que declara los permisos requeridos por un handler o controller.
// El PermissionsGuard los exige TODOS: basta con que falte uno para denegar.
import { SetMetadata } from '@nestjs/common';

/** Clave de metadatos leida por el PermissionsGuard. */
export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * Declara los codigos de permiso que la ruta exige.
 * Sin este decorador la ruta solo requiere estar autenticada.
 *
 * @example `@RequirePermission('ventas.registrar', 'ventas.ver')`
 */
export const RequirePermission = (...codigos: string[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, codigos);