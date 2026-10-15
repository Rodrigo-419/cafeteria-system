import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { CalendarioTurnosPage } from './CalendarioTurnosPage'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import {
  BASE_API,
  PERMISOS_ADMIN,
  PERMISOS_GERENTE,
  TURNOS_PRUEBA,
  usuarioDePrueba,
} from '@/test/handlers'
import { server } from '@/test/server'
import type { AsignacionApi } from '@/types/api'

function renderComoAdmin() {
  iniciarSesionDePrueba(
    usuarioDePrueba(PERMISOS_ADMIN, {
      id: 'admin-1',
      nombre: 'Administrador',
      nombreUsuario: 'admin',
      rol: 'Admin',
      sucursalId: null,
    }),
  )
  return renderConProveedores(<CalendarioTurnosPage />)
}

function renderComoGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  return renderConProveedores(<CalendarioTurnosPage />)
}

function asignacionDeBeto(): AsignacionApi {
  const turno = TURNOS_PRUEBA[0]!
  return {
    id: 'a-1',
    empleadoId: 'empleado-2',
    turnoId: turno.id,
    fechaInicio: '2026-01-01',
    fechaFin: null,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
    empleado: {
      id: 'empleado-2',
      cargo: 'Barista',
      sucursalId: 'sucursal-1',
      usuario: { id: 'usuario-2', nombre: 'Beto Turno', nombreUsuario: 'beto' },
    },
    turno: { ...turno },
  }
}

describe('Calendario de turnos', () => {
  it('pinta la rejilla semanal y aparta las asignaciones sin días', async () => {
    renderComoAdmin()

    expect(await screen.findByText('Beto Turno')).toBeInTheDocument()
    expect(screen.getAllByText('07:30 – 16:00')).toHaveLength(5)
    expect(screen.getByText('Sin días fijos (1)')).toBeInTheDocument()
    expect(screen.getByText('Ada Pruebas')).toBeInTheDocument()
  })

  it('el Gerente no elige sucursal', async () => {
    renderComoGerente()

    expect(await screen.findByText('Beto Turno')).toBeInTheDocument()
    expect(screen.queryByLabelText('Sucursal')).not.toBeInTheDocument()
  })

  it('navega a la semana anterior', async () => {
    renderComoAdmin()
    const user = userEvent.setup()
    await screen.findByText('Beto Turno')

    await user.click(screen.getByRole('button', { name: 'Semana anterior' }))

    await waitFor(() =>
      expect(screen.queryByText('Ada Pruebas')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Beto Turno')).toBeInTheDocument()
    expect(screen.queryByText(/Sin días fijos/)).not.toBeInTheDocument()
  })

  it('avisa cuando el cuadro queda truncado', async () => {
    server.use(
      http.get(`${BASE_API}/assignments`, ({ request }) => {
        const url = new URL(request.url)
        const page = Number(url.searchParams.get('page') ?? '1')
        return HttpResponse.json({
          data: page === 1 ? [asignacionDeBeto()] : [],
          total: 1100,
          page,
          limit: 100,
          totalPaginas: 11,
        })
      }),
    )
    renderComoAdmin()

    expect(await screen.findByText('Cuadro incompleto')).toBeInTheDocument()
  })

  it('muestra el estado de error si falla el calendario', async () => {
    server.use(
      http.get(`${BASE_API}/assignments`, () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Error interno', error: 'Server Error' },
          { status: 500 },
        ),
      ),
    )
    renderComoAdmin()

    expect(
      await screen.findByText('No se pudo cargar el calendario'),
    ).toBeInTheDocument()
  })
})
