import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UsuarioApi } from '@/types/api'
import { ProveedorAutenticacion } from './AuthContext'
import { crearSesion, guardarSesion } from './session'
import { useAuth } from './useAuth'

const { obtenerPerfilMock, iniciarSesionMock } = vi.hoisted(() => ({
  obtenerPerfilMock: vi.fn(),
  iniciarSesionMock: vi.fn(),
}))

vi.mock('@/lib/api/auth', () => ({
  obtenerPerfil: obtenerPerfilMock,
  iniciarSesion: iniciarSesionMock,
}))

const usuario: UsuarioApi = {
  id: 'u-1',
  nombre: 'Ada',
  nombreUsuario: 'ada',
  rol: 'Gerente',
  sucursalId: null,
  permisos: ['ventas.ver'],
}

function Consumidor() {
  const { autenticado, cargando } = useAuth()
  if (cargando) {
    return <span>cargando</span>
  }
  return <span>{autenticado ? 'activo' : 'fuera'}</span>
}

function renderProveedor() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ProveedorAutenticacion>
        <Consumidor />
      </ProveedorAutenticacion>
    </QueryClientProvider>,
  )
}

describe('ProveedorAutenticacion', () => {
  beforeEach(() => {
    obtenerPerfilMock.mockReset()
    iniciarSesionMock.mockReset()
  })

  it('refresca los permisos al arrancar y termina la carga', async () => {
    obtenerPerfilMock.mockResolvedValueOnce(usuario)
    guardarSesion(crearSesion('token', usuario, 3600))

    renderProveedor()

    expect(screen.getByText('cargando')).toBeInTheDocument()
    expect(await screen.findByText('activo')).toBeInTheDocument()
    expect(obtenerPerfilMock).toHaveBeenCalledTimes(1)
  })

  it('cancela la validacion de /auth/me al desmontar (nada de setState tras desmontar)', async () => {
    let resolver: (valor: UsuarioApi) => void = () => {}
    const pendiente = new Promise<UsuarioApi>((resolve) => {
      resolver = resolve
    })
    obtenerPerfilMock.mockReturnValueOnce(pendiente)
    guardarSesion(crearSesion('token', usuario, 3600))

    const { unmount } = renderProveedor()
    await waitFor(() => expect(obtenerPerfilMock).toHaveBeenCalledTimes(1))

    const signal = obtenerPerfilMock.mock.calls[0][0] as AbortSignal
    expect(signal.aborted).toBe(false)

    unmount()

    // La peticion en vuelo se aborta al desmontar...
    expect(signal.aborted).toBe(true)

    // ...y una respuesta tardia no provoca actualizacion de estado ni error.
    resolver(usuario)
    await pendiente
  })
})
