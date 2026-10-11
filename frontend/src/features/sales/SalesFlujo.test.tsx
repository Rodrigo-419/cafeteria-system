import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { App } from '@/App'
import { iniciarSesionDePrueba } from '@/test/render'
import { BASE_API, usuarioDePrueba } from '@/test/handlers'
import { server } from '@/test/server'

function renderApp(ruta: string) {
  window.history.pushState({}, '', ruta)
  return render(<App />)
}

describe('Flujo de ventas (rutas y permisos)', () => {
  it('un Empleado sin ventas.ver registra sin llamar al listado', async () => {
    let llamadasListado = 0
    server.use(
      http.get(`${BASE_API}/sales`, () => {
        llamadasListado += 1
        return HttpResponse.json({
          data: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPaginas: 1,
        })
      }),
    )
    iniciarSesionDePrueba(
      usuarioDePrueba(['ventas.registrar', 'productos.ver'], {
        rol: 'Empleado',
      }),
    )
    renderApp('/sales')

    expect(await screen.findByText('Nueva venta')).toBeInTheDocument()
    await screen.findByRole('button', { name: /Agregar Café Americano/ })

    expect(llamadasListado).toBe(0)
  })

  it('un Admin no ve acciones de registrar ni de anular', async () => {
    iniciarSesionDePrueba(
      usuarioDePrueba(['ventas.ver', 'sucursales.ver'], {
        rol: 'Admin',
        sucursalId: null,
      }),
    )
    renderApp('/sales')

    expect(await screen.findByText('Completada')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Nueva venta/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Anular' }),
    ).not.toBeInTheDocument()
  })

  it('el detalle de una venta completada ofrece anular con ventas.anular', async () => {
    iniciarSesionDePrueba(usuarioDePrueba(['ventas.ver', 'ventas.anular']))
    renderApp('/sales/venta-1')

    expect(await screen.findByText('Detalle de venta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anular' })).toBeInTheDocument()
  })

  it('el detalle de una venta anulada muestra quién, cuándo y por qué', async () => {
    iniciarSesionDePrueba(usuarioDePrueba(['ventas.ver']))
    renderApp('/sales/venta-2')

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(/Ada Pruebas/)
    expect(alerta).toHaveTextContent(/Se equivoco el cliente/)
    expect(
      screen.queryByRole('button', { name: 'Anular' }),
    ).not.toBeInTheDocument()
  })
})