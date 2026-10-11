// Pruebas de regresión de los tres problemas detectados al probar el
// inventario: (1) el estado "bajo mínimo" tras una entrada debe coincidir
// EXACTAMENTE con la regla del backend (`stock <= mínimo`), (2) una entrada que
// supera el mínimo cierra la alerta y refresca los bloques del panel, y (3) no
// deben aparecer estados contradictorios para el mismo insumo.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { DashboardPage } from '@/routes/DashboardPage'
import {
  BASE_API,
  PERMISOS_ADMIN,
  PERMISOS_GERENTE,
  REPORTE_COMPARATIVO_PRUEBA,
  usuarioDePrueba,
} from '@/test/handlers'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import { server } from '@/test/server'
import { InventarioPage } from './InventarioPage'
import { estadoNivel } from './presentacion'
import { useRegistrarEntrada } from './queries'

describe('nivel de stock (misma regla que el backend: stock <= mínimo)', () => {
  it('marca como bajo un stock igual al mínimo', () => {
    expect(estadoNivel('5.00', '5.00', 'activo')).toBe('bajo')
  })

  it('marca como bajo un stock por debajo del mínimo', () => {
    expect(estadoNivel('2.00', '5.00', 'activo')).toBe('bajo')
  })

  it('marca como normal solo cuando el stock supera el mínimo', () => {
    expect(estadoNivel('5.01', '5.00', 'activo')).toBe('normal')
  })

  it('marca como descontinuado sin importar el stock', () => {
    expect(estadoNivel('0.00', '5.00', 'descontinuado')).toBe('descontinuado')
  })

  it('compara céntimos enteros sin errores de coma flotante', () => {
    expect(estadoNivel('0.30', '0.30', 'activo')).toBe('bajo')
    expect(estadoNivel('0.30', '0.29', 'activo')).toBe('normal')
  })
})

function renderInventarioComoGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  return renderConProveedores(<InventarioPage />)
}

async function filaDeCafe(): Promise<HTMLElement> {
  const nombre = await screen.findByText('Café en grano')
  return nombre.closest('tr') as HTMLElement
}

async function registrarEntrada(
  user: ReturnType<typeof userEvent.setup>,
  cantidad: string,
) {
  const fila = await filaDeCafe()
  await user.click(
    within(fila).getByRole('button', { name: 'Registrar entrada' }),
  )
  const dialogo = await screen.findByRole('dialog')
  await user.type(
    within(dialogo).getByLabelText('Cantidad recibida'),
    cantidad,
  )
  await user.click(
    within(dialogo).getByRole('button', { name: 'Registrar entrada' }),
  )
}

describe('entrada de stock y coherencia de estados', () => {
  it('una entrada que supera el mínimo deja el insumo Normal y cierra la alerta', async () => {
    renderInventarioComoGerente()
    const user = userEvent.setup()

    expect(
      within(await filaDeCafe()).getByText('Bajo mínimo'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /solo bajo mínimo \(1\)/i }),
    ).toBeInTheDocument()

    await registrarEntrada(user, '5')

    await waitFor(async () => {
      const fila = await filaDeCafe()
      expect(within(fila).getByText('Normal')).toBeInTheDocument()
      expect(within(fila).queryByText('Bajo mínimo')).not.toBeInTheDocument()
    })
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /solo bajo mínimo \(0\)/i }),
      ).toBeInTheDocument(),
    )
  })

  it('una entrada que deja el stock en el mínimo lo mantiene como bajo', async () => {
    renderInventarioComoGerente()
    const user = userEvent.setup()

    await registrarEntrada(user, '3')

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    const fila = await filaDeCafe()
    expect(within(fila).getByText('Bajo mínimo')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /solo bajo mínimo \(1\)/i }),
    ).toBeInTheDocument()
  })
})

/** Botón de prueba que registra una entrada usando la mutación real. */
function ProbeEntrada() {
  const registrar = useRegistrarEntrada()
  return (
    <button
      type="button"
      onClick={() =>
        registrar.mutate({
          sucursalId: 'sucursal-1',
          insumoId: 'i-1',
          entrada: { cantidad: 5 },
        })
      }
    >
      Cerrar alerta
    </button>
  )
}

describe('el panel refleja los cambios de stock', () => {
  it('refresca las alertas abiertas y el comparativo tras una entrada', async () => {
    iniciarSesionDePrueba(
      usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
    )
    let reporteLlamadas = 0
    server.use(
      http.get(`${BASE_API}/reports/comparativo`, () => {
        reporteLlamadas += 1
        return HttpResponse.json(REPORTE_COMPARATIVO_PRUEBA)
      }),
    )

    renderConProveedores(
      <>
        <DashboardPage />
        <ProbeEntrada />
      </>,
    )
    const user = userEvent.setup()

    expect(await screen.findByText('1 alerta abierta')).toBeInTheDocument()
    await waitFor(() => expect(reporteLlamadas).toBeGreaterThan(0))

    await user.click(screen.getByRole('button', { name: 'Cerrar alerta' }))

    expect(await screen.findByText('0 alertas abiertas')).toBeInTheDocument()
    await waitFor(() => expect(reporteLlamadas).toBeGreaterThan(1))
  })
})
