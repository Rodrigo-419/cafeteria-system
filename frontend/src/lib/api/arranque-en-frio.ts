// Arranque en frio: aviso y reintento acotado cuando el servidor se esta
// despertando.
//
// En un alojamiento serverless (Render gratuito, etc.) el backend se suspende
// por inactividad y la primera peticion puede tardar decenas de segundos o
// fallar con 502/503/504 o un error de red. Sin esto, el usuario ve un mensaje
// tecnico o un formulario que parece colgado.
//
// Reglas del aviso:
//   * Se considera "arranque en frio" si la peticion tarda mas de unos 4 s o
//     falla por red, 502, 503 o 504.
//   * Se reintenta de forma automatica y acotada, con un tope de ~90 s.
//   * El mensaje es generico y no expone detalles tecnicos.
//   * Solo se aplica a la primera peticion del arranque (login o refresco de
//     sesion), no al resto de llamadas: no cambia los tiempos habituales.
//
// El modulo es puro y no llama a `fetch`: se prueba con errores simulados.

import { ApiError } from './errors'

/** Mensaje que ve el usuario mientras el servidor despierta. */
export const MENSAJE_ARRANQUE_EN_FRIO =
  'El servidor está despertando, puede tardar hasta un minuto'

/** Estados HTTP que indican que el servidor esta despertando. */
const ESTADOS_DE_ARRANQUE = new Set([502, 503, 504])

/** Configuracion por defecto del arranque en frio. */
export interface ConfiguracionArranqueEnFrio {
  /** Umbral de la primera respuesta antes de considerar que tarda demasiado. */
  esperaInicialMs: number
  /** Tiempo total maximo de reintentos, en milisegundos. */
  tiempoMaximoMs: number
  /** Espera base entre intentos; crece al doble en cada reintento. */
  retrasoBaseMs: number
  /** Techo de la espera entre intentos. */
  retrasoMaximoMs: number
}

export const CONFIGURACION_ARRANQUE_EN_FRIO: ConfiguracionArranqueEnFrio = {
  esperaInicialMs: 4000,
  tiempoMaximoMs: 90_000,
  retrasoBaseMs: 1000,
  retrasoMaximoMs: 15_000,
}

/** Error interno que marca que se supero el umbral de espera inicial. */
export class TiempoDeEsperaAgotadoError extends Error {
  constructor() {
    super('Tiempo de espera agotado')
    this.name = 'TiempoDeEsperaAgotadoError'
  }
}

/** Error que se muestra al usuario cuando el servidor no termina de despertar. */
export class ErrorServidorDespertando extends Error {
  constructor() {
    super(MENSAJE_ARRANQUE_EN_FRIO)
    this.name = 'ErrorServidorDespertando'
  }
}

/**
 * `true` si el error corresponde a un arranque en frio.
 *
 * Cubre un fallo de red (`fetch` lanza `TypeError`) y los 502/503/504. No
 * cubre 401, 403, 429 ni ningun otro estado: esos tienen su mensaje propio y
 * no deben disparar el reintento.
 */
export function esFalloDeArranqueEnFrio(error: unknown): boolean {
  if (error instanceof ApiError) {
    return ESTADOS_DE_ARRANQUE.has(error.status)
  }
  return error instanceof TypeError
}

export interface OpcionesArranqueEnFrio {
  configuracion?: ConfiguracionArranqueEnFrio
  /** Inyeccion de la espera; solo para pruebas. */
  dormir?: (ms: number) => Promise<void>
  /** Reloj inyectable; solo para pruebas. */
  ahora?: () => number
  /**
   * Senal externa (p. ej. la de desmontaje del componente). Si se cancela, se
   * detiene el reintento con un `CanceladoError` y NO se trata como arranque en
   * frio.
   */
  senalExterna?: AbortSignal
  /** Se invoca cada vez que se detecta un arranque en frio (antes de reintentar). */
  alDetectar?: (intento: number) => void
}

