import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '@/App'
import {
  fijarConfiguracionArranqueEnFrio,
  MENSAJE_ARRANQUE_EN_FRIO,
  restaurarConfiguracionArranqueEnFrio,
} from '@/lib/api/arranque-en-frio'
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

async function completarYEnviar(nombreUsuario: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/usuario/i), nombreUsuario)
  await user.type(
    screen.getByLabelText(/contraseña/i, { selector: 'input' }),
    password,
  )
  await user.click(screen.getByRole('button', { name: /ingresar/i }))
}

// Acorta los tiempos del arranque en frio para no esperar minutos en las
// pruebas que lo ejercitan. El resto usa la configuracion por defecto (4 s).
function fijarTiemposCortos() {
  fijarConfiguracionArranqueEnFrio({
    esperaInicialMs: 5,
    tiempoMaximoMs: 40,
    retrasoBaseMs: 5,
    retrasoMaximoMs: 5,
  })
}

describe('LoginPage', () => {
  afterEach(() => {
    restaurarConfiguracionArranqueEnFrio()
  })

  it('inicia sesión y navega al panel con credenciales válidas', async () => {
    abrirLogin()

    await completarYEnviar(
      CREDENCIALES_VALIDAS.nombreUsuario,
      CREDENCIALES_VALIDAS.password,
    )

    expect(await screen.findByText(/Hola, Ada Pruebas/)).toBeInTheDocument()
    expect(sessionStorage.getItem('cafeteria.sesion')).not.toBeNull()
  })

  it('muestra el error de credenciales ante un 401', async () => {
    abrirLogin()

    await completarYEnviar('nadie', 'incorrecta')

    expect(
      await screen.findByText(/Usuario o contraseña incorrectos/),
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

    await completarYEnviar('bloqueado', 'loquesea12345')

    expect(
      await screen.findByText(/Tu cuenta está bloqueada/),
    ).toBeInTheDocument()
  })

  it('muestra el mensaje del servidor con los segundos de espera ante un 429', async () => {
    server.use(
      http.post(`${BASE_API}/auth/login`, () =>
        HttpResponse.json(
          {
            statusCode: 429,
            message:
              'Demasiados intentos. Espera 42 segundos e inténtalo de nuevo.',
            error: 'Too Many Requests',
          },
          { status: 429 },
        ),
      ),
    )
    abrirLogin()

    await completarYEnviar(
      CREDENCIALES_VALIDAS.nombreUsuario,
      CREDENCIALES_VALIDAS.password,
    )

    expect(
      await screen.findByText(
        /Demasiados intentos\. Espera 42 segundos e inténtalo de nuevo\./,
      ),
    ).toBeInTheDocument()
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
      CREDENCIALES_VALIDAS.nombreUsuario,
      CREDENCIALES_VALIDAS.password,
    )

    expect(
      screen.getByRole('button', { name: /ingresando/i }),
    ).toBeDisabled()

    expect(await screen.findByText(/Hola, Ada Pruebas/)).toBeInTheDocument();
  });

  it('muestra el aviso de servidor despertando y reintenta ante un 503', async () => {
    fijarTiemposCortos()
    server.use(
      http.post(`${BASE_API}/auth/login`, () =>
        new HttpResponse(null, { status: 503 }),
      ),
    )
    abrirLogin()

    await completarYEnviar(
      CREDENCIALES_VALIDAS.nombreUsuario,
      CREDENCIALES_VALIDAS.password,
    )

    expect(
      (await screen.findAllByText(MENSAJE_ARRANQUE_EN_FRIO, undefined, {
        timeout: 5000,
      })).length,
    ).toBeGreaterThan(0)
  });

  it('muestra el aviso ante un fallo de red', async () => {
    fijarTiemposCortos()
    server.use(http.post(`${BASE_API}/auth/login`, () => HttpResponse.error()))
    abrirLogin()

    await completarYEnviar(
      CREDENCIALES_VALIDAS.nombreUsuario,
      CREDENCIALES_VALIDAS.password,
    )

    expect(
      (await screen.findAllByText(MENSAJE_ARRANQUE_EN_FRIO, undefined, {
        timeout: 5000,
      })).length,
    ).toBeGreaterThan(0)
  });

  it('reintenta y entra cuando el servidor responde despues del 503', async () => {
    fijarTiemposCortos()
    let intentos = 0
    server.use(
      http.post(`${BASE_API}/auth/login`, () => {
        intentos += 1
        if (intentos === 1) {
          return new HttpResponse(null, { status: 503 })
        }
        return HttpResponse.json(RESPUESTA_LOGIN_PRUEBA)
      }),
    )
    abrirLogin()

    await completarYEnviar(
      CREDENCIALES_VALIDAS.nombreUsuario,
      CREDENCIALES_VALIDAS.password,
    )

    expect(intentos).toBeGreaterThan(1)
    expect(await screen.findByText(/Hola, Ada Pruebas/)).toBeInTheDocument();
  });
})
