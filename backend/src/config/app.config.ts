// Configuracion general de la aplicacion (puerto, CORS y prefijos).
import { registerAs } from '@nestjs/config';

/** Prefijo global de todas las rutas de la API. */
export const APP_GLOBAL_PREFIX = 'api';

/**
 * Se lee de process.env porque ConfigModule asigna las variables ya
 * validadas a process.env antes de ejecutar las factories de `load`.
 * Inyectar ConfigService aqui crearia una dependencia circular: el
 * provider de ConfigService depende de los tokens registrados en `load`.
 */
export const appConfig = registerAs('app', () => ({
  port: Number(process.env.PORT ?? 3000),
  globalPrefix: APP_GLOBAL_PREFIX,
}));

export default appConfig;