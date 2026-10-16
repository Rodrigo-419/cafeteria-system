import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { ReporteComparativoPage } from './ReporteComparativoPage'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import { BASE_API, PERMISOS_ADMIN, PERMISOS_GERENTE, usuarioDePrueba } from '@/test/handlers'
import { server } from '@/test/server'

function renderComoAdmin() {
  iniciarSesionDePrueba(
    usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
  )
  return renderConProveedores(<ReporteComparativoPage />, { ruta: '/reports' })
}

function renderComoGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  return renderConProveedores(<ReporteComparativoPage />, { ruta: '/reports' })
}

function filaDe(nombre: string): HTMLElement {
  return screen.getAllByText(nombre)[0]!.closest('tr') as HTMLElement
}

describe('Reporte comparativo de sucursales', () => {
  it('el Admin ve los KPI, el comparativo del periodo y el estado actual', async () => {
    renderComoAdmin()

    expect(await screen.findByText('Comparativo del periodo')).toBeInTheDocument()
    expect(screen.getByText('Estado actual')).toBeInTheDocument()
    expect(screen.getByText('Ventas de la red')).toBeInTheDocument()
    expect(screen.getByText('Movimientos de inventario')).toBeInTheDocument()
    expect(screen.getByText('Alertas de stock abiertas')).toBeInTheDocument()

    // Ventas de la red = 100.00 (Centro) + 0.00 (Norte): aparece en el KPI y en
    // la fila del periodo.
    expect(screen.getAllByText('S/ 100.00').length).toBeGreaterThanOrEqual(2)

    const centro = within(filaDe('Sucursal Centro')).getAllByRole('cell')
    expect(centro[1]).toHaveTextContent('S/ 100.00')
    expect(centro[2]).toHaveTextContent('10')
    expect(centro[3]).toHaveTextContent('S/ 10.00')
    expect(centro[4]).toHaveTextContent('1')
    expect(centro[5]).toHaveTextContent('2')
    expect(centro[6]).toHaveTextContent('1')
    expect(centro[7]).toHaveTextContent('1')

    // Una sucursal sin ventas muestra guion en el ticket promedio.
    const norte = within(filaDe('Sucursal Norte')).getAllByRole('cell')
    expect(norte[1]).toHaveTextContent('S/ 0.00')
    expect(norte[2]).toHaveTextContent('0')
    expect(norte[3]).toHaveTextContent('—')
    expect(screen.getByText('Sin alertas')).toBeInTheDocument()
  })

  it('filtra el reporte por sucursal', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('Comparativo del periodo')

    await user.click(screen.getByRole('combobox'))
    await user.click(
      await screen.findByRole('option', { name: 'Sucursal Norte' }),
    )
    await user.click(screen.getByRole('button', { name: 'Generar reporte' }))

    await waitFor(() =>
      expect(screen.queryByText('Sucursal Centro')).not.toBeInTheDocument(),
    )
    expect(screen.getAllByText('Sucursal Norte').length).toBeGreaterThanOrEqual(2)
  })

  it('rechaza un rango con "hasta" anterior a "desde" sin llamar al backend', async () => {
    renderComoAdmin()
    await screen.findByText('Comparativo del periodo')

    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-10-10' },
    })
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-10-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generar reporte' }))

    expect(
      await screen.findByText(
        'La fecha "hasta" no puede ser anterior a "desde".',
      ),
    ).toBeInTheDocument()
  })

  it('rechaza un rango de más de 92 días', async () => {
    renderComoAdmin()
    await screen.findByText('Comparativo del periodo')

    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-01-01' },
    })
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-06-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generar reporte' }))

    expect(
      await screen.findByText('El rango no puede superar 92 días.'),
    ).toBeInTheDocument()
  })

  it('muestra un mensaje claro cuando la API responde 403', async () => {
    server.use(
      http.get(`${BASE_API}/reports/comparativo`, () =>
        HttpResponse.json(
          { statusCode: 403, message: 'Acceso denegado', error: 'Forbidden' },
          { status: 403 },
        ),
      ),
    )
    renderComoAdmin()

    expect(await screen.findByText('Acceso denegado')).toBeInTheDocument()
  })

  it('muestra el mensaje de sucursal inexistente cuando la API responde 404', async () => {
    server.use(
      http.get(`${BASE_API}/reports/comparativo`, () =>
        HttpResponse.json(
          { statusCode: 404, message: 'La sucursal no existe', error: 'Not Found' },
          { status: 404 },
        ),
      ),
    )
    renderComoAdmin()

    expect(await screen.findByText('La sucursal no existe')).toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay sucursales en el alcance', async () => {
    server.use(
      http.get(`${BASE_API}/reports/comparativo`, () =>
        HttpResponse.json({
          desde: '2026-10-11',
          hasta: '2026-10-11',
          generadoEn: '2026-10-11T20:00:00.000Z',
          sucursales: [],
        }),
      ),
    )
    renderComoAdmin()

    const vacios = await screen.findAllByText('Sin sucursales')
    expect(vacios.length).toBeGreaterThanOrEqual(2)
  })

  it('el Gerente (sin permiso) no dispara la consulta del reporte', async () => {
    renderComoGerente()

    // La página no monta la consulta sin `reportes.comparativos.ver`: no hay
    // comparativo ni estado de error, solo el formulario de filtros.
    expect(screen.getByLabelText('Desde')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByText('Comparativo del periodo'),
      ).not.toBeInTheDocument(),
    )
  })
})
