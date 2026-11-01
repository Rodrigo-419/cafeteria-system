// Pantalla de exportaciones.
//
// Descarga los conjuntos que el usuario puede leer, en Excel o CSV, y el libro
// completo en Excel. El catálogo y los permisos viven en `catalogo.ts`; el
// backend sigue siendo la autoridad final.
//
// El rango de fechas solo se aplica a los conjuntos de actividad. El libro
// completo no admite filtros en el contrato actual: los conjuntos de actividad
// usan el rango por defecto del servidor y la pantalla lo advierte.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangleIcon,
  CalendarRangeIcon,
  DownloadIcon,
  FilesIcon,
  InfoIcon,
  LoaderCircleIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth/useAuth'
import { diaDeNegocioLima, formatearDiaLocal } from '@/lib/format/dates'
import type { FormatoExportacion } from '@/lib/api/exports'
import {
  CONJUNTOS_EXPORTACION,
  conjuntosVisibles,
  definicionDeConjunto,
  type ClaveConjuntoExport,
  type DefinicionConjuntoExport,
} from './catalogo'
import { ListaConjuntos } from './ListaConjuntos'
import {
  MAXIMO_DIAS_RANGO_EXPORTACION,
  validarRangoExportacion,
  type CampoRango,
} from './presentacion'
import { useExportacion } from './useExportacion'

const CONJUNTOS_CON_RANGO = CONJUNTOS_EXPORTACION.filter(
  (definicion) => definicion.exigeRango,
)
  .map((definicion) => definicion.etiqueta)
  .join(', ')

