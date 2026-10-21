import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fijarConfiguracionArranqueEnFrio,
  MENSAJE_ARRANQUE_EN_FRIO,
  restaurarConfiguracionArranqueEnFrio,
} from '@/lib/api/arranque-en-frio'
import { ApiError } from '@/lib/api/errors'
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

  afterEach(() => {
    restaurarConfiguracionArranqueEnFrio()
    vi.restoreAllMocks()
  })

  it('refresca los permisos al arrancar y termina la carga', async () => {
    obtenerPerfilMock.mockResolvedValueOnce(usuario)
    guardarSesion(crearSesion('token', usuario, 3600))

    renderProveedor()

    expect(screen.getByText('cargando')).toBeInTheDocument()
    expect(await screen.findByText('activo')).toBeInTheDocument()
    expect(obtenerPerfilMock).toHaveBeenCalledTimes(1)
  })

  it('reintenta el refresco de sesion y avisa si el servidor despierta', async () => {
    fijarConfiguracionArranqueEnFrio({
      esperaInicialMs: 5,
      tiempoMaximoMs: 40,
      retrasoBaseMs: 5,
      retrasoMaximoMs: 5,
    })
    const info = vi.spyOn(toast, 'info').mockImplementation(() => 'aviso')
    obtenerPerfilMock
      .mockRejectedValueOnce(new ApiError(503, ['despertando']))
      .mockResolvedValueOnce(usuario)
    guardarSesion(crearSesion('token', usuario, 3600))

    renderProveedor()

    expect(await screen.findByText('activo')).toBeInTheDocument()
    expect(obtenerPerfilMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(info).toHaveBeenCalledWith(MENSAJE_ARRANQUE_EN_FRIO)
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
