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
 * Traduce el valor de `TRUST_PROXY` al que entiende Express en
 * `app.set('trust proxy', ...)`.
 *
 * Express acepta un booleano, un numero de saltos (hops), o una cadena con
 * palabras clave o subredes ("loopback", "10.0.0.0/8"). Aqui se reconocen los
 * alias habituales de "desactivado" (`false`, `off`, `0`, vacio) y
 * "activado" (`true`, `on`); un entero se interpreta como saltos y cualquier
 * otro texto se pasa tal cual.
 *
 * El valor por defecto es `false` (no confiar en `X-Forwarded-For`): activarlo
 * solo tiene sentido detras de un proxy inverso propio.
 */
export function interpretarTrustProxy(
  valor: string | undefined,
): boolean | number | string {
  const normalizado = (valor ?? '').trim().toLowerCase();

  if (
    normalizado === '' ||
    normalizado === 'false' ||
    normalizado === 'off' ||
    normalizado === '0'
  ) {
    return false;
  }

  if (normalizado === 'true' || normalizado === 'on') {
    return true;
  }

  const saltos = Number(normalizado);
  if (Number.isInteger(saltos) && saltos >= 0) {
    return saltos;
  }

  return normalizado;
}

/** Opciones que `main.ts` puede pasar a `configureApp`. */
export interface OpcionesConfiguracion {
  /** Valor crudo de `TRUST_PROXY` (ver `interpretarTrustProxy`). */
  trustProxy?: string;
}

/**
 * Aplica a la instancia lo mismo que aplica la aplicacion real de produccion.
 *
 * No incluye `enableShutdownHooks`: es un efecto del ciclo de vida del proceso
 * que solo tiene sentido en el arranque real, no en una app de pruebas que se
 * cierra al terminar cada suite.
 */
export function configureApp(
  app: INestApplication,
  opciones: OpcionesConfiguracion = {},
): INestApplication {
  app.setGlobalPrefix(APP_GLOBAL_PREFIX);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Se fija siempre (por defecto `false`, el valor de Express) para que
  // confiar en `X-Forwarded-For` sea una decision explicita y quede claro en
  // las pruebas y en el arranque.
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', interpretarTrustProxy(opciones.trustProxy));

  return app;
}