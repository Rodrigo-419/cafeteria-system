import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { InventarioPage } from './InventarioPage'
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
  return renderConProveedores(<InventarioPage />)
}

function renderComoGerente(permisos = PERMISOS_GERENTE) {
  iniciarSesionDePrueba(usuarioDePrueba(permisos))
  return renderConProveedores(<InventarioPage />)
}

async function elegirSucursal(
  user: ReturnType<typeof userEvent.setup>,
  nombre: string,
) {
  await user.click(screen.getByLabelText('Sucursal'))
  await user.click(await screen.findByRole('option', { name: nombre }))
}

describe('Inventario por sucursal', () => {
  it('pide elegir sucursal al Admin y luego carga KPIs y tabla', async () => {
    renderComoAdmin()
    const user = userEvent.setup()

    expect(
      await screen.findByRole('heading', { name: 'Selecciona una sucursal' }),
    ).toBeInTheDocument()

    await elegirSucursal(user, 'Sucursal Centro')

    expect(await screen.findByText('Café en grano')).toBeInTheDocument()
    expect(screen.getByText('Total registrado')).toBeInTheDocument()
    expect(
      screen.getByText('Normal', { selector: '.uppercase' }),
    ).toBeInTheDocument()
  })

  it('registra una entrada y actualiza el stock', async () => {
    renderComoGerente()
    const user = userEvent.setup()

    const nombre = await screen.findByText('Leche entera')
    const fila = nombre.closest('tr') as HTMLElement
    await user.click(
      within(fila).getByRole('button', { name: 'Registrar entrada' }),
    )

    const dialogo = await screen.findByRole('dialog')
    await user.type(within(dialogo).getByLabelText('Cantidad recibida'), '3')
    await user.click(
      within(dialogo).getByRole('button', { name: 'Registrar entrada' }),
    )

    expect(await screen.findByText('23')).toBeInTheDocument()
  })

  it('añade un insumo a una sucursal vacía (upsert)', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: 'Selecciona una sucursal' })

    await elegirSucursal(user, 'Sucursal Norte')
    expect(
      await screen.findByText('Sin insumos en la sucursal'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Añadir insumo' }))
    const dialogo = await screen.findByRole('dialog')
    await user.click(within(dialogo).getByLabelText('Insumo'))
    await user.click(
      await screen.findByRole('option', { name: 'Café en grano' }),
    )
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('Café en grano')).toBeInTheDocument()
  })

  it('oculta las acciones al usuario solo con permiso de lectura', async () => {
    renderComoGerente(['insumos.ver'])

    expect(await screen.findByText('Café en grano')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Registrar entrada' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Añadir insumo' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Configurar' }),
    ).not.toBeInTheDocument()
  })

  it('muestra el estado de error si falla el stock', async () => {
    server.use(
      http.get(`${BASE_API}/inventario/sucursales/:sucursalId/stock`, () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Error interno', error: 'Server Error' },
          { status: 500 },
        ),
      ),
    )
    renderComoGerente()

    expect(await screen.findByText('Error al cargar datos')).toBeInTheDocument()
  })
})
