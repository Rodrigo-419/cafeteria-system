import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { TurnosPage } from './TurnosPage'
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
  return renderConProveedores(<TurnosPage />)
}

function renderComoGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  return renderConProveedores(<TurnosPage />)
}

function renderSinPermisoTurnos() {
  iniciarSesionDePrueba(
    usuarioDePrueba(['equipo.ver'], {
      rol: 'Empleado',
      sucursalId: 'sucursal-1',
    }),
  )
  return renderConProveedores(<TurnosPage />)
}

function escribirHora(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } })
}

describe('Catálogo de turnos', () => {
  it('el Admin ve los turnos de todas las sucursales con su columna', async () => {
    renderComoAdmin()

    expect(await screen.findByText('07:30 – 16:00')).toBeInTheDocument()
    expect(screen.getByText('09:00 – 17:00')).toBeInTheDocument()
    expect(screen.getByText('Sin horario')).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Sucursal' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Sucursal Centro').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sucursal Norte').length).toBeGreaterThan(0)
  })

  it('el Gerente solo ve su sucursal, sin columna ni filtro de sucursal', async () => {
    renderComoGerente()

    expect(await screen.findByText('07:30 – 16:00')).toBeInTheDocument()
    expect(screen.queryByText('09:00 – 17:00')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'Sucursal' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Sucursal')).not.toBeInTheDocument()
  })

  it('el Admin crea un turno fijo eligiendo sucursal, horas y días', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('07:30 – 16:00')

    await user.click(screen.getByRole('button', { name: 'Crear turno' }))
    const dialogo = await screen.findByRole('dialog')

    await user.click(within(dialogo).getByLabelText('Sucursal'))
    await user.click(
      await screen.findByRole('option', { name: 'Sucursal Centro' }),
    )
    escribirHora('Hora de inicio', '08:00')
    escribirHora('Hora de fin', '12:00')
    await user.click(within(dialogo).getByLabelText('Lun'))

    await user.click(
      within(dialogo).getByRole('button', { name: 'Crear turno' }),
    )

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('08:00 – 12:00')).toBeInTheDocument()
  })

  it('el Gerente crea un turno sin elegir sucursal', async () => {
    renderComoGerente()
    const user = userEvent.setup()
    await screen.findByText('07:30 – 16:00')

    await user.click(screen.getByRole('button', { name: 'Crear turno' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).queryByLabelText('Sucursal')).not.toBeInTheDocument()

    escribirHora('Hora de inicio', '06:00')
    escribirHora('Hora de fin', '10:00')
    await user.click(within(dialogo).getByLabelText('Sáb'))
    await user.click(
      within(dialogo).getByRole('button', { name: 'Crear turno' }),
    )

    expect(await screen.findByText('06:00 – 10:00')).toBeInTheDocument()
  })

  it('edita las horas de un turno', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('07:30 – 16:00')

    const fila = screen.getByText('07:30 – 16:00').closest('tr') as HTMLElement
    await user.click(within(fila).getByRole('button', { name: 'Editar' }))
    const dialogo = await screen.findByRole('dialog')

    escribirHora('Hora de fin', '18:00')
    await user.click(
      within(dialogo).getByRole('button', { name: 'Guardar cambios' }),
    )

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(await screen.findByText('07:30 – 18:00')).toBeInTheDocument()
  })

  it('filtra por tipo', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('07:30 – 16:00')

    await user.click(screen.getByLabelText('Tipo'))
    await user.click(await screen.findByRole('option', { name: 'Variable' }))

    await waitFor(() =>
      expect(screen.queryByText('07:30 – 16:00')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Sin horario')).toBeInTheDocument()
  })

  it('el Admin filtra por sucursal', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('07:30 – 16:00')

    await user.click(screen.getByLabelText('Sucursal'))
    await user.click(
      await screen.findByRole('option', { name: 'Sucursal Norte' }),
    )

    expect(await screen.findByText('09:00 – 17:00')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText('07:30 – 16:00')).not.toBeInTheDocument(),
    )
  })

  it('sin permiso de turnos no hay acciones ni datos', async () => {
    renderSinPermisoTurnos()

    expect(await screen.findByText('Sin turnos')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Crear turno' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay turnos', async () => {
    server.use(
      http.get(`${BASE_API}/shifts`, () =>
        HttpResponse.json({
          data: [],
          total: 0,
          page: 1,
          limit: 10,
          totalPaginas: 0,
        }),
      ),
    )
    renderComoAdmin()

    expect(await screen.findByText('Sin turnos')).toBeInTheDocument()
  })

  it('muestra el estado de error si falla el listado', async () => {
    server.use(
      http.get(`${BASE_API}/shifts`, () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Error interno', error: 'Server Error' },
          { status: 500 },
        ),
      ),
    )
    renderComoAdmin()

    expect(await screen.findByText('Error al cargar datos')).toBeInTheDocument()
  })
})
