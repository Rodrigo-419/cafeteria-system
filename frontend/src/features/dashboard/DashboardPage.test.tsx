import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { DashboardPage } from '@/routes/DashboardPage'
import {
  BASE_API,
  PERMISOS_ADMIN,
  PERMISOS_EMPLEADO,
  PERMISOS_GERENTE,
  REPORTE_COMPARATIVO_PRUEBA,
  usuarioDePrueba,
} from '@/test/handlers'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import { server } from '@/test/server'
import type { UsuarioApi } from '@/types/api'

const ADMIN = usuarioDePrueba(PERMISOS_ADMIN, {
  nombre: 'Admin Uno',
  rol: 'Admin',
  sucursalId: null,
})

const GERENTE = usuarioDePrueba(PERMISOS_GERENTE, {
  nombre: 'Gerente Dos',
  rol: 'Gerente',
})

const EMPLEADO = usuarioDePrueba(PERMISOS_EMPLEADO, {
  nombre: 'Empleado Tres',
  rol: 'Empleado',
})

function renderizar(usuario: UsuarioApi) {
  iniciarSesionDePrueba(usuario)
  renderConProveedores(<DashboardPage />)
}

/**
 * Intercepta las rutas del panel con contadores para poder afirmar cuáles NO
 * se llamaron. Devuelve el registro de llamadas por ruta.
 */
function espiarRutasDelPanel() {
  const llamadas = {
    ventas: 0,
    alertas: 0,
    asistencia: 0,
    equipos: 0,
    reporte: 0,
  }

  server.use(
    http.get(`${BASE_API}/sales`, () => {
      llamadas.ventas += 1
      return HttpResponse.json({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPaginas: 1,
      })
    }),
    http.get(`${BASE_API}/inventario/alertas`, () => {
      llamadas.alertas += 1
      return HttpResponse.json({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPaginas: 1,
      })
    }),
    http.get(`${BASE_API}/attendance/records`, () => {
      llamadas.asistencia += 1
      return HttpResponse.json({ items: [], total: 0, page: 1, limit: 20 })
    }),
    http.get(`${BASE_API}/equipment`, () => {
      llamadas.equipos += 1
      return HttpResponse.json({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPaginas: 1,
      })
    }),
    http.get(`${BASE_API}/reports/comparativo`, () => {
      llamadas.reporte += 1
      return HttpResponse.json(REPORTE_COMPARATIVO_PRUEBA)
    }),
  )

  return llamadas
}

describe('DashboardPage', () => {
  it('muestra todos los bloques para un Admin', async () => {
    renderizar(ADMIN)

    expect(await screen.findByText('Ventas de hoy')).toBeInTheDocument()
    expect(screen.getByText('Últimas ventas')).toBeInTheDocument()
    expect(screen.getByText('Alertas de stock')).toBeInTheDocument()
    expect(screen.getByText('Personal en turno')).toBeInTheDocument()
    expect(
      screen.getByText('Equipos', { selector: '[data-slot="card-title"]' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Comparativo entre sucursales')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /ver ventas/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /nueva venta/i }),
    ).not.toBeInTheDocument()
    // El Admin no tiene sucursal: no ve el atajo al terminal de asistencia.
    expect(
      screen.queryByRole('link', { name: /marcar asistencia/i }),
    ).not.toBeInTheDocument()
  })

  it('oculta el reporte comparativo al Gerente y no llama a su ruta', async () => {
    const llamadas = espiarRutasDelPanel()
    renderizar(GERENTE)

    expect(await screen.findByText('Ventas de hoy')).toBeInTheDocument()
    expect(await screen.findByText('Personal en turno')).toBeInTheDocument()

    expect(
      screen.queryByText('Comparativo entre sucursales'),
    ).not.toBeInTheDocument()
    expect(llamadas.reporte).toBe(0)

    // Con permiso de marcación y sucursal ve el atajo al terminal.
    expect(
      screen.getByRole('link', { name: /marcar asistencia/i }),
    ).toHaveAttribute('href', '/attendance/terminal')
  })

  it('para un Empleado con permisos mínimos muestra solo su bloque', async () => {
    const llamadas = espiarRutasDelPanel()
    renderizar(EMPLEADO)

    expect(await screen.findByText('Personal en turno')).toBeInTheDocument()
    await waitFor(() => expect(llamadas.asistencia).toBeGreaterThan(0))

    expect(screen.queryByText('Ventas de hoy')).not.toBeInTheDocument()
    expect(screen.queryByText('Últimas ventas')).not.toBeInTheDocument()
    expect(screen.queryByText('Alertas de stock')).not.toBeInTheDocument()
    expect(screen.queryByText('Equipos')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Comparativo entre sucursales'),
    ).not.toBeInTheDocument()

    expect(llamadas.ventas).toBe(0)
    expect(llamadas.alertas).toBe(0)
    expect(llamadas.equipos).toBe(0)
    expect(llamadas.reporte).toBe(0)

    // Con permiso de marcación y sucursal ve el atajo al terminal.
    expect(
      screen.getByRole('link', { name: /marcar asistencia/i }),
    ).toHaveAttribute('href', '/attendance/terminal')
  })

  it('aísla el error de un bloque sin romper los demás', async () => {
    iniciarSesionDePrueba(GERENTE)
    server.use(
      http.get(`${BASE_API}/inventario/alertas`, () =>
        HttpResponse.json(
          {
            statusCode: 500,
            message: 'Fallo interno',
            error: 'Internal Server Error',
          },
          { status: 500 },
        ),
      ),
    )

    renderConProveedores(<DashboardPage />)

    expect(
      await screen.findByText(/no pudo entregar las alertas de stock/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Ventas de hoy')).toBeInTheDocument()
    expect(screen.getByText('Últimas ventas')).toBeInTheDocument()
    expect(screen.getByText('Personal en turno')).toBeInTheDocument()
  })
})
