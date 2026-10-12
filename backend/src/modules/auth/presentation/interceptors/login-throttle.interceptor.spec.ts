import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { LoginThrottleService } from '../../application/login-throttle.service';
import { LoginThrottleInterceptor } from './login-throttle.interceptor';

type ServicioFalso = jest.Mocked<
  Pick<LoginThrottleService, 'verificar' | 'registrarFallo' | 'registrarExito'>
>;

function crearServicio(verificar: number | null): ServicioFalso {
  return {
    verificar: jest.fn().mockReturnValue(verificar),
    registrarFallo: jest.fn(),
    registrarExito: jest.fn(),
  };
}

function crearContexto(body: unknown) {
  const setHeader = jest.fn();
  const request = {
    body,
    ip: '1.1.1.1',
    socket: { remoteAddress: '1.1.1.1' },
  };
  const response = { setHeader };
  const contexto = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;

  return { contexto, setHeader };
}

function capturarError(ejecutar: () => unknown): HttpException {
  try {
    ejecutar();
  } catch (error) {
    return error as HttpException;
  }
  throw new Error('Se esperaba una excepcion y no se lanzo ninguna');
}

describe('LoginThrottleInterceptor', () => {
  it('lanza 429 con Retry-After cuando el par ya esta bloqueado', () => {
    const servicio = crearServicio(12);
    const interceptor = new LoginThrottleInterceptor(
      servicio as unknown as LoginThrottleService,
    );
    const { contexto, setHeader } = crearContexto({
      nombreUsuario: 'ana',
      password: 'x',
    });

    const error = capturarError(() =>
      interceptor.intercept(contexto, { handle: () => of('ok') }),
    );

    expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '12');
    expect(JSON.stringify(error.getResponse())).toContain('12 segundos');
    // El bloqueo corta antes de ejecutar el caso de uso.
    expect(servicio.registrarExito).not.toHaveBeenCalled();
  });

  it('usa singular cuando queda un segundo', () => {
    const servicio = crearServicio(1);
    const interceptor = new LoginThrottleInterceptor(
      servicio as unknown as LoginThrottleService,
    );
    const { contexto } = crearContexto({ nombreUsuario: 'ana', password: 'x' });

    const error = capturarError(() =>
      interceptor.intercept(contexto, { handle: () => of('ok') }),
    );

    expect(JSON.stringify(error.getResponse())).toContain('1 segundo e');
    expect(JSON.stringify(error.getResponse())).not.toContain('1 segundos');
  });

  it('registra el exito cuando el login resuelve', async () => {
    const servicio = crearServicio(null);
    const interceptor = new LoginThrottleInterceptor(
      servicio as unknown as LoginThrottleService,
    );
    const { contexto } = crearContexto({
      nombreUsuario: 'ana',
      password: 'correcta',
    });

    const resultado = await firstValueFrom(
      interceptor.intercept(contexto, {
        handle: () => of({ accessToken: 'token' }),
      }),
    );

    expect(resultado).toEqual({ accessToken: 'token' });
    expect(servicio.registrarExito).toHaveBeenCalledWith('ana', '1.1.1.1');
    expect(servicio.registrarFallo).not.toHaveBeenCalled();
  });

  it('registra el fallo cuando el login lanza 401', async () => {
    const servicio = crearServicio(null);
    const interceptor = new LoginThrottleInterceptor(
      servicio as unknown as LoginThrottleService,
    );
    const { contexto } = crearContexto({
      nombreUsuario: 'ana',
      password: 'mala',
    });

    await expect(
      firstValueFrom(
        interceptor.intercept(contexto, {
          handle: () => throwError(() => new UnauthorizedException()),
        }),
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(servicio.registrarFallo).toHaveBeenCalledWith('ana', '1.1.1.1');
    expect(servicio.registrarExito).not.toHaveBeenCalled();
  });

  it('NO registra fallo cuando el login lanza 403 (cuenta bloqueada)', async () => {
    const servicio = crearServicio(null);
    const interceptor = new LoginThrottleInterceptor(
      servicio as unknown as LoginThrottleService,
    );
    const { contexto } = crearContexto({
      nombreUsuario: 'ana',
      password: 'correcta',
    });

    await expect(
      firstValueFrom(
        interceptor.intercept(contexto, {
          handle: () => throwError(() => new ForbiddenException('bloqueada')),
        }),
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(servicio.registrarFallo).not.toHaveBeenCalled();
  });

  it('normaliza el usuario enviado antes de usarlo como clave', () => {
    const servicio = crearServicio(null);
    const interceptor = new LoginThrottleInterceptor(
      servicio as unknown as LoginThrottleService,
    );
    const { contexto } = crearContexto({
      nombreUsuario: '  ANA.PEREZ  ',
      password: 'x',
    });

    interceptor.intercept(contexto, { handle: () => of('ok') });

    expect(servicio.verificar).toHaveBeenCalledWith('ana.perez', '1.1.1.1');
  });

  it('trata un cuerpo sin nombre de usuario como cadena vacia', () => {
    const servicio = crearServicio(null);
    const interceptor = new LoginThrottleInterceptor(
      servicio as unknown as LoginThrottleService,
    );
    const { contexto } = crearContexto({ password: 'x' });

    interceptor.intercept(contexto, { handle: () => of('ok') });

    expect(servicio.verificar).toHaveBeenCalledWith('', '1.1.1.1');
  });
});
