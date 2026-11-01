import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { StrictMode, type ReactElement, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ProveedorAutenticacion } from '@/lib/auth/AuthContext'
import { crearSesion, guardarSesion } from '@/lib/auth/session'
import type { UsuarioApi } from '@/types/api'
import {
  BASE_API,
  establecerActorAsistencia,
  establecerActorEmpleados,
  establecerActorEquipos,
  establecerActorSucursales,
  establecerActorTurnos,
  establecerActorUsuarios,
} from './handlers'
import { server } from './server'

/**
 * Envuelve un componente con QueryClient, Router y proveedor de sesion.
 *
 * `estricto` monta todo el arbol dentro de `StrictMode` como lo hace
 * `main.tsx`. No es lo mismo pasar `<StrictMode>` en `ui`: React solo duplica
 * los efectos cuando `StrictMode` esta por fuera de los proveedores, y las
 * pruebas de esta pantalla necesitan reproducir ese ciclo real.
 */
export function renderConProveedores(
  ui: ReactElement,
  { ruta = '/', estricto = false }: { ruta?: string; estricto?: boolean } = {},
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

  const arbol = <Envoltura>{ui}</Envoltura>

  return {
    queryClient,
    ...render(estricto ? <StrictMode>{arbol}</StrictMode> : arbol),
  }
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
  // Los alcances de los mocks dependen del actor con sesión.
  establecerActorAsistencia(usuario)
  establecerActorEquipos(usuario)
  establecerActorEmpleados(usuario)
  establecerActorTurnos(usuario)
  establecerActorUsuarios(usuario)
  establecerActorSucursales(usuario)
}
