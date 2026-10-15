import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { MarcacionPage } from './MarcacionPage'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import {
  BASE_API,
  PERMISOS_ADMIN,
  PERMISOS_GERENTE,
  PIN_TERMINAL_VALIDO,
  usuarioDePrueba,
} from '@/test/handlers'
import { server } from '@/test/server'

function renderComoGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  return renderConProveedores(<MarcacionPage />)
}

async function seleccionarEmpleado(user: ReturnType<typeof userEvent.setup>, nombre: string) {
  await user.click(await screen.findByRole('button', { name: nombre }))
}

async function teclearPin(
  user: ReturnType<typeof userEvent.setup>,
  pin: string,
) {
  for (const digito of pin) {
    await user.click(screen.getByRole('button', { name: digito }))
  }
}

const botonEnviar = () =>
  screen.getByRole('button', { name: /Registrar entrada/i })

describe('Terminal de marcación de asistencia', () => {
  it('muestra los colaboradores de la sucursal y marca la entrada con el PIN correcto', async () => {
    const user = userEvent.setup()
    renderComoGerente()

    expect(await screen.findByText('Beto Turno')).toBeInTheDocument()
    expect(screen.getByText('Dora Nueva')).toBeInTheDocument()
    expect(screen.queryByText('Ciro Ruiz')).not.toBeInTheDocument()

    await seleccionarEmpleado(user, 'Beto Turno')
    await teclearPin(user, PIN_TERMINAL_VALIDO)
    await user.click(botonEnviar())

    expect(await screen.findByText('Beto Turno')).toBeInTheDocument()
    expect(screen.getByText('Entrada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Listo' })).toBeInTheDocument()
  })

  it('mantiene deshabilitado el envío hasta completar los seis dígitos', async () => {
    const user = userEvent.setup()
    renderComoGerente()
    await seleccionarEmpleado(user, 'Beto Turno')

    expect(botonEnviar()).toBeDisabled()
    await teclearPin(user, '12345')
    expect(botonEnviar()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '6' }))
    expect(botonEnviar()).toBeEnabled()
  })

  it('muestra el error del servidor, limpia el PIN y no lo persiste si es incorrecto', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderComoGerente()
    await seleccionarEmpleado(user, 'Beto Turno')
    await teclearPin(user, '000000')
    await user.click(botonEnviar())

    expect(await screen.findByText('PIN incorrecto')).toBeInTheDocument()
    // El PIN se borra del campo: no queda listo para reintentar solo.
    expect(screen.getByLabelText('PIN: 0 de 6 dígitos')).toBeInTheDocument()
    expect(botonEnviar()).toBeDisabled()

    // El PIN nunca queda en la caché de consultas, el almacenamiento ni la URL.
    const enCache = JSON.stringify(
      queryClient
        .getQueryCache()
        .getAll()
        .map((consulta) => consulta.state.data),
    )
    const enAlmacenamiento = `${JSON.stringify(sessionStorage)}${JSON.stringify(localStorage)}`
    expect(
      `${enCache}${enAlmacenamiento}${window.location.href}`,
    ).not.toContain('000000')
  })

  it('bloquea con 429 tras cinco intentos fallidos, incluso con el PIN correcto', async () => {
    const user = userEvent.setup()
    renderComoGerente()
    await seleccionarEmpleado(user, 'Beto Turno')

    for (let intento = 0; intento < 5; intento += 1) {
      await teclearPin(user, '000000')
      await user.click(botonEnviar())
      await screen.findByText('PIN incorrecto')
    }

    await teclearPin(user, PIN_TERMINAL_VALIDO)
    await user.click(botonEnviar())

    expect(
      await screen.findByText(/Demasiados intentos de PIN/i),
    ).toBeInTheDocument()
    // Tras el 429 el envío queda bloqueado (el PIN se limpia y no se reintenta).
    expect(botonEnviar()).toBeDisabled()
  })

  it('no permite abrir una segunda entrada el mismo día', async () => {
    const user = userEvent.setup()
    renderComoGerente()
    await seleccionarEmpleado(user, 'Dora Nueva')
    await teclearPin(user, PIN_TERMINAL_VALIDO)
    await user.click(botonEnviar())

    expect(
      await screen.findByText('Ya hay una entrada abierta de hoy'),
    ).toBeInTheDocument()
  })

  it('avisa cuando la cuenta no tiene sucursal asignada y nunca muestra el terminal', async () => {
    iniciarSesionDePrueba(
      usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
    )
    renderConProveedores(<MarcacionPage />)

    expect(
      await screen.findByText(/no tiene una sucursal asignada/i),
    ).toBeInTheDocument()
    expect(screen.getByText('El terminal no está disponible')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/buscar/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Beto Turno')).not.toBeInTheDocument()
  })

  it('deshabilita el envío mientras la marcación está en vuelo', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${BASE_API}/attendance/mark`, () => new Promise(() => {})),
    )
    renderComoGerente()
    await seleccionarEmpleado(user, 'Beto Turno')
    await teclearPin(user, PIN_TERMINAL_VALIDO)

    const enviar = botonEnviar()
    await user.click(enviar)

    await waitFor(() => expect(enviar).toBeDisabled())
  })

  it('un doble clic no envía la marcación dos veces', async () => {
    let envios = 0
    server.use(
      http.post(`${BASE_API}/attendance/mark`, () => {
        envios += 1
        return new Promise(() => {})
      }),
    )
    const user = userEvent.setup()
    renderComoGerente()
    await seleccionarEmpleado(user, 'Beto Turno')
    await teclearPin(user, PIN_TERMINAL_VALIDO)

    const enviar = botonEnviar()
    await user.click(enviar)
    await user.click(enviar)

    await waitFor(() => expect(enviar).toBeDisabled())
    expect(envios).toBe(1)
  })

  it('admite el teclado físico para teclear el PIN y enviar', async () => {
    const user = userEvent.setup()
    renderComoGerente()
    await seleccionarEmpleado(user, 'Beto Turno')

    await user.keyboard(PIN_TERMINAL_VALIDO)
    await user.keyboard('{Enter}')

    expect(await screen.findByText('Beto Turno')).toBeInTheDocument()
    expect(screen.getByText('Entrada')).toBeInTheDocument()
  })
})
