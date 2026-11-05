import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { SalesListPage } from './SalesListPage'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import {
  BASE_API,
  usuarioDePrueba,
  VENTA_ANULADA,
} from '@/test/handlers'
import { server } from '@/test/server'

describe('SalesListPage', () => {
  it('muestra el listado con totales en soles y estados', async () => {
    iniciarSesionDePrueba(usuarioDePrueba(['ventas.ver']))
    renderConProveedores(<SalesListPage />)

    expect(await screen.findByText('Completada')).toBeInTheDocument()
    expect(screen.getByText('Anulada')).toBeInTheDocument()
    expect(screen.getAllByText('S/ 10.00').length).toBeGreaterThan(0)
  })

  it('no muestra el filtro de sucursal a quien no es Admin', async () => {
    iniciarSesionDePrueba(usuarioDePrueba(['ventas.ver']))
    renderConProveedores(<SalesListPage />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Filtros' }))
    expect(await screen.findByLabelText('Estado')).toBeInTheDocument()
    expect(screen.queryByLabelText('Sucursal')).not.toBeInTheDocument()
  })

  it('muestra el filtro de sucursal al Admin', async () => {
    iniciarSesionDePrueba(
      usuarioDePrueba(['ventas.ver', 'sucursales.ver'], {
        rol: 'Admin',
        sucursalId: null,
      }),
    )
    renderConProveedores(<SalesListPage />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Filtros' }))
    expect(await screen.findByLabelText('Sucursal')).toBeInTheDocument()
  })

  it('al filtrar por estado anulada envía el parámetro a la API', async () => {
    const urls: string[] = []
    server.use(
      http.get(`${BASE_API}/sales`, ({ request }) => {
        urls.push(request.url)
        return HttpResponse.json({
          data: [VENTA_ANULADA],
          total: 1,
          page: 1,
          limit: 20,
          totalPaginas: 1,
        })
      }),
    )
    iniciarSesionDePrueba(usuarioDePrueba(['ventas.ver']))
    renderConProveedores(<SalesListPage />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Filtros' }))
    await user.click(await screen.findByLabelText('Estado'))
    await user.click(await screen.findByRole('option', { name: 'Anuladas' }))

    expect(screen.getByLabelText('1 filtros activos')).toBeInTheDocument()
    await waitFor(() =>
      expect(urls.some((url) => url.includes('estado=anulada'))).toBe(true),
    )
    expect(await screen.findByText('Anulada')).toBeInTheDocument()
  })

  it('solo ofrece anular dentro del menú de acciones y pide confirmación', async () => {
    iniciarSesionDePrueba(usuarioDePrueba(['ventas.ver', 'ventas.anular']))
    renderConProveedores(<SalesListPage />)
    const user = userEvent.setup()

    const fila = (await screen.findByText('Completada')).closest(
      'tr',
    ) as HTMLElement
    expect(
      within(fila).queryByRole('button', { name: 'Anular venta' }),
    ).not.toBeInTheDocument()
    expect(within(fila).getByRole('link', { name: 'Ver' })).toBeInTheDocument()

    await user.click(within(fila).getByRole('button', { name: 'Más acciones' }))
    await user.click(
      await screen.findByRole('menuitem', { name: 'Anular venta' }),
    )
    const dialogo = await screen.findByRole('alertdialog')
    expect(
      within(dialogo).getByLabelText('Motivo de la anulación'),
    ).toBeInTheDocument()
  })
})