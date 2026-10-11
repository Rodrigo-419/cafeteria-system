import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { ProductsPage } from './ProductsPage'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import { BASE_API, PERMISOS_ADMIN, usuarioDePrueba } from '@/test/handlers'
import { server } from '@/test/server'

function renderComoAdmin() {
  iniciarSesionDePrueba(
    usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
  )
  return renderConProveedores(<ProductsPage />)
}

async function abrirNuevoProducto(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Nuevo producto' }))
  return screen.findByRole('dialog')
}

describe('Catálogo de productos', () => {
  it('crea un producto y lo muestra en el catálogo', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    expect(await screen.findByText('Café Americano')).toBeInTheDocument()

    const dialogo = await abrirNuevoProducto(user)
    await user.type(within(dialogo).getByLabelText('Nombre'), 'Chocolate')
    await user.click(within(dialogo).getByLabelText('Categoría'))
    await user.click(await screen.findByRole('option', { name: 'Bebidas' }))
    await user.click(
      within(dialogo).getByRole('button', { name: 'Crear producto' }),
    )

    expect(await screen.findByText('Chocolate')).toBeInTheDocument()
  })

  it('muestra el 409 al repetir el nombre de un producto', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    expect(await screen.findByText('Café Americano')).toBeInTheDocument()

    const dialogo = await abrirNuevoProducto(user)
    await user.type(
      within(dialogo).getByLabelText('Nombre'),
      'Café Americano',
    )
    await user.click(within(dialogo).getByLabelText('Categoría'))
    await user.click(await screen.findByRole('option', { name: 'Cafés' }))
    await user.click(
      within(dialogo).getByRole('button', { name: 'Crear producto' }),
    )

    expect(
      await screen.findByText(/Ya existe un producto con ese nombre/),
    ).toBeInTheDocument()
  })

  it('muestra el 409 al eliminar un producto con precios', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    const nombre = await screen.findByText('Café Americano')
    const fila = nombre.closest('tr') as HTMLElement

    await user.click(within(fila).getByRole('button', { name: 'Eliminar' }))
    const dialogo = await screen.findByRole('alertdialog')
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar' }))

    expect(
      await screen.findByText(/No se puede eliminar un producto con precios/),
    ).toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay productos', async () => {
    server.use(
      http.get(`${BASE_API}/products`, () =>
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

    expect(await screen.findByText('Sin productos')).toBeInTheDocument()
  })

  it('muestra el estado de error si falla el listado', async () => {
    server.use(
      http.get(`${BASE_API}/products`, () =>
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
