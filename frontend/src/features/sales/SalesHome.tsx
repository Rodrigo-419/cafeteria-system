import { Forbidden } from '@/routes/Forbidden'
import { useAuth } from '@/lib/auth/useAuth'
import { tienePermiso } from '@/lib/permissions/permissions'
import { NewSalePage } from './NewSalePage'
import { SalesListPage } from './SalesListPage'

/**
 * Punto de entrada de `/sales`.
 *
 * Un Empleado con solo `ventas.registrar` no puede listar ventas (la ruta
 * `GET /sales` exige `ventas.ver`), así que se le muestra directamente la
 * pantalla de nueva venta sin llegar a montar el listado.
 */
export function SalesHome() {
  const { permisos } = useAuth()

  if (tienePermiso(permisos, 'ventas.ver')) {
    return <SalesListPage />
  }
  if (tienePermiso(permisos, 'ventas.registrar')) {
    return <NewSalePage />
  }
  return <Forbidden />
}
