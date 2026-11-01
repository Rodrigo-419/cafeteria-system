// Creacion de la aplicacion Nest para las pruebas end-to-end.
//
// Reune en un sitio la desviacion que la app de pruebas necesita respecto a
// `main.ts`, para que cada suite no tenga que recordarla:
//
//   1. El limite de intentos del throttler se sustituye por un almacenamiento
//      que nunca bloquea. Las pruebas hacen decenas de peticiones y sin esto el
//      limite general por IP las haria fallar entre suites por motivos que no
//      tienen que ver con lo que se prueba.
//   2. El control propio de intentos de login se sustituye, por defecto, por uno
//      que nunca bloquea: solo la suite que lo prueba lo usa de verdad (pasando
//      `neutroLoginThrottle: false` y un reloj simulado).
//   3. Se usa `configureApp`, el mismo que usa `main.ts`, para que el prefijo
//      global y el ValidationPipe sean los reales en vez de una copia.
//
// El entorno de pruebas (base de datos y secreto JWT) lo fija
// `test/entorno-pruebas.ts` mediante `setupFiles`, que corre antes de que se
// importe `AppModule`. Ver el comentario de ese archivo: si se hiciera aqui,
// las pruebas se ejecutarian contra la base de desarrollo.
import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getStorageToken, type ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import {
  LoginThrottleService,
  RELOJ_LOGIN,
} from '../../src/modules/auth/application/login-throttle.service';
import { LIMITES_EXPORT } from '../../src/modules/exports/exports.service';
import type { LimitesExport } from '../../src/modules/exports/domain/limites';
import { exigirBaseDePruebas, urlBaseDePruebas } from './url-base-pruebas';

/**
 * Almacenamiento del throttler que nunca marca una peticion como bloqueada.
 *
 * Se sustituye el almacenamiento en lugar del guard para no tener que suplantar
 * `APP_GUARD`, que en `app.module.ts` esta registrado tres veces (jwt,
 * permisos y throttler) y no se puede sustituir de forma no ambigua.
 */
export class AlmacenamientoSinLimites implements ThrottlerStorage {
  increment(): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    return Promise.resolve({
      totalHits: 0,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  }
}

/** Control de intentos de login que nunca bloquea, para las suites genericas. */
class LoginThrottleSinLimites {
  verificar(): null {
    return null;
  }

  registrarFallo(): void {
    // Sin efecto.
  }

  registrarExito(): void {
    // Sin efecto.
  }
}

export interface OpcionesAppDePruebas {
  /** Reloj simulado que usara el control de intentos de login. */
  reloj?: () => number;
  /**
   * Si es `true` (por defecto) el control de intentos de login no bloquea
   * nunca. La suite que prueba el limite pasa `false` para usar el real.
   */
  neutroLoginThrottle?: boolean;
  /** Valor crudo de `TRUST_PROXY` que se aplicara a la app de pruebas. */
  trustProxy?: string;
  /** Topes de exportacion distintos de los de produccion (pruebas). */
  limitesExport?: Partial<LimitesExport>;
}

/**
 * Compila la aplicacion y la deja lista para supertest.
 *
 * El entorno (base de pruebas y secreto JWT) ya lo fijo `entorno-pruebas.ts`
 * mediante `setupFiles`, antes de importar este modulo. Aqui solo queda
 * comprobar la invariante y montar la app.
 *
 * El servidor HTTP se levanta una sola vez en el puerto 0 (un puerto efimero
 * que asigna el sistema operativo y que solo conoce esta suite). supertest
 * reutiliza ese servidor ya escuchando, asi que las peticiones simultaneas se
 * concentran sobre la misma direccion y no se abre un puerto nuevo por
 * peticion (eso podia fallar con ECONNREFUSED en los tests de concurrencia).
 * Cada suite es responsable de cerrar la app en su `afterAll`.
 */
export async function crearAppDePruebas(
  opciones: OpcionesAppDePruebas = {},
): Promise<INestApplication> {
  exigirBaseDePruebas(urlBaseDePruebas());

  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(getStorageToken())
    .useClass(AlmacenamientoSinLimites)
    .overrideProvider(RELOJ_LOGIN)
    .useValue(opciones.reloj ?? (() => Date.now()));

  if (opciones.neutroLoginThrottle ?? true) {
    builder = builder
      .overrideProvider(LoginThrottleService)
      .useValue(new LoginThrottleSinLimites());
  }

  if (opciones.limitesExport !== undefined) {
    builder = builder
      .overrideProvider(LIMITES_EXPORT)
      .useValue(opciones.limitesExport);
  }

  const moduleFixture: TestingModule = await builder.compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app, { trustProxy: opciones.trustProxy });

  await app.init();
  await app.listen(0);

  return app;
}
