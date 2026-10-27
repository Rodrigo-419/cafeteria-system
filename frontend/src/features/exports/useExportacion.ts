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
  const montado = useRef(true)

  useEffect(() => {
    return () => {
      montado.current = false
      controlador.current?.abort()
      controlador.current = null
    }
  }, [])

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

      try {
        const archivo = await solicitar(control.signal)
        if (control.signal.aborted || !montado.current) return false

        descargarArchivo(archivo.blob, archivo.nombreArchivo)
        setAnuncio(`Archivo ${archivo.nombreArchivo} descargado.`)
        toast.success('Exportación lista', {
          description: archivo.nombreArchivo,
        })
        return true
      } catch (fallo) {
        if (
          control.signal.aborted ||
          esCancelacion(fallo) ||
          !montado.current
        ) {
          return false
        }

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
          controlador.current = null
        }
        if (montado.current && !control.signal.aborted) {
          setGenerando(false)
          setNombreActual(null)
        }
      }
    },
    [],
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

  const cancelar = useCallback(() => {
    const control = controlador.current
    if (!control) return

    controlador.current = null
    control.abort()
    setGenerando(false)
    setNombreActual(null)
    setError(null)
    setAnuncio('Exportación cancelada.')
  }, [])

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
