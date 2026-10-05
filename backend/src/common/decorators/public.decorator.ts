// Decorador que marca una ruta como publica, saltandose el JwtAuthGuard.
import { SetMetadata } from '@nestjs/common';

/** Clave de metadatos leida por el JwtAuthGuard. */
export const IS_PUBLIC_KEY = 'is_public';

/**
 * Marca la ruta como publica. Los guards globales son APP_GUARD, asi que sin
 * este decorador TODAS las rutas exigen token.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);