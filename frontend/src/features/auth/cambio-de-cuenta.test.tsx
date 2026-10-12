// Pruebas del cambio de cuenta: al cerrar sesión manualmente no debe quedar
// rastro de la cuenta anterior (ni ruta de retorno ni datos en caché), y la
// ruta de retorno solo se conserva cuando la sesión expiró (401).
import { QueryClient } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { App } from '@/App'
import { iniciarSesionDePrueba } from '@/test/render'
import {
  BASE_API,
  CREDENCIALES_VALIDAS,
  PERMISOS_ADMIN,
  usuarioDePrueba,
} from '@/test/handlers'
import { server } from '@/test/server'

const ADMIN_A = usuarioDePrueba(PERMISOS_ADMIN, {
  id: 'admin-a',
  nombre: 'Admin A',
  nombreUsuario: 'admina',
  rol: 'Admin',
  sucursalId: null,
})

const ADMIN_B = usuarioDePrueba(PERMISOS_ADMIN, {
  id: 'admin-b',
  nombre: 'Admin B',
  nombreUsuario: 'adminb',
  rol: 'Admin',
  sucursalId: null,
})

function responderLogin(usuario: typeof ADMIN_A) {
  server.use(
    http.post(`${BASE_API}/auth/login`, () =>
      HttpResponse.json({
        accessToken: 'token-de-pruebas',
        tokenType: 'Bearer',
        expiresIn: 28800,
        user: usuario,
      }),
    ),
  )
}

function responderPerfilExpirado() {
  server.use(
    http.get(`${BASE_API}/auth/me`, () =>
      HttpResponse.json(
        { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' },
        { status: 401 },
      ),
    ),
  )
}

function clienteDePrueba() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

async function iniciarSesionEnElFormulario() {
  const user = userEvent.setup()
  await user.type(
    screen.getByLabelText(/usuario/i),
    CREDENCIALES_VALIDAS.nombreUsuario,
  )
  await user.type(
    screen.getByLabelText(/contraseña/i, { selector: 'input' }),
    CREDENCIALES_VALIDAS.password,
  )
  await user.click(screen.getByRole('button', { name: /ingresar/i }))
}

async function abrirMenuDeCuenta(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Admin A/ }))
  await user.click(await screen.findByText('Cerrar sesión'))
}

const ESTADO_HISTORIAL = () =>
  window.history.state as { usr?: { from?: string } } | null

describe('cambio de cuenta', () => {
  it('tras cerrar sesión manualmente, la siguiente cuenta aterriza en la ruta de inicio', async () => {
    iniciarSesionDePrueba(ADMIN_A)
    window.history.pushState({}, '', '/equipment')
    render(<App />)

    await screen.findByRole('heading', { name: 'Equipos' })

    const user = userEvent.setup()
    await abrirMenuDeCuenta(user)
    await screen.findByRole('button', { name: /ingresar/i })

    // La salida manual no debe dejar `from` en el historial.
    expect(ESTADO_HISTORIAL()?.usr?.from).toBeUndefined()

    responderLogin(ADMIN_B)
    await iniciarSesionEnElFormulario()

    // Aunque la segunda cuenta también tiene `equipo.ver`, debe caer en el
    // panel de inicio y no volver a la pantalla anterior.
    expect(await screen.findByText(/Hola, Admin B/)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('vacía el caché al cerrar sesión y al iniciar con otra cuenta', async () => {
    const queryClient = clienteDePrueba()
    iniciarSesionDePrueba(ADMIN_A)
    window.history.pushState({}, '', '/equipment')
    render(<App queryClient={queryClient} />)

    await screen.findByRole('heading', { name: 'Equipos' })
    await waitFor(() =>
      expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0),
    )

    const clearSpy = vi.spyOn(queryClient, 'clear')
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries')

    const user = userEvent.setup()
    await abrirMenuDeCuenta(user)
    await screen.findByRole('button', { name: /ingresar/i })

    expect(cancelSpy).toHaveBeenCalled()
    expect(clearSpy).toHaveBeenCalled()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)

    const limpiezasTrasLogout = clearSpy.mock.calls.length
    responderLogin(ADMIN_B)
    await iniciarSesionEnElFormulario()
    await screen.findByText(/Hola, Admin B/)

    // El login vuelve a vaciar el caché antes de navegar (defensa en profundidad).
    expect(clearSpy.mock.calls.length).toBeGreaterThan(limpiezasTrasLogout)
  })

  it('la expiración por 401 conserva la ruta pedida si hay permiso', async () => {
    const conProductos = usuarioDePrueba(['productos.ver', 'ventas.ver'], {
      nombre: 'Con Productos',
      rol: 'Gerente',
      sucursalId: 'sucursal-1',
    })
    iniciarSesionDePrueba(conProductos)
    responderPerfilExpirado()
    window.history.pushState({}, '', '/products')
    render(<App />)

    expect(await screen.findByText(/Sesión expirada/)).toBeInTheDocument()

    responderLogin(conProductos)
    await iniciarSesionEnElFormulario()

    await waitFor(() => expect(window.location.pathname).toBe('/products'))
  })

  it('la expiración por 401 no conserva una ruta sin permiso', async () => {
    const sinProductos = usuarioDePrueba(['ventas.ver'], {
      nombre: 'Sin Productos',
      rol: 'Empleado',
      sucursalId: 'sucursal-1',
    })
    iniciarSesionDePrueba(sinProductos)
    responderPerfilExpirado()
    window.history.pushState({}, '', '/products')
    render(<App />)

    expect(await screen.findByText(/Sesión expirada/)).toBeInTheDocument()

    responderLogin(sinProductos)
    await iniciarSesionEnElFormulario()

    await waitFor(() => expect(window.location.pathname).toBe('/'))
  })
})
