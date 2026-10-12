// Interceptor que aplica el control de intentos fallidos solo al login.
//
// Se usa un interceptor (y no el throttler generico) porque hace falta mirar el
// RESULTADO de la peticion: solo los fallos de credenciales (401) consumen cupo.
// El interceptor comprueba el bloqueo antes de ejecutar el caso de uso y, con
// `tap`, registra el fallo o reinicia el contador segun lo que devuelva el
// login.
import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { LoginThrottleService } from '../../application/login-throttle.service';
import { normalizarNombreUsuario } from '../../domain/rules/nombre-usuario';

/** Titulo comun del error 429; el detalle incluye los segundos de espera. */
const MENSAJE_DEMASIADOS_INTENTOS = 'Demasiados intentos';

@Injectable()
export class LoginThrottleInterceptor implements NestInterceptor {
  constructor(private readonly loginThrottle: LoginThrottleService) {}

  intercept(
    contexto: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const peticion = contexto.switchToHttp().getRequest<Request>();
    const respuesta = contexto.switchToHttp().getResponse<Response>();

    // El interceptor corre antes del ValidationPipe, asi que el cuerpo puede
    // venir sin transformar; se normaliza aqui igual que lo hara el DTO para que
    // la clave sea la misma antes y despues de validar.
    const usuario = normalizarNombreUsuario(
      typeof peticion.body?.nombreUsuario === 'string'
        ? peticion.body.nombreUsuario
        : '',
    );
    const ip = ipDe(peticion);

    const esperaSegundos = this.loginThrottle.verificar(usuario, ip);
    if (esperaSegundos !== null) {
      respuesta.setHeader('Retry-After', String(esperaSegundos));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            `${MENSAJE_DEMASIADOS_INTENTOS}. Espera ${esperaSegundos} ` +
            `${esperaSegundos === 1 ? 'segundo' : 'segundos'} e inténtalo de nuevo.`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return next.handle().pipe(
      tap({
        next: () => this.loginThrottle.registrarExito(usuario, ip),
        error: (error: unknown) => {
          if (estadoDe(error) === HttpStatus.UNAUTHORIZED) {
            this.loginThrottle.registrarFallo(usuario, ip);
          }
        },
      }),
    );
  }
}

/**
 * IP del cliente segun Express. Con `trust proxy` desactivado (por defecto) es
 * la del socket; activado, Express resuelve `X-Forwarded-For` en `req.ip`, que
 * es justo lo que se quiere documentar en la configuracion de despliegue.
 */
function ipDe(peticion: Request): string {
  return peticion.ip || peticion.socket?.remoteAddress || 'desconocida';
}

function estadoDe(error: unknown): number | null {
  return error instanceof HttpException ? error.getStatus() : null;
}
