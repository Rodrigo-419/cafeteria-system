// Configuracion de la aplicacion Nest compartida entre `main.ts` y las pruebas
// end-to-end.
//
// Existe para que el prefijo global y el ValidationPipe se configuren en un
// unico sitio. Si cada uno los declarara por su cuenta, las pruebas pasarian
// contra una aplicacion distinta a la real y no detectarian, por ejemplo, que
// falte `forbidNonWhitelisted`.
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_GLOBAL_PREFIX } from './config/app.config';

/**
 * Aplica a la instancia lo mismo que aplica la aplicacion real de produccion.
 *
 * No incluye `enableShutdownHooks`: es un efecto del ciclo de vida del proceso
 * que solo tiene sentido en el arranque real, no en una app de pruebas que se
 * cierra al terminar cada suite.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix(APP_GLOBAL_PREFIX);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  return app;
}