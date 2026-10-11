// Configuracion de la aplicacion Nest compartida entre `main.ts` y las pruebas
// end-to-end.
//
// Existe para que el prefijo global, el ValidationPipe, `trust proxy` y CORS
// se configuren en un unico sitio. Si cada uno los declarara por su cuenta,
// las pruebas pasarian contra una aplicacion distinta a la real y no
// detectarian, por ejemplo, que falte `forbidNonWhitelisted` o que CORS quede
// abierto a cualquier origen.
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

/**
 * Traduce `CORS_ORIGIN` a la lista de origenes que `enableCors` permite.
 *
 * La variable es una lista separada por comas ("http://localhost:5173,
 * http://localhost:4173"). Se recortan los espacios y se descartan los tramos
 * vacios para tolerar comas colgantes. Un valor ausente o vacio devuelve `[]`,
 * que en la libreria `cors` significa que NINGUN origen recibe cabeceras de
 * CORS: es el default seguro para una API autenticada con Bearer, donde no se
 * quiere que cualquier pagina web pueda leer las respuestas.
 */
export function interpretarCorsOrigin(valor: string | undefined): string[] {
  return (valor ?? '')
    .split(',')
    .map((origen) => origen.trim())
    .filter((origen) => origen.length > 0);
}

/** Opciones que `main.ts` puede pasar a `configureApp`. */
export interface OpcionesConfiguracion {
  /** Valor crudo de `TRUST_PROXY` (ver `interpretarTrustProxy`). */
  trustProxy?: string;
  /** Valor crudo de `CORS_ORIGIN` (ver `interpretarCorsOrigin`). */
  corsOrigin?: string;
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

  // CORS: solo los origenes declarados en `CORS_ORIGIN`. Sin la variable la
  // lista queda vacia y ningun origen recibe `Access-Control-Allow-Origin`.
  // No se habilitan credenciales: la autenticacion viaja en la cabecera
  // `Authorization` (Bearer), que va en `allowedHeaders`.
  app.enableCors({
    origin: interpretarCorsOrigin(opciones.corsOrigin),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  return app;
}