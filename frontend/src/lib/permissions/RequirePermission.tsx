import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth/useAuth'
import { tieneAlguno, tieneTodos, type CodigoPermiso } from './permissions'
import { Forbidden } from '@/routes/Forbidden'

type Modo = 'all' | 'any'

interface RequirePermissionProps {
  permiso: CodigoPermiso | readonly CodigoPermiso[]
  modo?: Modo
  children: ReactNode
  fallbackTo?: string
}

export function RequirePermission({
  permiso,
  modo = 'all',
  children,
  fallbackTo,
}: RequirePermissionProps) {
  const { permisos, autenticado, motivoSalida } = useAuth()
  const location = useLocation()

  if (!autenticado) {
    // Igual que en `ProtectedRoute`: la ruta de retorno solo se conserva si la
    // sesion termino por vencimiento o por un 401, nunca en salida manual.
    return (
      <Navigate
        to="/login"
        state={
          motivoSalida === 'expirada'
            ? { from: location.pathname }
            : undefined
        }
        replace
      />
    )
  }

  const requerido = Array.isArray(permiso) ? permiso : [permiso]
  const permitido =
    modo === 'any'
      ? tieneAlguno(permisos, requerido)
      : tieneTodos(permisos, requerido)

  if (!permitido) {
    return fallbackTo ? <Navigate to={fallbackTo} replace /> : <Forbidden />
  }

  return <>{children}</>
}
