// Componente de renderizado condicional por permisos.
//
// Uso:
//   <Can permiso="ventas.ver"><Ventas /></Can>
//   <Can permiso={['usuarios.crear_editar', 'permisos.asignar']} modo="any">…</Can>
import type { ReactNode } from 'react'
import { useAuth } from '@/lib/auth/useAuth'
import { tieneAlguno, tieneTodos, type CodigoPermiso } from './permissions'

interface PropsCan {
  permiso: CodigoPermiso | readonly CodigoPermiso[]
  /** `all` (por defecto) exige todos; `any` basta con uno. */
  modo?: 'all' | 'any'
  fallback?: ReactNode
  children: ReactNode
}

export function Can({
  permiso,
  modo = 'all',
  fallback = null,
  children,
}: PropsCan) {
  const { permisos } = useAuth()
  const requeridos = Array.isArray(permiso) ? permiso : [permiso]
  const permitido =
    modo === 'any'
      ? tieneAlguno(permisos, requeridos)
      : tieneTodos(permisos, requeridos)

  return <>{permitido ? children : fallback}</>
}
