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
  const { permisos, autenticado } = useAuth()
  const location = useLocation()

  if (!autenticado) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
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
