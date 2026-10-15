// Aritmética de semanas (lunes a domingo) para el calendario de turnos.
//
// Todo se calcula sobre días de negocio "AAAA-MM-DD" en UTC, igual que el
// backend: nunca se instancia un `Date` local para no depender de la zona del
// navegador. La semana empieza el lunes (día ISO 1).
import { DIAS_SEMANA } from './presentacion'

function aUtc(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(anio!, mes! - 1, dia!))
}

/** Día "AAAA-MM-DD" desplazado `dias` (puede ser negativo). */
export function sumarDias(iso: string, dias: number): string {
  const fecha = aUtc(iso)
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

/** Lunes de la semana que contiene `iso`. */
export function lunesDeSemana(iso: string): string {
  const diaUtc = aUtc(iso).getUTCDay() // 0 = domingo ... 6 = sábado
  const desdeLunes = (diaUtc + 6) % 7
  return sumarDias(iso, -desdeLunes)
}

export interface DiaDeSemana {
  /** Día "AAAA-MM-DD". */
  iso: string
  /** Número ISO: 1 = lunes ... 7 = domingo. */
  numero: number
  /** Etiqueta corta: "Lun", "Mar"... */
  corto: string
}

/** Los siete días (lunes a domingo) a partir del lunes indicado. */
export function diasDeSemana(lunes: string): DiaDeSemana[] {
  return DIAS_SEMANA.map((dia, indice) => ({
    iso: sumarDias(lunes, indice),
    numero: dia.numero,
    corto: dia.corto,
  }))
}
