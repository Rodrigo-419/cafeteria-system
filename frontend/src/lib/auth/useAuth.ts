import { useContext } from 'react'
import { ContextoAutenticacion, type ValorAutenticacion } from './AuthContext'

/** Acceso al contexto de autenticacion. Falla si se usa fuera del proveedor. */
export function useAuth(): ValorAutenticacion {
  const valor = useContext(ContextoAutenticacion)
  if (valor === null) {
    throw new Error('useAuth debe usarse dentro de <ProveedorAutenticacion>')
  }
  return valor
}
