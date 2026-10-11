import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { CartaSeccion } from './CartaSeccion'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import {
  BASE_API,
  PERMISOS_ADMIN,
  PERMISOS_EMPLEADO,
  PERMISOS_GERENTE,
  usuarioDePrueba,
} from '@/test/handlers'
import { server } from '@/test/server'

const OFERTA_URL = `${BASE_API}/branches/:sucursalId/products/:productoId/variants/:varianteId`

function renderComoGerente() {
  iniciarSesionDePrueba(
    usuarioDePrueba(PERMISOS_GERENTE, {
      rol: 'Gerente',
      sucursalId: 'sucursal-1',
    }),
  )
  return renderConProveedores(<CartaSeccion />)
}

async function abrirEditorDePrecio(user: ReturnType<typeof userEvent.setup>) {
  const nombre = await screen.findByText('Café Americano')
  const fila = nombre.closest('tr') as HTMLElement
  await user.click(within(fila).getByRole('button', { name: 'Editar precio' }))
  return screen.findByRole('dialog')
}

async function escribirPrecio(
  user: ReturnType<typeof userEvent.setup>,
  dialogo: HTMLElement,
  precio: string,
) {
  const input = within(dialogo).getByLabelText('Precio (S/)')
  await user.clear(input)
  await user.type(input, precio)
}

describe('Carta por sucursal', () => {
  it('permite al Gerente fijar un precio válido', async () => {
    renderComoGerente()
    const user = userEvent.setup()

    const dialogo = await abrirEditorDePrecio(user)
    await escribirPrecio(user, dialogo, '12.50')
    await user.click(
      within(dialogo).getByRole('button', { name: 'Guardar precio' }),
    )

    expect(await screen.findByText('S/ 12.50')).toBeInTheDocument()
  })

  it('muestra el 400 del servidor con un precio fuera de rango', async () => {
    renderComoGerente()
    const user = userEvent.setup()

    const dialogo = await abrirEditorDePrecio(user)
    await escribirPrecio(user, dialogo, '200000')
    await user.click(
      within(dialogo).getByRole('button', { name: 'Guardar precio' }),
    )

    expect(
      await screen.findByText(/entre 0.01 y 100000/),
    ).toBeInTheDocument()
  })

  it('muestra el 404 cuando la sucursal queda fuera del alcance', async () => {
    server.use(
      http.put(OFERTA_URL, () =>
        HttpResponse.json(
          {
            statusCode: 404,
            message: 'La sucursal no esta dentro de tu alcance',
            error: 'Not Found',
          },
          { status: 404 },
        ),
      ),
    )
    renderComoGerente()
    const user = userEvent.setup()

    const dialogo = await abrirEditorDePrecio(user)
    await escribirPrecio(user, dialogo, '10.00')
    await user.click(
      within(dialogo).getByRole('button', { name: 'Guardar precio' }),
    )

    expect(
      await screen.findByText(/no esta dentro de tu alcance/),
    ).toBeInTheDocument()
  })

  it('no ofrece acciones de precio al Admin, que solo consulta', async () => {
    iniciarSesionDePrueba(
      usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
    )
    renderConProveedores(<CartaSeccion />)
    const user = userEvent.setup()

    await user.click(await screen.findByLabelText('Sucursal'))
    await user.click(
      await screen.findByRole('option', { name: 'Sucursal Centro' }),
    )

    expect(await screen.findByText('Café Americano')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Editar precio' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Añadir a la carta' }),
    ).not.toBeInTheDocument()
  })

  it('el Empleado solo consulta la carta, sin acciones de edición', async () => {
    iniciarSesionDePrueba(
      usuarioDePrueba(PERMISOS_EMPLEADO, {
        rol: 'Empleado',
        sucursalId: 'sucursal-1',
      }),
    )
    renderConProveedores(<CartaSeccion />)

    expect(await screen.findByText('Café Americano')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Editar precio' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Añadir a la carta' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument()
  })
})
