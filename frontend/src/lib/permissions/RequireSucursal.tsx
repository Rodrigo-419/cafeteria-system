// Guard de ruta para pantallas personales que exigen tener sucursal.
//
// No es un permiso de la matriz: es una condición de la cuenta. El Admin
// (sin sucursal) no accede a "Mi horario"; un Gerente o Empleado sí.
import type { ReactNode } from 'react'
import { Forbidden } from '@/routes/Forbidden'
import { useAuth } from '@/lib/auth/useAuth'

export function RequireSucursal({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()

  if (!usuario?.sucursalId) {
    return <Forbidden />
  }

  return <>{children}</>
}
