import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ProveedorAutenticacion } from '@/lib/auth/AuthContext'
import { crearSesion, guardarSesion } from '@/lib/auth/session'
import type { UsuarioApi } from '@/types/api'
import { BASE_API } from './handlers'
import { server } from './server'

/** Envuelve un componente con QueryClient, Router y proveedor de sesion. */
export function renderConProveedores(
  ui: ReactElement,
  { ruta = '/' }: { ruta?: string } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  function Envoltura({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[ruta]}>
          <ProveedorAutenticacion>{children}</ProveedorAutenticacion>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  return { queryClient, ...render(ui, { wrapper: Envoltura }) }
}

/**
 * Deja una sesion activa en `sessionStorage` y hace que `GET /auth/me`
 * devuelva ese mismo usuario, para que el refresco de arranque no altere los
 * permisos de la prueba.
 */
export function iniciarSesionDePrueba(
  usuario: UsuarioApi,
  token = 'token-de-pruebas',
): void {
  guardarSesion(crearSesion(token, usuario, 3600))
  server.use(http.get(`${BASE_API}/auth/me`, () => HttpResponse.json(usuario)))
}
