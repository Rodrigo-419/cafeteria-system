// Resumen legible del `detalle` de un evento de auditoría.
//
// El backend guarda `{ antes?, despues? }` con una clave por campo y lo
// sanitiza antes de persistirlo (nunca contraseñas ni PIN). Aquí se muestra
// "Campo: antes → después" con etiquetas en español y valores formateados; el
// JSON crudo y los identificadores técnicos no llegan a la pantalla.
import { ETIQUETA_SIN_VALOR, resumenDetalle } from '@/lib/auditoria/etiquetas'
import type { DetalleAuditoriaApi } from '@/types/api'

interface DetalleResumenProps {
  detalle: DetalleAuditoriaApi | null | undefined
}

export function DetalleResumen({ detalle }: DetalleResumenProps) {
  const filas = resumenDetalle(detalle)

  if (filas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este evento no registra un detalle de cambios.
      </p>
    )
  }

  return (
    <dl className="space-y-2">
      {filas.map((fila) => (
        <div
          key={fila.campo}
          className="flex flex-col gap-1 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <dt className="text-sm font-medium">{fila.etiqueta}</dt>
          <dd className="flex flex-wrap items-center gap-2 text-sm">
            {fila.antes !== null && (
              <span className="text-muted-foreground">{fila.antes}</span>
            )}
            {fila.antes !== null && fila.despues !== null && (
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
            )}
            {fila.despues !== null ? (
              <span className="font-medium">{fila.despues}</span>
            ) : fila.antes === null ? (
              <span className="text-muted-foreground">{ETIQUETA_SIN_VALOR}</span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}
