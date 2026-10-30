// Descarga de exportaciones contra el backend.
//
// Una sola ruta por conjunto (`POST /api/exports`) y el libro completo
// (`POST /api/exports/full`). Ambas devuelven un binario; el nombre se toma de
// `Content-Disposition` y se usa uno de reserva si el servidor no lo envia.
//
// El libro completo no acepta filtros: el backend aplica su rango por defecto a
// los conjuntos de actividad. Por eso `exportarLibroCompleto` no envia cuerpo.
import { peticionArchivo } from './client'
import { diaDeNegocioLima } from '@/lib/format/dates'

export type FormatoExportacion = 'xlsx' | 'csv'

export interface FiltrosExportacion {
  /** Inicio del rango, dia de negocio en America/Lima ("AAAA-MM-DD"). */
  desde?: string
  /** Fin del rango, dia de negocio en America/Lima ("AAAA-MM-DD"). */
  hasta?: string
}

export interface SolicitudExportacion {
  conjunto: string
  formato: FormatoExportacion
  filtros?: FiltrosExportacion
}

export interface ArchivoExportado {
  blob: Blob
  nombreArchivo: string
}

/** `POST /api/exports`: genera un conjunto y devuelve el archivo. */
export async function exportarConjunto(
  solicitud: SolicitudExportacion,
  signal?: AbortSignal,
): Promise<ArchivoExportado> {
  const respuesta = await peticionArchivo('/exports', {
    method: 'POST',
    body: solicitud,
    signal,
  })

  return {
    blob: respuesta.blob,
    nombreArchivo:
      respuesta.nombreArchivo ??
      `${solicitud.conjunto}-${diaDeNegocioLima(new Date())}.${solicitud.formato}`,
  }
}

/** `POST /api/exports/full`: libro Excel completo, sin filtros. */
export async function exportarLibroCompleto(
  signal?: AbortSignal,
): Promise<ArchivoExportado> {
  const respuesta = await peticionArchivo('/exports/full', {
    method: 'POST',
    signal,
  })

  return {
    blob: respuesta.blob,
    nombreArchivo:
      respuesta.nombreArchivo ??
      `libro-completo-${diaDeNegocioLima(new Date())}.xlsx`,
  }
}
