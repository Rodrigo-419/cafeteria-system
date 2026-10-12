import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { MovimientosPage } from './MovimientosPage'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import {
  BASE_API,
  PERMISOS_ADMIN,
  PERMISOS_GERENTE,
  usuarioDePrueba,
} from '@/test/handlers'
import { server } from '@/test/server'

function renderComoGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  return renderConProveedores(<MovimientosPage />)
}

function renderComoAdmin() {
  iniciarSesionDePrueba(
    usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
  )
  return renderConProveedores(<MovimientosPage />)
}

describe('Movimientos de stock', () => {
  it('lista entradas y ajustes con la variación firmada', async () => {
    renderComoGerente()

    expect(await screen.findByText('Leche entera')).toBeInTheDocument()
    expect(screen.getByText('Café en grano')).toBeInTheDocument()
    expect(screen.getByText('+5')).toBeInTheDocument()
    expect(screen.getByText('-1')).toBeInTheDocument()
    expect(screen.getByText('Compra semanal')).toBeInTheDocument()
    expect(screen.getByText('Entrada')).toBeInTheDocument()
    expect(screen.getByText('Ajuste')).toBeInTheDocument()
  })

  it('filtra por tipo de movimiento', async () => {
    renderComoGerente()
    const user = userEvent.setup()
    await screen.findByText('Leche entera')

    await user.click(screen.getByLabelText('Tipo'))
    await user.click(await screen.findByRole('option', { name: 'Ajuste' }))

    expect(await screen.findByText('Café en grano')).toBeInTheDocument()
    expect(screen.queryByText('Leche entera')).toBeNull()
  })

  it('pide elegir sucursal al Admin', async () => {
    renderComoAdmin()
    const user = userEvent.setup()

    expect(
      await screen.findByRole('heading', { name: 'Selecciona una sucursal' }),
    ).toBeInTheDocument()

    await user.click(screen.getByLabelText('Sucursal'))
    await user.click(
      await screen.findByRole('option', { name: 'Sucursal Centro' }),
    )

    expect(await screen.findByText('Leche entera')).toBeInTheDocument()
  })

  it('muestra el estado de error si falla el listado', async () => {
    server.use(
      http.get(
        `${BASE_API}/inventario/sucursales/:sucursalId/movimientos`,
        () =>
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
