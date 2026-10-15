import { StatusPill } from '@/components/shared/StatusPill'
import { ETIQUETA_ESTADO_EMPLEADO, TONO_ESTADO_EMPLEADO } from './presentacion'
import type { EstadoEmpleado } from '@/types/api'

/** Estado de un empleado: color + etiqueta según el estado real. */
export function EstadoEmpleadoBadge({ estado }: { estado: EstadoEmpleado }) {
  return (
    <StatusPill tono={TONO_ESTADO_EMPLEADO[estado]}>
      {ETIQUETA_ESTADO_EMPLEADO[estado]}
    </StatusPill>
  )
}
