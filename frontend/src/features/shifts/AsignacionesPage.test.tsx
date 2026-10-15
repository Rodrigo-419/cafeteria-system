import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { AsignacionesPage } from './AsignacionesPage'
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
  return renderConProveedores(<AsignacionesPage />)
}

function renderComoGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  return renderConProveedores(<AsignacionesPage />)
}

describe('Listado de asignaciones', () => {
  it('el Admin ve las asignaciones de todas las sucursales', async () => {
    renderComoAdmin()

    expect(await screen.findByText('Beto Turno')).toBeInTheDocument()
    expect(screen.getByText('Ada Pruebas')).toBeInTheDocument()
    expect(screen.getByText('Ciro Ruiz')).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Sucursal' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Vigente')).toHaveLength(2)
    expect(screen.getByText('Finalizada')).toBeInTheDocument()
  })

  it('el Gerente solo ve las asignaciones de su sucursal', async () => {
    renderComoGerente()

    expect(await screen.findByText('Beto Turno')).toBeInTheDocument()
    expect(screen.getByText('Ada Pruebas')).toBeInTheDocument()
    expect(screen.queryByText('Ciro Ruiz')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'Sucursal' }),
    ).not.toBeInTheDocument()
  })

  it('no ofrece retirar una asignación finalizada', async () => {
    renderComoAdmin()
    await screen.findByText('Beto Turno')

    const finalizada = screen.getByText('Ciro Ruiz').closest('tr') as HTMLElement
    expect(
      within(finalizada).queryByRole('button', { name: 'Retirar' }),
    ).not.toBeInTheDocument()

    const vigente = screen.getByText('Beto Turno').closest('tr') as HTMLElement
    expect(
      within(vigente).getByRole('button', { name: 'Retirar' }),
    ).toBeInTheDocument()
  })

  it('retira una asignación fijando su fecha de fin', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('Beto Turno')

    const fila = screen.getByText('Beto Turno').closest('tr') as HTMLElement
    await user.click(within(fila).getByRole('button', { name: 'Retirar' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo.textContent).toContain('Se cerrará la asignación')
    await user.click(
      within(dialogo).getByRole('button', { name: 'Retirar asignación' }),
    )

    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    )
  })

  it('avisa si la fecha de fin es anterior a la de inicio', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('Beto Turno')

    const fila = screen.getByText('Beto Turno').closest('tr') as HTMLElement
    await user.click(within(fila).getByRole('button', { name: 'Retirar' }))
    const dialogo = await screen.findByRole('alertdialog')

    fireEvent.change(within(dialogo).getByLabelText('Fecha de fin'), {
      target: { value: '2020-01-01' },
    })

    expect(
      await within(dialogo).findByText(
        'La fecha de fin no puede ser anterior a la de inicio.',
      ),
    ).toBeInTheDocument()
  })

  it('filtra por vigencia', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('Ciro Ruiz')

    await user.click(screen.getByLabelText('Vigencia'))
    await user.click(await screen.findByRole('option', { name: 'Vigentes' }))

    await waitFor(() =>
      expect(screen.queryByText('Ciro Ruiz')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Beto Turno')).toBeInTheDocument()
  })

  it('filtra por empleado', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('Beto Turno')

    await user.click(screen.getByLabelText('Empleado'))
    await user.click(await screen.findByRole('option', { name: 'Ada Pruebas' }))

    await waitFor(() =>
      expect(screen.queryByText('Beto Turno')).not.toBeInTheDocument(),
    )
    expect(screen.getAllByText('Ada Pruebas').length).toBeGreaterThan(0)
  })

  it('muestra el estado vacío cuando no hay asignaciones', async () => {
    server.use(
      http.get(`${BASE_API}/assignments`, () =>
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

    expect(await screen.findByText('Sin asignaciones')).toBeInTheDocument()
  })

  it('muestra el estado de error si falla el listado', async () => {
    server.use(
      http.get(`${BASE_API}/assignments`, () =>
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
