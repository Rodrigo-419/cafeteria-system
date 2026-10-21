// Consultas del horario propio del empleado autenticado.
import { useQuery } from '@tanstack/react-query'
import { obtenerMiHorario } from '@/lib/api/my-schedule'
import { useAuth } from '@/lib/auth/useAuth'
import type { FiltrosMiHorario } from '@/types/api'

const claves = {
  miHorario: (filtros: FiltrosMiHorario) =>
    ['mi-horario', filtros] as const,
};

/**
 * Horario del empleado vinculado al usuario autenticado.
 *
 * Solo se dispara cuando el usuario tiene sucursal (Gerente/Empleado): el
 * Admin no ve la entrada del menú ni la ruta, así que no se llama nunca sin
 * sucursal.
 */
export function useMiHorario(filtros: FiltrosMiHorario) {
  const { usuario } = useAuth()
  const tieneSucursal = usuario?.sucursalId != null;

  return useQuery({
    queryKey: claves.miHorario(filtros),
    queryFn: () => obtenerMiHorario(filtros),
    enabled: tieneSucursal,
  })
}
