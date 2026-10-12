import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth/useAuth'

/** Envuelve las rutas privadas: exige sesion y espera a validarla. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { autenticado, cargando, motivoSalida } = useAuth()
  const location = useLocation()

  if (cargando) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    )
  }

  if (!autenticado) {
    // La ruta de retorno solo se conserva si la sesion termino por vencimiento
    // o por un 401; en una salida manual se entra al login sin destino.
    return (
      <Navigate
        to="/login"
        replace
        state={
          motivoSalida === 'expirada'
            ? { from: location.pathname }
            : undefined
        }
      />
    )
  }

  return <>{children}</>
}
