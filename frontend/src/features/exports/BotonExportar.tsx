// Boton reutilizable "Exportar" de los listados.
//
// Solo aparece con `usuarios.crear_editar` y el permiso de lectura del conjunto.
// Si el conjunto exige rango y el listado ya tiene uno válido, exporta en Excel
// directamente; si le falta o no es válido, abre `/exports` con el conjunto
// (y las fechas disponibles) preseleccionados para que el usuario lo complete.
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { DownloadIcon, LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from 'cn'
import { useAuth } from '@/lib/auth/useAuth'
import { diaDeNegocioLima } from '@/lib/format/dates'
import {
  definicionDeConjunto,
  puedeExportarConjunto,
  type ClaveConjuntoExport,
} from './catalogo'
import { validarRangoExportacion } from './presentacion'
import { useExportacion } from './useExportacion'

interface BotonExportarProps {
  conjunto: ClaveConjuntoExport
  /** Fecha inicial del listado, si la tiene. */
  desde?: string
  /** Fecha final del listado, si la tiene. */
  hasta?: string
  className?: string
}

export function BotonExportar({
  conjunto,
  desde = '',
  hasta = '',
  className,
}: BotonExportarProps) {
  const { permisos } = useAuth()
  const navigate = useNavigate()
  const { generando, anuncio, error, exportar, cancelar } = useExportacion()
  const botonRef = useRef<HTMLButtonElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const estabaGenerando = useRef(false)

  const definicion = definicionDeConjunto(conjunto)

  useEffect(() => {
    const termino = estabaGenerando.current && !generando
    estabaGenerando.current = generando
    if (!termino) return

    if (error) {
      errorRef.current?.focus()
    } else {
      botonRef.current?.focus()
    }
  }, [generando, error])

  if (!definicion || !puedeExportarConjunto(permisos, definicion)) {
    return null
  }

  const irAPantalla = () => {
    const parametros = new URLSearchParams({ conjunto: definicion.clave })
    if (desde) parametros.set('desde', desde)
    if (hasta) parametros.set('hasta', hasta)
    navigate(`/exports?${parametros.toString()}`)
  }

  const alExportar = () => {
    let filtros: { desde: string; hasta: string } | undefined

    if (definicion.exigeRango) {
      const fallo = validarRangoExportacion(
        desde,
        hasta,
        diaDeNegocioLima(new Date()),
      )
      if (fallo) {
        irAPantalla()
        return
      }
      filtros = { desde, hasta }
    }

    void exportar({
      conjunto: definicion.clave,
      formato: 'xlsx',
      filtros,
      etiqueta: definicion.etiqueta,
    })
  }

  return (
    <div
      className={cn(
        'flex flex-col items-end gap-1',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {generando ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              aria-label={`Exportando ${definicion.etiqueta}`}
            >
              <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              Exportando…
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancelar}
              aria-label="Cancelar exportación"
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={alExportar}
            ref={botonRef}
            aria-label={`Exportar ${definicion.etiqueta} en Excel`}
          >
            <DownloadIcon aria-hidden="true" />
            Exportar
          </Button>
        )}
      </div>

      {error && (
        <p
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="max-w-72 text-xs text-destructive outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {error}
        </p>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </span>
    </div>
  )
}
