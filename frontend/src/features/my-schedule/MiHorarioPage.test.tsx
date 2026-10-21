// Pruebas de la pantalla MiHorarioPage con MSW.
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { renderConProveedores, iniciarSesionDePrueba } from '@/test/render'
import { MiHorarioPage } from './MiHorarioPage'
import {
  BASE_API,
  usuarioDePrueba,
} from '@/test/handlers'
import { server } from '@/test/server'

const EMPLEADO = usuarioDePrueba(['asistencia.marcar', 'asistencia.ver'], {
  nombre: 'Ada Pruebas',
  sucursalId: 'sucursal-1',
})

function responderHorario(dias: unknown[]) {
  server.use(
    http.get(`${BASE_API}/my/schedule`, () =>
      HttpResponse.json({
        empleado: {
          nombre: 'Ada Pruebas',
          cargo: 'Barista',
          sucursal: 'Sucursal Centro',
        },
        dias,
      }),
    ),
  )
}

describe('MiHorarioPage', () => {
  it('muestra el horario semanal del empleado', async () => {
    iniciarSesionDePrueba(EMPLEADO)
    responderHorario([
      {
        fecha: '2026-10-19',
        turno: {
          tipo: 'fijo',
          horaInicio: '07:30',
          horaFin: '16:00',
          diasSemana: '1,2,3,4,5',
        },
      },
      { fecha: '2026-10-20', turno: null },
      { fecha: '2026-10-21', turno: null },
      { fecha: '2026-10-22', turno: null },
      { fecha: '2026-10-23', turno: null },
      {
        fecha: '2026-10-24',
        turno: {
          tipo: 'fijo',
          horaInicio: '07:30',
          horaFin: '16:00',
          diasSemana: '1,2,3,4,5',
        },
      },
      { fecha: '2026-10-25', turno: null },
    ])

    renderConProveedores(<MiHorarioPage />, { ruta: '/my/schedule' })

    expect(
      await screen.findByRole('heading', { name: 'Mi horario' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Ada Pruebas').length).toBeGreaterThan(0)
    expect(screen.getByText('Barista')).toBeInTheDocument()
    expect(screen.getAllByText('Sucursal Centro').length).toBeGreaterThan(0)
  })

  it('navega a la semana anterior y siguiente', async () => {
    iniciarSesionDePrueba(EMPLEADO)
    responderHorario([
      { fecha: '2026-10-19', turno: null },
      { fecha: '2026-10-20', turno: null },
      { fecha: '2026-10-21', turno: null },
      { fecha: '2026-10-22', turno: null },
      { fecha: '2026-10-23', turno: null },
      { fecha: '2026-10-24', turno: null },
      { fecha: '2026-10-25', turno: null },
    ])

    renderConProveedores(<MiHorarioPage />, { ruta: '/my/schedule' })
    await screen.findByRole('heading', { name: 'Mi horario' })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /semana anterior/i }))
    await waitFor(() => {
      expect(screen.getByText(/semana del 12 oct/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /semana siguiente/i }))
    await waitFor(() => {
      expect(screen.getByText(/semana del 19 oct/i)).toBeInTheDocument()
    })
  })

  it('muestra estado vacío cuando no hay turnos en la semana', async () => {
    iniciarSesionDePrueba(EMPLEADO)
    responderHorario([
      { fecha: '2026-10-19', turno: null },
      { fecha: '2026-10-20', turno: null },
      { fecha: '2026-10-21', turno: null },
      { fecha: '2026-10-22', turno: null },
      { fecha: '2026-10-23', turno: null },
      { fecha: '2026-10-24', turno: null },
      { fecha: '2026-10-25', turno: null },
    ])

    renderConProveedores(<MiHorarioPage />, { ruta: '/my/schedule' })

    expect(
      await screen.findByText(/sin turnos esta semana/i),
    ).toBeInTheDocument()
  })

  it('muestra error cuando la petición falla', async () => {
    iniciarSesionDePrueba(EMPLEADO)
    server.use(
      http.get(`${BASE_API}/my/schedule`, () =>
        HttpResponse.json(
          {
            statusCode: 500,
            message: 'Error interno',
            error: 'Internal Server Error',
          },
          { status: 500 },
        ),
      ),
    )

    renderConProveedores(<MiHorarioPage />, { ruta: '/my/schedule' })

    expect(
      await screen.findByText(/no se pudo cargar tu horario/i),
    ).toBeInTheDocument()
  })

  it('ofrece imprimir y muestra la cabecera', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {})
    iniciarSesionDePrueba(EMPLEADO)
    responderHorario([
      {
        fecha: '2026-10-19',
        turno: {
          tipo: 'fijo',
          horaInicio: '07:30',
          horaFin: '16:00',
          diasSemana: '1,2,3,4,5',
        },
      },
      { fecha: '2026-10-20', turno: null },
      { fecha: '2026-10-21', turno: null },
      { fecha: '2026-10-22', turno: null },
      { fecha: '2026-10-23', turno: null },
      { fecha: '2026-10-24', turno: null },
      { fecha: '2026-10-25', turno: null },
    ])

    renderConProveedores(<MiHorarioPage />, { ruta: '/my/schedule' })
    await screen.findByRole('heading', { name: 'Mi horario' })

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /imprimir/i }))

    await waitFor(() => expect(imprimir).toHaveBeenCalled())
    expect(screen.getByText('Mi horario semanal')).toBeInTheDocument()
    imprimir.mockRestore()
  })
})
