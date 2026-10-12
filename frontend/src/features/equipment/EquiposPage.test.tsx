import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { EquiposPage } from './EquiposPage'
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
    usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
  )
  return renderConProveedores(<EquiposPage />)
}

function renderComoGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  return renderConProveedores(<EquiposPage />)
}

function renderComoEmpleado() {
  iniciarSesionDePrueba(
    usuarioDePrueba(['equipo.ver'], {
      rol: 'Empleado',
      sucursalId: 'sucursal-1',
    }),
  )
  return renderConProveedores(<EquiposPage />)
}

describe('Gestión de equipos', () => {
  it('el Admin ve la columna Sucursal y equipos de todas las sucursales', async () => {
    renderComoAdmin()

    expect(await screen.findByText('Máquina de espresso')).toBeInTheDocument()
    expect(screen.getByText('Vitrina refrigerada')).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Sucursal' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Sucursal Centro').length).toBeGreaterThan(0)
  })

  it('el Gerente solo ve su sucursal, sin columna ni filtro de sucursal', async () => {
    renderComoGerente()

    expect(await screen.findByText('Máquina de espresso')).toBeInTheDocument()
    expect(screen.queryByText('Vitrina refrigerada')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'Sucursal' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Sucursal')).not.toBeInTheDocument()
  })

  it('el Admin registra un equipo eligiendo la sucursal', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('Máquina de espresso')

    await user.click(screen.getByRole('button', { name: 'Registrar equipo' }))
    const dialogo = await screen.findByRole('dialog')
    await user.type(
      within(dialogo).getByLabelText('Nombre'),
      'Tostadora Giesen',
    )
    await user.type(within(dialogo).getByLabelText('Tipo'), 'tostadora')
    await user.click(within(dialogo).getByLabelText('Sucursal'))
    await user.click(
      await screen.findByRole('option', { name: 'Sucursal Norte' }),
    )
    await user.click(
      within(dialogo).getByRole('button', { name: 'Registrar equipo' }),
    )

    expect(await screen.findByText('Tostadora Giesen')).toBeInTheDocument()
  })

  it('el Gerente registra un equipo en su sucursal sin elegirla', async () => {
    renderComoGerente()
    const user = userEvent.setup()
    await screen.findByText('Máquina de espresso')

    await user.click(screen.getByRole('button', { name: 'Registrar equipo' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).queryByLabelText('Sucursal')).not.toBeInTheDocument()
    await user.type(within(dialogo).getByLabelText('Nombre'), 'Molino nuevo')
    await user.type(within(dialogo).getByLabelText('Tipo'), 'molino')
    await user.click(
      within(dialogo).getByRole('button', { name: 'Registrar equipo' }),
    )

    expect(await screen.findByText('Molino nuevo')).toBeInTheDocument()
  })

  it('filtra por nombre o tipo', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('Máquina de espresso')

    await user.type(screen.getByLabelText('Buscar'), 'refriger')

    await waitFor(() =>
      expect(
        screen.queryByText('Máquina de espresso'),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Refrigeradora')).toBeInTheDocument()
  })

  it('no ofrece cambiar el estado de un equipo retirado', async () => {
    renderComoAdmin()
    await screen.findByText('Máquina de espresso')

    const filaRetirada = screen
      .getByText('Licuadora industrial')
      .closest('tr') as HTMLElement
    expect(
      within(filaRetirada).queryByRole('button', { name: 'Cambiar estado' }),
    ).not.toBeInTheDocument()
    expect(
      within(filaRetirada).getByRole('button', { name: 'Editar' }),
    ).toBeInTheDocument()

    const filaActiva = screen
      .getByText('Máquina de espresso')
      .closest('tr') as HTMLElement
    expect(
      within(filaActiva).getByRole('button', { name: 'Cambiar estado' }),
    ).toBeInTheDocument()
  })

  it('un usuario con solo equipo.ver ve el listado sin acciones de edición', async () => {
    renderComoEmpleado()

    expect(await screen.findByText('Máquina de espresso')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Registrar equipo' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Cambiar estado' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: 'Ver detalle' }).length,
    ).toBeGreaterThan(0)
  })

  it('muestra el estado vacío cuando no hay equipos en el alcance', async () => {
    server.use(
      http.get(`${BASE_API}/equipment`, () =>
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

    expect(await screen.findByText('Sin equipos')).toBeInTheDocument()
  })

  it('muestra el estado de error si falla el listado', async () => {
    server.use(
      http.get(`${BASE_API}/equipment`, () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Error interno', error: 'Server Error' },
          { status: 500 },
        ),
      ),
    )
    renderComoAdmin()

    expect(await screen.findByText('Error al cargar datos')).toBeInTheDocument()
  })

  it('muestra el estado de carga mientras llega el listado', () => {
    server.use(http.get(`${BASE_API}/equipment`, () => new Promise(() => {})))
    renderComoAdmin()

    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0)
  })
})
