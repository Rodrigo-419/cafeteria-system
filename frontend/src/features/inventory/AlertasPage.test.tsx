import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { AlertasPage } from './AlertasPage'
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
  return renderConProveedores(<AlertasPage />)
}

function renderComoGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  return renderConProveedores(<AlertasPage />)
}

describe('Alertas de stock (solo lectura)', () => {
  it('lista las alertas abiertas y explica que son automáticas', async () => {
    renderComoGerente()

    expect(await screen.findByText('Café en grano')).toBeInTheDocument()
    expect(screen.getByText('Alertas automáticas')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resolver' })).toBeNull()
  })

  it('el Admin ve la columna de sucursal', async () => {
    renderComoAdmin()

    expect(await screen.findByText('Café en grano')).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Sucursal' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sucursal Centro')).toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay alertas para el filtro', async () => {
    server.use(
      http.get(`${BASE_API}/inventario/alertas`, () =>
        HttpResponse.json({
          data: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPaginas: 1,
        }),
      ),
    )
    renderComoGerente()

    expect(await screen.findByText('Sin alertas')).toBeInTheDocument()
  })

  it('muestra el estado de error si falla el listado', async () => {
    server.use(
      http.get(`${BASE_API}/inventario/alertas`, () =>
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
