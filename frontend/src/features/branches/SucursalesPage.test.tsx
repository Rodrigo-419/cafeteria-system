import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { SucursalesPage } from './SucursalesPage'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import {
  BASE_API,
  PERMISOS_ADMIN,
  PERMISOS_EMPLEADO,
  PERMISOS_GERENTE,
  usuarioDePrueba,
} from '@/test/handlers'
import { server } from '@/test/server'

function renderComoAdmin() {
  iniciarSesionDePrueba(
    usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
  )
  return renderConProveedores(<SucursalesPage />)
}

function renderComoGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  return renderConProveedores(<SucursalesPage />)
}

function renderComoEmpleado() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_EMPLEADO))
  return renderConProveedores(<SucursalesPage />)
}

async function abrirCrear() {
  const user = userEvent.setup()
  await screen.findByText('Sucursal Centro')
  await user.click(screen.getByRole('button', { name: 'Crear sucursal' }))
  const dialogo = await screen.findByRole('dialog')
  return { user, dialogo }
}

function filaDe(nombre: string): HTMLElement {
  return screen.getByText(nombre).closest('tr') as HTMLElement
}

describe('Gestión de sucursales', () => {
  it('el Admin ve todas las sucursales ordenadas, con el teléfono o un guion', async () => {
    renderComoAdmin()

    expect(await screen.findByText('Sucursal Centro')).toBeInTheDocument()
    expect(screen.getByText('Sucursal Norte')).toBeInTheDocument()
    expect(screen.getByText('555-0102')).toBeInTheDocument()
    expect(within(filaDe('Sucursal Centro')).getByText('—')).toBeInTheDocument()
  })

  it('el Gerente solo ve su sucursal y no ofrece crear ni editar', async () => {
    renderComoGerente()

    expect(await screen.findByText('Sucursal Centro')).toBeInTheDocument()
    expect(screen.queryByText('Sucursal Norte')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Crear sucursal' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument()
  })

  it('el Empleado tampoco ve acciones de creación ni edición', async () => {
    renderComoEmpleado()

    expect(await screen.findByText('Sucursal Centro')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Crear sucursal' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument()
  })

  it('el Admin crea una sucursal', async () => {
    renderComoAdmin()
    const { user, dialogo } = await abrirCrear()

    await user.type(within(dialogo).getByLabelText('Nombre'), 'Sucursal Sur')
    await user.type(within(dialogo).getByLabelText('Dirección'), 'Av. Sur 789')
    await user.type(
      within(dialogo).getByLabelText('Teléfono (opcional)'),
      '555-0199',
    )
    await user.click(
      within(dialogo).getByRole('button', { name: 'Crear sucursal' }),
    )

    expect(await screen.findByText('Sucursal Sur')).toBeInTheDocument()
    expect(screen.getByText('Av. Sur 789')).toBeInTheDocument()
    expect(screen.getByText('555-0199')).toBeInTheDocument()
  })

  it('rechaza un nombre duplicado ignorando mayúsculas y espacios', async () => {
    renderComoAdmin()
    const { user, dialogo } = await abrirCrear()

    await user.type(
      within(dialogo).getByLabelText('Nombre'),
      '  SUCURSAL   CENTRO ',
    )
    await user.type(within(dialogo).getByLabelText('Dirección'), 'Otra 100')
    await user.click(
      within(dialogo).getByRole('button', { name: 'Crear sucursal' }),
    )

    expect(
      await within(dialogo).findByText(
        'Ya existe una sucursal con ese nombre',
      ),
    ).toBeInTheDocument()
    expect(dialogo).toBeInTheDocument()
  })

  it('el Admin edita el teléfono y vaciarlo lo deja sin teléfono', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('Sucursal Norte')

    await user.click(
      within(filaDe('Sucursal Norte')).getByRole('button', { name: 'Editar' }),
    )
    const dialogo = await screen.findByRole('dialog')
    const telefono = within(dialogo).getByLabelText('Teléfono (opcional)')
    await user.clear(telefono)
    await user.click(
      within(dialogo).getByRole('button', { name: 'Guardar cambios' }),
    )

    await waitFor(() =>
      expect(screen.queryByText('555-0102')).not.toBeInTheDocument(),
    )
    expect(within(filaDe('Sucursal Norte')).getByText('—')).toBeInTheDocument()
  })

  it('filtra por nombre o dirección', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('Sucursal Centro')

    await user.type(screen.getByLabelText('Buscar'), 'norte 456')

    await waitFor(() =>
      expect(screen.queryByText('Sucursal Centro')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Sucursal Norte')).toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay sucursales en el alcance', async () => {
    server.use(http.get(`${BASE_API}/branches`, () => HttpResponse.json([])))
    renderComoAdmin()

    expect(await screen.findByText('Sin sucursales')).toBeInTheDocument()
  })

  it('muestra el estado de error si falla el listado', async () => {
    server.use(
      http.get(`${BASE_API}/branches`, () =>
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
