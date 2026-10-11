import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { App } from '@/App'
import {
  BASE_API,
  CREDENCIALES_VALIDAS,
  RESPUESTA_LOGIN_PRUEBA,
} from '@/test/handlers'
import { server } from '@/test/server'

function abrirLogin() {
  window.history.pushState({}, '', '/login')
  render(<App />)
}

async function completarYEnviar(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/correo electrónico/i), email)
  await user.type(screen.getByLabelText(/contraseña/i), password)
  await user.click(screen.getByRole('button', { name: /ingresar/i }))
}

describe('LoginPage', () => {
  it('inicia sesión y navega al panel con credenciales válidas', async () => {
    abrirLogin()

    await completarYEnviar(
      CREDENCIALES_VALIDAS.email,
      CREDENCIALES_VALIDAS.password,
    )

    expect(await screen.findByText(/Hola, Ada Pruebas/)).toBeInTheDocument()
    expect(sessionStorage.getItem('cafeteria.sesion')).not.toBeNull()
  })

  it('muestra el error de credenciales ante un 401', async () => {
    abrirLogin()

    await completarYEnviar('nadie@cafeteria.test', 'incorrecta')

    expect(
      await screen.findByText(/Correo electrónico o contraseña incorrectos/),
    ).toBeInTheDocument()
  })

  it('avisa de cuenta bloqueada ante un 403', async () => {
    server.use(
      http.post(`${BASE_API}/auth/login`, () =>
        HttpResponse.json(
          { statusCode: 403, message: 'Cuenta bloqueada', error: 'Forbidden' },
          { status: 403 },
        ),
      ),
    )
    abrirLogin()

    await completarYEnviar('bloqueado@cafeteria.test', 'loquesea12345')

    expect(
      await screen.findByText(/Tu cuenta está bloqueada/),
    ).toBeInTheDocument()
  })

  it('avisa de demasiados intentos ante un 429', async () => {
    server.use(
      http.post(`${BASE_API}/auth/login`, () =>
        HttpResponse.json(
          {
            statusCode: 429,
            message: 'ThrottlerException: Too Many Requests',
            error: 'Too Many Requests',
          },
          { status: 429 },
        ),
      ),
    )
    abrirLogin()

    await completarYEnviar(
      CREDENCIALES_VALIDAS.email,
      CREDENCIALES_VALIDAS.password,
    )

    expect(await screen.findByText(/Demasiados intentos/)).toBeInTheDocument()
  })

  it('deshabilita el botón mientras la petición está en curso', async () => {
    server.use(
      http.post(`${BASE_API}/auth/login`, async () => {
        await new Promise((resolver) => setTimeout(resolver, 100))
        return HttpResponse.json(RESPUESTA_LOGIN_PRUEBA)
      }),
    )
    abrirLogin()

    await completarYEnviar(
      CREDENCIALES_VALIDAS.email,
      CREDENCIALES_VALIDAS.password,
    )

    expect(screen.getByRole('button')).toBeDisabled()

    expect(await screen.findByText(/Hola, Ada Pruebas/)).toBeInTheDocument()
  })
})
