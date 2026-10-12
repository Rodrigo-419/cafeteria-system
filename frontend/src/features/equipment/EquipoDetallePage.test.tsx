import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { EquipoDetallePage } from './EquipoDetallePage'
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
      <Route path="/equipment/:id" element={<EquipoDetallePage />} />
    </Routes>,
    { ruta: `/equipment/${id}` },
  )
}

describe('Detalle de equipo', () => {
  it('muestra los datos del equipo y su historial', async () => {
    renderDetalle('equipo-2')

    expect(
      await screen.findByRole('heading', { name: 'Molino' }),
    ).toBeInTheDocument()
    expect(
      (await screen.findAllByText('Revisión programada')).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Ada Pruebas/).length,
    ).toBeGreaterThan(0)
  })

  it('registra el cambio de estado y observaciones en el historial', async () => {
    renderDetalle('equipo-2')
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: 'Molino' })

    await user.click(screen.getByRole('button', { name: 'Cambiar estado' }))
    const dialogo = await screen.findByRole('alertdialog')
    await user.click(within(dialogo).getByLabelText('Nuevo estado'))
    await user.click(await screen.findByRole('option', { name: 'Funcionando' }))
    const observaciones = within(dialogo).getByLabelText(
      'Observaciones (opcional)',
    )
    await user.clear(observaciones)
    await user.type(observaciones, 'Cambio de prueba')
    await user.click(
      within(dialogo).getByRole('button', { name: 'Confirmar cambio' }),
    )

    await waitFor(() =>
      expect(screen.getAllByText('Cambio de prueba').length).toBeGreaterThan(1),
    )
  })

  it('no ofrece cambiar el estado de un equipo retirado, pero sí editarlo', async () => {
    renderDetalle('equipo-4')

    expect(
      await screen.findByRole('heading', { name: 'Licuadora industrial' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Cambiar estado' }),
    ).not.toBeInTheDocument()
  })

  it('no muestra acciones de edición al usuario sin permiso', async () => {
    iniciarSesionDePrueba(
      usuarioDePrueba(['equipo.ver'], {
        rol: 'Empleado',
        sucursalId: 'sucursal-1',
      }),
    )
    renderConProveedores(
      <Routes>
        <Route path="/equipment/:id" element={<EquipoDetallePage />} />
      </Routes>,
      { ruta: '/equipment/equipo-1' },
    )

    expect(
      await screen.findByRole('heading', { name: 'Máquina de espresso' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Cambiar estado' }),
    ).not.toBeInTheDocument()
  })

  it('muestra error cuando el equipo está fuera del alcance', async () => {
    renderDetalle('equipo-5', 'gerente')

    expect(
      await screen.findByText('No se pudo cargar el equipo'),
    ).toBeInTheDocument()
  })
})
