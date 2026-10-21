// Pruebas de la pantalla CalendarioHorasPage con MSW.
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { CalendarioHorasPage } from './CalendarioHorasPage'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import {
  BASE_API,
  PERMISOS_ADMIN,
  PERMISOS_GERENTE,
  usuarioDePrueba,
} from '@/test/handlers'
import { server } from '@/test/server'

function renderComoAdmin() {
  iniciarSesionDePrueba(
    usuarioDePrueba(PERMISOS_ADMIN, {
      id: 'admin-1',
      nombre: 'Administrador',
      nombreUsuario: 'admin',
      rol: 'Admin',
      sucursalId: null,
    }),
  )
  return renderConProveedores(<CalendarioHorasPage />)
}

function renderComoGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  return renderConProveedores(<CalendarioHorasPage />)
}

async function esperarBeto() {
  const encontrados = await screen.findAllByText('Beto Turno', undefined, {
    timeout: 5000,
  })
  expect(encontrados.length).toBeGreaterThan(0)
}

describe('CalendarioHorasPage', () => {
  it('pinta la rejilla de horas con los turnos fijos', async () => {
    renderComoAdmin()

    await esperarBeto()
    expect(screen.getAllByText('07:30 – 16:00').length).toBeGreaterThan(0)
  })

  it('marca el día actual', async () => {
    renderComoAdmin()

    await esperarBeto()
    expect(screen.getAllByText('Hoy').length).toBeGreaterThan(0)
  })

  it('el Gerente no elige sucursal', async () => {
    renderComoGerente()

    await esperarBeto()
    expect(screen.queryByLabelText('Sucursal')).not.toBeInTheDocument()
  })

  it('navega a la semana anterior', async () => {
    renderComoAdmin()
    await esperarBeto()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Semana anterior' }))

    await esperarBeto()
  })

  it('muestra el estado de error si falla la consulta', async () => {
    server.use(
      http.get(`${BASE_API}/assignments`, () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Error interno', error: 'Server Error' },
          { status: 500 },
        ),
      ),
    )
    renderComoAdmin()

    expect(
      await screen.findByText('No se pudo cargar el calendario'),
    ).toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay asignaciones', async () => {
    server.use(
      http.get(`${BASE_API}/assignments`, () =>
        HttpResponse.json({
          data: [],
          total: 0,
          page: 1,
          limit: 100,
          totalPaginas: 1,
        }),
      ),
    )
    renderComoAdmin()

    expect(
      await screen.findByText('Sin turnos en la semana'),
    ).toBeInTheDocument()
  })

  it('filtra por tipo de turno', async () => {
    renderComoAdmin()
    await esperarBeto()

    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: 'Tipo' }))
    await user.click(await screen.findByText('Variables'))

    await waitFor(() => {
      expect(screen.queryByText('07:30 – 16:00')).not.toBeInTheDocument()
    })
  })

  it('ofrece imprimir y muestra la cabecera de impresión', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderComoAdmin()
    await esperarBeto()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /imprimir/i }))
    await user.click(await screen.findByText('Grupo (sucursal)'))

    await waitFor(() => {
      expect(imprimir).toHaveBeenCalled()
    })
    expect(screen.getByText('Horario semanal — grupo')).toBeInTheDocument()
    imprimir.mockRestore()
  })
})
