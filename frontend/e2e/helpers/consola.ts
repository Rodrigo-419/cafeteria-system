// Captura de errores de consola y excepciones no capturadas del navegador.
//
// Se usa en varias pruebas de pulido: cualquier error de consola o error de
// página se acumula y se comprueba al final. Se filtran ruidos conocidos que no
// son fallos de la aplicación (por ejemplo el aviso de tamaño de imagen de
// recursos del navegador o los avisos de React DevTools).
import { type ConsoleMessage, type Page } from '@playwright/test'

const RUIDO_IGNORADO: readonly RegExp[] = [
  /favicon/i,
  /Download the React DevTools/i,
  /React DevTools/i,
  /\[vite\]/i,
]

/** Errores recogidos durante la vida de la página. */
export interface ErroresConsola {
  readonly errores: string[]
}

/** Empieza a escuchar errores de consola y de página en `page`. */
export function vigilarConsola(page: Page): ErroresConsola {
  const errores: string[] = []

  page.on('console', (mensaje: ConsoleMessage) => {
    if (mensaje.type() !== 'error') return
    const texto = mensaje.text()
    if (RUIDO_IGNORADO.some((patron) => patron.test(texto))) return
    errores.push(`console.error: ${texto}`)
  })

  page.on('pageerror', (error: Error) => {
    errores.push(`pageerror: ${error.message}`)
  })

  return { errores }
}

/**
 * Comprueba que no hubo errores de consola. Devuelve `null` si todo está bien,
 * o el texto concatenado de los errores para usarlo en una aserción.
 */
export function sinErrores(
  recolector: ErroresConsola,
): string | null {
  if (recolector.errores.length === 0) return null
  return recolector.errores.join('\n')
}
