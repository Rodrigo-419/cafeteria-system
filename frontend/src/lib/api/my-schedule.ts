// Llamada del horario propio del empleado autenticado.
import { peticionApi } from './client'
import { construirQueryString } from './query'
import type { FiltrosMiHorario, MiHorarioApi } from '@/types/api'

/**
 * `GET /api/my/schedule`. Exige autenticación (la misma que `/auth/me`) pero no
 * ningún permiso de la matriz: es una ruta personal. Sin registro de empleado
 * responde 404; el rango por defecto es la semana actual (lunes a domingo).
 */
export function obtenerMiHorario(
  filtros: FiltrosMiHorario = {},
): Promise<MiHorarioApi> {
  return peticionApi<MiHorarioApi>(
    `/my/schedule${construirQueryString(filtros)}`,
  )
}