export function ExportacionesPage() {
  const { permisos } = useAuth()
  const visibles = useMemo(() => conjuntosVisibles(permisos), [permisos])

  const [parametros] = useSearchParams()
  const conjuntoParametro = parametros.get('conjunto')
  const preseleccionado = useMemo<ClaveConjuntoExport | null>(() => {
    const definicion = definicionDeConjunto(conjuntoParametro)
    if (
      !definicion ||
      !visibles.some((visible) => visible.clave === definicion.clave)
    ) {
      return null
    }
    return definicion.clave
  }, [conjuntoParametro, visibles])

  const [desde, setDesde] = useState(() => parametros.get('desde') ?? '')
  const [hasta, setHasta] = useState(() => parametros.get('hasta') ?? '')
  const [errorRangoManual, setErrorRangoManual] = useState<string | null>(null)
  const hoy = useMemo(() => diaDeNegocioLima(new Date()), [])

  const validacion =
    desde !== '' && hasta !== ''
      ? validarRangoExportacion(desde, hasta, hoy)
      : null
  const errorRango = errorRangoManual ?? validacion?.mensaje ?? null

  const tituloRef = useRef<HTMLHeadingElement>(null)
  const desdeRef = useRef<HTMLInputElement>(null)
  const hastaRef = useRef<HTMLInputElement>(null)
  const refPreseleccionado = useRef<HTMLButtonElement>(null)
  const estadoRef = useRef<HTMLParagraphElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const estabaGenerando = useRef(false)

  const {
    generando,
    nombreActual,
    anuncio,
    error,
    exportar,
    exportarLibro,
    cancelar,
  } = useExportacion()

  useEffect(() => {
    if (preseleccionado) {
      refPreseleccionado.current?.focus()
    } else {
      tituloRef.current?.focus()
    }
  }, [preseleccionado])

  useEffect(() => {
    const termino = estabaGenerando.current && !generando
    estabaGenerando.current = generando
    if (!termino) return

    if (error) {
      errorRef.current?.focus()
    } else if (anuncio) {
      estadoRef.current?.focus()
    }
  }, [generando, error, anuncio])

  const enfocarCampo = (campo: CampoRango) => {
    if (campo === 'desde') {
      desdeRef.current?.focus()
    } else {
      hastaRef.current?.focus()
    }
  }

  const alExportar = (
    definicion: DefinicionConjuntoExport,
    formato: FormatoExportacion,
  ) => {
    setErrorRangoManual(null)

    let filtros: { desde: string; hasta: string } | undefined
    if (definicion.exigeRango) {
      const fallo = validarRangoExportacion(desde, hasta, hoy)
      if (fallo) {
        setErrorRangoManual(fallo.mensaje)
        enfocarCampo(fallo.campo)
        return
      }
      filtros = { desde, hasta }
    }

    void exportar({
      conjunto: definicion.clave,
      formato,
      filtros,
      etiqueta: definicion.etiqueta,
    })
  }

  const alExportarLibro = () => {
    setErrorRangoManual(null)
    void exportarLibro()
  }

  const cambiarDesde = (valor: string) => {
    setDesde(valor)
    setErrorRangoManual(null)
  }

  const cambiarHasta = (valor: string) => {
    setHasta(valor)
    setErrorRangoManual(null)
  }

  const preseleccionadoDef = definicionDeConjunto(preseleccionado)
  const descripcionRango = errorRango
    ? 'rango-ayuda rango-error'
    : 'rango-ayuda'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exportaciones"
        description="Descarga los datos que puedes leer en Excel o CSV."
        titleRef={tituloRef}
        titleTabIndex={-1}
      />

      {preseleccionadoDef && (
        <Alert>
          <InfoIcon aria-hidden="true" />
          <AlertTitle>Conjunto preseleccionado</AlertTitle>
          <AlertDescription>
            {preseleccionadoDef.etiqueta} está listo para exportar. Revisa el
            rango de fechas si lo necesita.
          </AlertDescription>
        </Alert>
      )}

      <div aria-live="polite" aria-atomic="true">
        {generando ? (
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <LoaderCircleIcon
                  className="size-4 animate-spin text-primary"
                  aria-hidden="true"
                />
                <p
                  ref={estadoRef}
                  tabIndex={-1}
                  className="text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  Generando {nombreActual ?? 'el archivo'}…
                </p>
              </div>

              <div
                role="progressbar"
                aria-label="Progreso de la exportación"
                aria-valuetext={`Generando ${nombreActual ?? 'el archivo'}`}
              >
                <Skeleton className="h-1.5 w-full" />
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cancelar}
                aria-label="Cancelar exportación"
              >
                Cancelar
              </Button>
            </CardContent>
          </Card>
        ) : anuncio ? (
          <p
            ref={estadoRef}
            role="status"
            tabIndex={-1}
            className="text-sm text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {anuncio}
          </p>
        ) : null}
      </div>

      {error && (
        <Alert
          ref={errorRef}
          variant="destructive"
          tabIndex={-1}
          className="outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <AlertTriangleIcon aria-hidden="true" />
          <AlertTitle>No se pudo exportar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarRangeIcon
              className="size-5 text-primary"
              aria-hidden="true"
            />
            Rango de fechas
          </CardTitle>
          <CardDescription>
            Solo se aplica a los conjuntos de actividad. Los días se cuentan en
            la hora de Lima y el rango no puede superar{' '}
            {MAXIMO_DIAS_RANGO_EXPORTACION} días.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="exportacion-desde">Desde</Label>
              <Input
                id="exportacion-desde"
                ref={desdeRef}
                type="date"
                value={desde}
                max={hoy}
                disabled={generando}
                aria-invalid={errorRango ? true : undefined}
                aria-describedby={descripcionRango}
                onChange={(evento) => cambiarDesde(evento.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exportacion-hasta">Hasta</Label>
              <Input
                id="exportacion-hasta"
                ref={hastaRef}
                type="date"
                value={hasta}
                max={hoy}
                disabled={generando}
                aria-invalid={errorRango ? true : undefined}
                aria-describedby={descripcionRango}
                onChange={(evento) => cambiarHasta(evento.target.value)}
              />
            </div>
          </div>

          <p id="rango-ayuda" className="text-xs text-muted-foreground">
            Hoy es {formatearDiaLocal(hoy)}. Se aplica a: {CONJUNTOS_CON_RANGO}.
          </p>

          {errorRango && (
            <Alert variant="destructive" id="rango-error">
              <AlertTriangleIcon aria-hidden="true" />
              <AlertTitle>Rango no válido</AlertTitle>
              <AlertDescription>{errorRango}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {visibles.length > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FilesIcon className="size-5 text-primary" aria-hidden="true" />
              Libro completo
            </CardTitle>
            <CardDescription>
              Un solo archivo Excel con una hoja por conjunto y una hoja de
              Metadatos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Incluye solo los conjuntos que puedes leer.</p>
              <p>
                El libro completo no admite rango: los conjuntos de actividad
                usan el rango por defecto del servidor. Para un rango concreto,
                expórtalos por separado.
              </p>
            </div>
            <Button
              type="button"
              onClick={alExportarLibro}
              disabled={generando || visibles.length === 0}
              aria-label="Generar libro completo en Excel"
            >
              <DownloadIcon aria-hidden="true" />
              Descargar Excel
            </Button>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="titulo-conjuntos" className="space-y-3">
        <div className="space-y-1">
          <h2 id="titulo-conjuntos" className="text-lg font-semibold">
            Conjuntos
          </h2>
          <p className="text-sm text-muted-foreground">
            Elige Excel o CSV en cada conjunto que necesites.
          </p>
        </div>

        <div aria-busy={generando}>
          <ListaConjuntos
            conjuntos={visibles}
            generando={generando}
            preseleccionado={preseleccionado}
            onExportar={alExportar}
            refPreseleccionado={refPreseleccionado}
          />
        </div>
      </section>
    </div>
  )
}
