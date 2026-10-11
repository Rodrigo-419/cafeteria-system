import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { App } from '@/App'
import { crearSesion, guardarSesion } from '@/lib/auth/session'
import { BASE_API, USUARIO_PRUEBA } from '@/test/handlers'
import { iniciarSesionDePrueba } from '@/test/render'
import { server } from '@/test/server'

describe('protección de rutas', () => {
  it('redirige al login cuando no hay sesión', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(await screen.findByText(/Iniciar sesión/)).toBeInTheDocument()
  })

  it('limpia la sesión y avisa cuando /auth/me responde 401', async () => {
    iniciarSesionDePrueba(USUARIO_PRUEBA)
    server.use(
      http.get(`${BASE_API}/auth/me`, () =>
        HttpResponse.json(
          { statusCode: 401, message: 'Unauthorized', error: 'Unauthorized' },
          { status: 401 },
        ),
      ),
    )
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(await screen.findByText(/Sesión expirada/)).toBeInTheDocument()
    expect(sessionStorage.getItem('cafeteria.sesion')).toBeNull()
  })

  it('redirige al login cuando la sesión guardada ya venció', async () => {
    guardarSesion({
      ...crearSesion('tok', USUARIO_PRUEBA, 1),
      expiresAt: Date.now() - 1000,
    })
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(await screen.findByText(/Sesión expirada/)).toBeInTheDocument()
  })
})
