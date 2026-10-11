import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { InsumosPage } from './InsumosPage'
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
  return renderConProveedores(<InsumosPage />)
}

function renderComoGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  return renderConProveedores(<InsumosPage />)
}

describe('Catálogo de insumos', () => {
  it('lista los insumos con su presentación', async () => {
    renderComoAdmin()

    expect(await screen.findByText('Café en grano')).toBeInTheDocument()
    expect(screen.getByText('Leche entera')).toBeInTheDocument()
    expect(screen.getAllByText('Bolsa').length).toBeGreaterThan(0)
  })

  it('crea un insumo y lo muestra en el catálogo', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    expect(await screen.findByText('Café en grano')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Nuevo insumo' }))
    const dialogo = await screen.findByRole('dialog')
    await user.type(
      within(dialogo).getByLabelText('Nombre'),
      'Azúcar rubia',
    )
    await user.click(within(dialogo).getByLabelText('Presentación'))
    await user.click(await screen.findByRole('option', { name: 'Bolsa' }))
    await user.click(
      within(dialogo).getByRole('button', { name: 'Crear insumo' }),
    )

    expect(await screen.findByText('Azúcar rubia')).toBeInTheDocument()
  })

  it('muestra el 409 al repetir el nombre', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    expect(await screen.findByText('Café en grano')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Nuevo insumo' }))
    const dialogo = await screen.findByRole('dialog')
    await user.type(
      within(dialogo).getByLabelText('Nombre'),
      'Café en grano',
    )
    await user.click(
      within(dialogo).getByRole('button', { name: 'Crear insumo' }),
    )

    expect(
      await screen.findByText(/Ya existe un insumo con ese nombre/),
    ).toBeInTheDocument()
  })

  it('muestra el 409 al eliminar un insumo con stock', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    const nombre = await screen.findByText('Café en grano')
    const fila = nombre.closest('tr') as HTMLElement

    await user.click(within(fila).getByRole('button', { name: 'Eliminar' }))
    const dialogo = await screen.findByRole('alertdialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar' }))

    expect(
      await screen.findByText(/No se puede eliminar un insumo con stock/),
    ).toBeInTheDocument()
  })

  it('oculta las acciones de edición al usuario sin permiso', async () => {
    renderComoGerente()

    expect(await screen.findByText('Café en grano')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Nuevo insumo' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay insumos', async () => {
    server.use(
      http.get(`${BASE_API}/insumos`, () =>
        HttpResponse.json({
          data: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPaginas: 1,
        }),
      ),
    )
    renderComoAdmin()

    expect(await screen.findByText('Sin insumos')).toBeInTheDocument()
  })

  it('muestra el estado de error si falla el listado', async () => {
    server.use(
      http.get(`${BASE_API}/insumos`, () =>
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
