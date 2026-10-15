import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { EmpleadosPage } from './EmpleadosPage'
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
  return renderConProveedores(<EmpleadosPage />)
}

function renderComoGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  return renderConProveedores(<EmpleadosPage />)
}

describe('Gestión de empleados', () => {
  it('el Admin ve la columna Sucursal y a todos los empleados', async () => {
    renderComoAdmin()

    expect(await screen.findByText('Beto Turno')).toBeInTheDocument()
    expect(screen.getByText('Ada Pruebas')).toBeInTheDocument()
    expect(screen.getByText('Ciro Ruiz')).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Sucursal' }),
    ).toBeInTheDocument()
  })

  it('el Gerente solo ve empleados de usuarios Empleado de su sucursal', async () => {
    renderComoGerente()

    expect(await screen.findByText('Beto Turno')).toBeInTheDocument()
    expect(screen.queryByText('Ada Pruebas')).not.toBeInTheDocument()
    expect(screen.queryByText('Ciro Ruiz')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'Sucursal' }),
    ).not.toBeInTheDocument()
  })

  it('el Admin registra un empleado vinculando un usuario existente', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('Beto Turno')

    await user.click(screen.getByRole('button', { name: 'Registrar empleado' }))
    const dialogo = await screen.findByRole('dialog')
    await user.click(within(dialogo).getByLabelText('Usuario'))
    await user.click(await screen.findByRole('option', { name: /Dora Nueva/ }))
    await user.type(within(dialogo).getByLabelText('Cargo'), 'Barista')
    await user.click(
      within(dialogo).getByRole('button', { name: 'Registrar empleado' }),
    )

    expect(await screen.findByText('Dora Nueva')).toBeInTheDocument()
  })

  it('atenúa en el selector a los usuarios ya registrados como empleados', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('Beto Turno')

    await user.click(screen.getByRole('button', { name: 'Registrar empleado' }))
    const dialogo = await screen.findByRole('dialog')
    await user.click(within(dialogo).getByLabelText('Usuario'))

    expect(
      await screen.findByRole('option', {
        name: /Ada Pruebas.*ya registrado/,
      }),
    ).toBeInTheDocument()
  })

  it('genera un PIN de marcación de un solo uso', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    const fila = (await screen.findByText('Beto Turno')).closest(
      'tr',
    ) as HTMLElement

    await user.click(within(fila).getByRole('button', { name: 'Generar PIN' }))
    const confirmacion = await screen.findByRole('alertdialog')
    await user.click(
      within(confirmacion).getByRole('button', { name: 'Generar PIN' }),
    )

    const dialogo = await screen.findByRole('dialog')
    expect(
      within(dialogo).getByText('Se muestra una sola vez'),
    ).toBeInTheDocument()
    const pin = within(dialogo).getByLabelText('PIN') as HTMLInputElement
    expect(pin.value).toMatch(/^\d{6}$/)
  })

  it('cesa a un empleado y deja de ofrecer cese y PIN', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    const fila = (await screen.findByText('Beto Turno')).closest(
      'tr',
    ) as HTMLElement

    await user.click(within(fila).getByRole('button', { name: 'Cesar' }))
    const dialogo = await screen.findByRole('alertdialog')
    expect(within(dialogo).getByText(/bloquea su cuenta/)).toBeInTheDocument()
    await user.click(
      within(dialogo).getByRole('button', { name: 'Cesar empleado' }),
    )

    await waitFor(() => {
      const filaCesada = screen.getByText('Beto Turno').closest(
        'tr',
      ) as HTMLElement
      expect(within(filaCesada).getByText('Cesado')).toBeInTheDocument()
    })

    const filaCesada = screen.getByText('Beto Turno').closest('tr') as HTMLElement
    expect(
      within(filaCesada).queryByRole('button', { name: 'Cesar' }),
    ).not.toBeInTheDocument()
    expect(
      within(filaCesada).queryByRole('button', { name: 'Generar PIN' }),
    ).not.toBeInTheDocument()
  })

  it('edita el cargo de un empleado', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    const fila = (await screen.findByText('Beto Turno')).closest(
      'tr',
    ) as HTMLElement

    await user.click(within(fila).getByRole('button', { name: 'Editar' }))
    const dialogo = await screen.findByRole('dialog')
    const cargo = within(dialogo).getByLabelText('Cargo')
    await user.clear(cargo)
    await user.type(cargo, 'Barista senior')
    await user.click(
      within(dialogo).getByRole('button', { name: 'Guardar cambios' }),
    )

    expect(await screen.findByText('Barista senior')).toBeInTheDocument()
  })

  it('un empleado cesado no ofrece cese ni PIN', async () => {
    renderComoAdmin()
    const fila = (await screen.findByText('Ciro Ruiz')).closest(
      'tr',
    ) as HTMLElement

    expect(
      within(fila).queryByRole('button', { name: 'Cesar' }),
    ).not.toBeInTheDocument()
    expect(
      within(fila).queryByRole('button', { name: 'Generar PIN' }),
    ).not.toBeInTheDocument()
    expect(
      within(fila).getByRole('button', { name: 'Editar' }),
    ).toBeInTheDocument()
  })

  it('filtra por nombre, usuario o cargo', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('Beto Turno')

    await user.type(screen.getByLabelText('Buscar'), 'barista')

    await waitFor(() =>
      expect(screen.queryByText('Ada Pruebas')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Beto Turno')).toBeInTheDocument()
  })

  it('un usuario sin permiso no ve las acciones de gestión', async () => {
    iniciarSesionDePrueba(
      usuarioDePrueba(['equipo.ver'], {
        rol: 'Empleado',
        sucursalId: 'sucursal-1',
      }),
    )
    renderConProveedores(<EmpleadosPage />)

    expect(
      screen.queryByRole('button', { name: 'Registrar empleado' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay empleados en el alcance', async () => {
    server.use(
      http.get(`${BASE_API}/employees`, () =>
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

    expect(await screen.findByText('Sin empleados')).toBeInTheDocument()
  })

  it('muestra el estado de error si falla el listado', async () => {
    server.use(
      http.get(`${BASE_API}/employees`, () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Error interno', error: 'Server Error' },
          { status: 500 },
        ),
      ),
    )
    renderComoAdmin()

    expect(await screen.findByText('Error al cargar datos')).toBeInTheDocument()
  })

  it('muestra el estado de carga mientras llega el listado', async () => {
    server.use(
      http.get(`${BASE_API}/employees`, () => new Promise(() => {})),
    )
    renderComoAdmin()

    await waitFor(() =>
      expect(
        document.querySelectorAll('[data-slot="skeleton"]').length,
      ).toBeGreaterThan(0),
    )
  })
})
