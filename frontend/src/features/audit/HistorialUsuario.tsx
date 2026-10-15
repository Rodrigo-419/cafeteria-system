// Historial de auditoría de un usuario, embebido en el diálogo de permisos.
//
// La ruta exige `usuarios.crear_editar` (el diálogo de permisos se abre con
// `permisos.asignar`), así que el llamador solo monta este panel si el actor
// tiene el permiso. El backend devuelve 404 cuando el usuario está fuera del
// alcance: se muestra un aviso neutro sin revelar nada más.
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatearFechaHora } from '@/lib/format/dates'
import { etiquetaAccion, etiquetaEntidad } from '@/lib/auditoria/etiquetas'
import { DetalleResumen } from './DetalleResumen'
import { SIN_HISTORIAL, esErrorNoEncontrado, mensajeDeError } from './mensajes'
import { useHistorialUsuario } from './queries'

const LIMITE = 10

interface HistorialUsuarioProps {
  usuarioId: string
}

export function HistorialUsuario({ usuarioId }: HistorialUsuarioProps) {
  const historial = useHistorialUsuario(usuarioId, { page: 1, limit: LIMITE })

  if (historial.isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (historial.error) {
    if (esErrorNoEncontrado(historial.error)) {
      return <p className="text-sm text-muted-foreground">{SIN_HISTORIAL}</p>
    }
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {mensajeDeError(historial.error, 'historial')}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void historial.refetch()}
        >
          Reintentar
        </Button>
      </div>
    )
  }

  const eventos = historial.data?.eventos ?? []

  if (eventos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay eventos registrados para este usuario.
      </p>
    )
  }

  return (
    <ol className="space-y-3">
      {eventos.map((evento) => (
        <li
          key={evento.id}
          className="space-y-2 rounded-lg border border-border p-3"
        >
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{etiquetaAccion(evento.accion)}</p>
            <p className="text-xs text-muted-foreground">
              {etiquetaEntidad(evento.entidad)} · {evento.actor.nombre} ·{' '}
              {formatearFechaHora(evento.fecha)}
            </p>
          </div>
          <DetalleResumen detalle={evento.detalle} />
        </li>
      ))}
    </ol>
  )
}
