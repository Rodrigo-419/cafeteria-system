import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CONFIGURACION_ARRANQUE_EN_FRIO,
  esFalloDeArranqueEnFrio,
  ErrorServidorDespertando,
  fijarConfiguracionArranqueEnFrio,
  MENSAJE_ARRANQUE_EN_FRIO,
  restaurarConfiguracionArranqueEnFrio,
  reintentarConArranqueEnFrio,
} from './arranque-en-frio'
import { ApiError } from './errors'

const dormirFalso = async () => {}

function errorDeRed(): unknown {
  return new TypeError('Failed to fetch')
}

describe('arranque en frio: deteccion del fallo', () => {
  it('reconoce los 502, 503 y 504', () => {
    for (const status of [502, 503, 504]) {
      expect(esFalloDeArranqueEnFrio(new ApiError(status, ['error']))).toBe(true)
    }
  });

  it('reconoce un fallo de red (TypeError de fetch)', () => {
    expect(esFalloDeArranqueEnFrio(errorDeRed())).toBe(true)
  });

  it('no trata otros estados como arranque en frio', () => {
    for (const status of [400, 401, 403, 404, 429]) {
      expect(esFalloDeArranqueEnFrio(new ApiError(status, ['error']))).toBe(
        false,
      )
    }
    expect(esFalloDeArranqueEnFrio(new Error('Error de validacion'))).toBe(false)
  });

  it('el mensaje es el texto acordado y no incluye detalles tecnicos', () => {
    expect(MENSAJE_ARRANQUE_EN_FRIO).toBe(
      'El servidor está despertando, puede tardar hasta un minuto',
    )
  });
});

describe('arranque en frio: configuracion por defecto', () => {
  it('usa un umbral de unos 4 segundos y un tope de hasta ~90 segundos', () => {
    expect(CONFIGURACION_ARRANQUE_EN_FRIO.esperaInicialMs).toBeGreaterThanOrEqual(
      3000,
    )
    expect(CONFIGURACION_ARRANQUE_EN_FRIO.esperaInicialMs).toBeLessThanOrEqual(
      5000,
    )
    expect(CONFIGURACION_ARRANQUE_EN_FRIO.tiempoMaximoMs).toBeGreaterThanOrEqual(
      80_000,
    )
    expect(CONFIGURACION_ARRANQUE_EN_FRIO.tiempoMaximoMs).toBeLessThanOrEqual(
      100_000,
    )
  });
});

describe('arranque en frio: reintento acotado', () => {
  afterEach(() => {
    restaurarConfiguracionArranqueEnFrio()
    vi.useRealTimers()
  })

  it('devuelve el valor si el primer intento funciona', async () => {
    let intentos = 0
    const valor = await reintentarConArranqueEnFrio(async () => {
      intentos += 1
      return 'ok'
    }, { dormir: dormirFalso })

    expect(valor).toBe('ok')
    expect(intentos).toBe(1)
  });

  it('reintenta y tiene exito tras un 503', async () => {
    let intentos = 0
    const valor = await reintentarConArranqueEnFrio(
      async () => {
        intentos += 1
        if (intentos === 1) throw new ApiError(503, ['despertando'])
        return 'ok'
      },
      { dormir: dormirFalso, configuracion: { esperaInicialMs: 1, tiempoMaximoMs: 1000, retrasoBaseMs: 1, retrasoMaximoMs: 1 } },
    )

    expect(valor).toBe('ok')
    expect(intentos).toBe(2)
  });

  it('reintenta y tiene exito tras un fallo de red', async () => {
    let intentos = 0
    const valor = await reintentarConArranqueEnFrio(
      async () => {
        intentos += 1
        if (intentos === 1) throw errorDeRed()
        return 'ok'
      },
      { dormir: dormirFalso, configuracion: { esperaInicialMs: 1, tiempoMaximoMs: 1000, retrasoBaseMs: 1, retrasoMaximoMs: 1 } },
    )

    expect(valor).toBe('ok')
    expect(intentos).toBe(2)
  });

  it('no reintenta un error que no es de arranque en frio', async () => {
    let intentos = 0
    await expect(
      reintentarConArranqueEnFrio(
        async () => {
          intentos += 1
          throw new ApiError(401, ['credenciales invalidas'])
        },
        { dormir: dormirFalso, configuracion: { esperaInicialMs: 1, tiempoMaximoMs: 1000, retrasoBaseMs: 1, retrasoMaximoMs: 1 } },
      ),
    ).rejects.toMatchObject({ status: 401 })

    expect(intentos).toBe(1)
  });

  it('avisa antes de cada reintento', async () => {
    const detectados: number[] = []
    let intentos = 0
    await reintentarConArranqueEnFrio(
      async () => {
        intentos += 1
        if (intentos < 3) throw new ApiError(503, ['despertando'])
        return 'ok'
      },
      {
        dormir: dormirFalso,
        alDetectar: (intento) => detectados.push(intento),
        configuracion: { esperaInicialMs: 1, tiempoMaximoMs: 1000, retrasoBaseMs: 1, retrasoMaximoMs: 1 },
      },
    )

    expect(detectados).toEqual([1, 2])
  });

  it('se rinde al superar el tiempo maximo y lanza el error generico', async () => {
    let intentos = 0
    const promesa = reintentarConArranqueEnFrio(
      async () => {
        intentos += 1
        throw new ApiError(503, ['despertando'])
      },
      {
        dormir: dormirFalso,
        configuracion: { esperaInicialMs: 1, tiempoMaximoMs: 5, retrasoBaseMs: 1, retrasoMaximoMs: 1 },
      },
    )

    await expect(promesa).rejects.toBeInstanceOf(ErrorServidorDespertando)
    await expect(promesa).rejects.toThrow(MENSAJE_ARRANQUE_EN_FRIO)
    expect(intentos).toBeGreaterThan(1)
  });

  it('reintenta cuando la peticion supera el umbral de espera', async () => {
    // Usa timers reales con delays minimos: el umbral de espera (1 ms) se
    // supera y el reintento se ejecuta antes de agotar el tiempo maximo.
    const peticion = (signal: AbortSignal) =>
      new Promise<never>((_resolver, reject) => {
        signal.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        )
      })

    const promesa = reintentarConArranqueEnFrio(peticion, {
      dormir: dormirFalso,
      configuracion: {
        esperaInicialMs: 1,
        tiempoMaximoMs: 5,
        retrasoBaseMs: 1,
        retrasoMaximoMs: 1,
      },
    })

    await expect(promesa).rejects.toBeInstanceOf(ErrorServidorDespertando)
  });

  it('la configuracion fijada en el modulo se aplica si no se pasa una', async () => {
    fijarConfiguracionArranqueEnFrio({
      esperaInicialMs: 1,
      tiempoMaximoMs: 5,
      retrasoBaseMs: 1,
      retrasoMaximoMs: 1,
    })

    await expect(
      reintentarConArranqueEnFrio(
        async () => {
          throw new ApiError(503, ['despertando'])
        },
        { dormir: dormirFalso },
      ),
    ).rejects.toBeInstanceOf(ErrorServidorDespertando)
  });
});
