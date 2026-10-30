// Estado local de una exportación.
//
// No usa TanStack Query a proposito: una exportación no se cachea, no se
// reintenta y no debe reutilizar datos de una consulta. Cada llamada crea su
// propio `AbortController` para que el usuario pueda cancelar sin ver un error.
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  exportarConjunto as solicitarConjunto,
  exportarLibroCompleto as solicitarLibro,
  type ArchivoExportado,
  type SolicitudExportacion,
} from '@/lib/api/exports'
import { descargarArchivo } from './descarga'
import { esCancelacion, mensajeExportacion } from './presentacion'

/**
 * Espera máxima de una exportación.
 *
 * Coincide con el plazo del backend (60 s) más margen para la red y la
 * descarga. Si se agota, la pantalla vuelve a su estado normal con un mensaje
 * claro: nunca se reintenta sola.
 */
export const TIEMPO_MAXIMO_EXPORTACION_MS = 90_000

/** Mensaje visible cuando se agota la espera máxima. */
export const MENSAJE_TIEMPO_EXPORTACION =
  'La exportación tardó más de 90 segundos y se canceló. Inténtalo de nuevo.'

export interface SolicitudExportacionConEtiqueta extends SolicitudExportacion {
  /** Nombre visible del conjunto para los avisos. */
  etiqueta: string
}

export function useExportacion() {
  const [generando, setGenerando] = useState(false)
  const [nombreActual, setNombreActual] = useState<string | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const [error, setError] = useState<string | null>(null)
  const controlador = useRef<AbortController | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const montado = useRef(true)

  const limpiarTemporizador = useCallback(() => {
    if (temporizador.current !== null) {
      clearTimeout(temporizador.current)
      temporizador.current = null
    }
  }, [])

  useEffect(() => {
    // React en desarrollo (StrictMode) ejecuta setup → limpieza → setup. Sin
    // volver a marcar `montado` en el setup, el ref se quedaba en `false` para
    // siempre: ni se descargaba el archivo ni la pantalla dejaba de "generar".
    montado.current = true

    return () => {
      montado.current = false
      limpiarTemporizador()
      controlador.current?.abort()
      controlador.current = null
    }
  }, [limpiarTemporizador])

  const ejecutar = useCallback(
    async (
      etiqueta: string,
      solicitar: (signal: AbortSignal) => Promise<ArchivoExportado>,
    ): Promise<boolean> => {
      if (controlador.current) return false

      const control = new AbortController()
      controlador.current = control
      setGenerando(true)
      setNombreActual(etiqueta)
      setError(null)
      setAnuncio(`Generando ${etiqueta}…`)

      // El plazo se cumple aunque el servidor no conteste: no se espera a que
      // el `fetch` reaccione al `abort`.
      temporizador.current = setTimeout(() => {
        if (controlador.current !== control) return

        controlador.current = null
        limpiarTemporizador()
        control.abort()

        if (!montado.current) return
        setGenerando(false)
        setNombreActual(null)
        setError(MENSAJE_TIEMPO_EXPORTACION)
        setAnuncio('')
        toast.error(MENSAJE_TIEMPO_EXPORTACION)
      }, TIEMPO_MAXIMO_EXPORTACION_MS)

      try {
        const archivo = await solicitar(control.signal)
        // La exportación pudo cortarse (cancelar o plazo) mientras se esperaba.
        if (controlador.current !== control || !montado.current) return false

        descargarArchivo(archivo.blob, archivo.nombreArchivo)
        setAnuncio(`Archivo ${archivo.nombreArchivo} descargado.`)
        toast.success('Exportación lista', {
          description: archivo.nombreArchivo,
        })
        return true
      } catch (fallo) {
        if (controlador.current !== control || !montado.current) return false
        if (control.signal.aborted || esCancelacion(fallo)) return false

        const mensaje = mensajeExportacion(fallo)
        if (mensaje === null) {
          // 401: el proveedor de sesión ya cerró la sesión.
          setAnuncio('')
          return false
        }

        setError(mensaje)
        setAnuncio('')
        toast.error(mensaje)
        return false
      } finally {
        if (controlador.current === control) {
          limpiarTemporizador()
          controlador.current = null
          if (montado.current) {
            setGenerando(false)
            setNombreActual(null)
          }
        }
      }
    },
    [limpiarTemporizador],
  )

  const exportar = useCallback(
    (solicitud: SolicitudExportacionConEtiqueta): Promise<boolean> => {
      const { etiqueta, ...datos } = solicitud
      return ejecutar(etiqueta, (signal) => solicitarConjunto(datos, signal))
    },
    [ejecutar],
  )

  const exportarLibro = useCallback((): Promise<boolean> => {
    return ejecutar('el libro completo', (signal) => solicitarLibro(signal))
  }, [ejecutar])

  /**
   * Cancela la exportación en curso.
   *
   * La pantalla se restablece al instante y sin depender del servidor: el
   * `abort` solo intenta cortar la petición, y si el `fetch` no reacciona el
   * estado ya está limpio.
   */
  const cancelar = useCallback(() => {
    const control = controlador.current
    controlador.current = null
    limpiarTemporizador()
    control?.abort()

    if (!montado.current) return
    setGenerando(false)
    setNombreActual(null)
    setError(null)
    setAnuncio('Exportación cancelada.')
  }, [limpiarTemporizador])

  return {
    generando,
    nombreActual,
    anuncio,
    error,
    exportar,
    exportarLibro,
    cancelar,
  }
}
