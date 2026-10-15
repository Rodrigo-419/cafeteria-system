import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { EmpleadoDetallePage } from './EmpleadoDetallePage'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import {
  PERMISOS_ADMIN,
  PERMISOS_GERENTE,
  usuarioDePrueba,
} from '@/test/handlers'

function renderDetalle(id: string, como: 'admin' | 'gerente' = 'admin') {
  if (como === 'admin') {
    iniciarSesionDePrueba(
      usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
    )
  } else {
    iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  }
  return renderConProveedores(
    <Routes>
      <Route path="/employees/:id" element={<EmpleadoDetallePage />} />
    </Routes>,
    { ruta: `/employees/${id}` },
  )
}

describe('Detalle de empleado', () => {
  it('muestra los datos del empleado y sus acciones de gestión', async () => {
    renderDetalle('empleado-2')

    expect(
      await screen.findByRole('heading', { name: 'Beto Turno' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/@beto · Barista/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Editar cargo' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Generar PIN' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cesar' })).toBeInTheDocument()
  })

  it('un empleado cesado conserva datos pero no ofrece cese ni PIN', async () => {
    renderDetalle('empleado-3')

    expect(
      await screen.findByRole('heading', { name: 'Ciro Ruiz' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Cesado')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Editar cargo' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Generar PIN' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Cesar' }),
    ).not.toBeInTheDocument()
  })

  it('muestra error cuando el empleado está fuera del alcance', async () => {
    renderDetalle('empleado-1', 'gerente')

    expect(
      await screen.findByText('No se pudo cargar el empleado'),
    ).toBeInTheDocument()
  })
})
