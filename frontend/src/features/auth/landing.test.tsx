// Pruebas de regresión del aterrizaje por permisos: ningún usuario autenticado
// debe terminar en una pantalla denegada. La ruta de inicio se deriva de los
// PERMISOS EFECTIVOS (nunca del rol) y el panel nunca queda vacío.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { App } from '@/App'
import { puedeAccederRuta, rutaInicio } from '@/lib/navigation/menu'
import {
  BASE_API,
  CREDENCIALES_VALIDAS,
  PERMISOS_EMPLEADO,
  usuarioDePrueba,
} from '@/test/handlers'
import { server } from '@/test/server'

const EMPLEADO = usuarioDePrueba(PERMISOS_EMPLEADO, {
  nombre: 'Empleado Tres',
  rol: 'Empleado',
})

function responderLogin(usuario: typeof EMPLEADO) {
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

function abrirLoginConDestino(from: string) {
  window.history.pushState({ from }, '', '/login')
  render(<App />)
}

async function completarLogin() {
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

describe('ruta de inicio por permisos efectivos', () => {
  it('respeta la ruta pedida si el usuario puede verla', () => {
    expect(rutaInicio(PERMISOS_EMPLEADO, '/products')).toBe('/products')
  })

  it('cae al panel si el usuario no puede ver la ruta pedida', () => {
    expect(rutaInicio(PERMISOS_EMPLEADO, '/alerts')).toBe('/')
    expect(rutaInicio(PERMISOS_EMPLEADO, '/reports')).toBe('/')
  })

  it('trata el panel y una ruta desconocida según corresponda', () => {
    expect(puedeAccederRuta(PERMISOS_EMPLEADO, '/')).toBe(true)
    expect(puedeAccederRuta(PERMISOS_EMPLEADO, '/ruta-inexistente')).toBe(false)
  })
})

describe('aterrizaje tras iniciar sesión', () => {
  it('un Empleado no aterriza en una sección denegada', async () => {
    responderLogin(EMPLEADO)
    abrirLoginConDestino('/alerts')

    await completarLogin()

    expect(
      await screen.findByText(/Hola, Empleado Tres/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Acceso denegado')).not.toBeInTheDocument()
    expect(screen.getByText('Accesos disponibles')).toBeInTheDocument()
  })

  it('un Empleado sin módulos ve el aviso de que no tiene acceso', async () => {
    const SIN_MODULOS = usuarioDePrueba([], {
      nombre: 'Sin Accesos',
      rol: 'Empleado',
    })
    responderLogin(SIN_MODULOS)
    abrirLoginConDestino('/')

    await completarLogin()

    expect(
      await screen.findByText('No tienes módulos asignados'),
    ).toBeInTheDocument()
  })
})