/** Error interno para detener el reintento por cancelacion externa. */
class CanceladoError extends Error {
  constructor() {
    super('Cancelado')
    this.name = 'CanceladoError'
  }
}

/**
 * Ejecuta una peticion de arranque reintentando solo ante arranque en frio.
 *
 * La peticion recibe un `AbortSignal`: si supera el umbral de espera inicial,
 * se cancela y se reintenta. El reintento es automatico y acotado por
 * `tiempoMaximoMs`. Si se agota, lanza `ErrorServidorDespertando`.
 *
 * Solo debe usarse para operaciones idempotentes (login y refresco de sesion),
 * nunca para escrituras con efecto: repetirlas podria duplicar datos.
 */
export async function reintentarConArranqueEnFrio<T>(
  peticion: (senal: AbortSignal) => Promise<T>,
  opciones: OpcionesArranqueEnFrio = {},
): Promise<T> {
  const config = opciones.configuracion ?? configuracionActual
  const dormir =
    opciones.dormir ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const ahora = opciones.ahora ?? Date.now
  const inicio = ahora()
  let intento = 0

  for (;;) {
    intento += 1
    const controlador = new AbortController()
    let temporizador: ReturnType<typeof setTimeout> | undefined

    const limite = new Promise<never>((_resolver, rechazar) => {
      temporizador = setTimeout(() => {
        // Se rechaza PRIMERO para que la carrera se resuelva con el error de
        // arranque y no con el AbortError del fetch.
        rechazar(new TiempoDeEsperaAgotadoError())
        controlador.abort()
      }, config.esperaInicialMs)
    })

    // Cancelacion externa: desmontaje del componente o abort del llamador.
    let cancelar: (() => void) | undefined
    const cancelado = new Promise<never>((_resolver, rechazar) => {
      cancelar = () => {
        // Primero se rechaza para que la carrera se resuelva con la
        // cancelacion; luego se aborta la peticion en vuelo.
        rechazar(new CanceladoError())
        controlador.abort()
      }
      if (opciones.senalExterna?.aborted) {
        cancelar()
        return
      }
      opciones.senalExterna?.addEventListener('abort', cancelar, {
        once: true,
      })
    })

    try {
      const valor = await Promise.race([
        peticion(controlador.signal),
        limite,
        cancelado,
      ])
      if (temporizador) clearTimeout(temporizador)
      opciones.senalExterna?.removeEventListener('abort', cancelar!)
      return valor
    } catch (error) {
      if (temporizador) clearTimeout(temporizador)
      opciones.senalExterna?.removeEventListener('abort', cancelar!)

      // Una cancelacion externa no es un arranque en frio: se propaga tal cual.
      if (error instanceof CanceladoError) {
        throw error
      }

      const esArranque =
        error instanceof TiempoDeEsperaAgotadoError ||
        esFalloDeArranqueEnFrio(error)
      if (!esArranque) {
        throw error
      }

      opciones.alDetectar?.(intento)

      const transcurrido = ahora() - inicio
      const retraso = Math.min(
        config.retrasoBaseMs * 2 ** (intento - 1),
        config.retrasoMaximoMs,
      )
      if (transcurrido + retraso >= config.tiempoMaximoMs) {
        throw new ErrorServidorDespertando()
      }
      await dormir(retraso)
    }
  }
}

// Configuracion vigente. Se expone un setter para que las pruebas puedan
// acortar los tiempos sin esperar minutos; en produccion nunca se toca.
let configuracionActual: ConfiguracionArranqueEnFrio =
  CONFIGURACION_ARRANQUE_EN_FRIO

/** Fija la configuracion de arranque en frio. Pensado para pruebas. */
export function fijarConfiguracionArranqueEnFrio(
  config: ConfiguracionArranqueEnFrio,
): void {
  configuracionActual = config
}

/** Restaura la configuracion por defecto. */
export function restaurarConfiguracionArranqueEnFrio(): void {
  configuracionActual = CONFIGURACION_ARRANQUE_EN_FRIO
}
