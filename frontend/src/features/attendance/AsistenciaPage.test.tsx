import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { AsistenciaPage } from './AsistenciaPage'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import {
  BASE_API,
  PERMISOS_ADMIN,
  PERMISOS_EMPLEADO,
  PERMISOS_GERENTE,
  usuarioDePrueba,
} from '@/test/handlers'
import { server } from '@/test/server'

function renderComoGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  return renderConProveedores(<AsistenciaPage />)
}

// Empleado real (con registros y faltas propias): en las fixtures el `empleadoId`
// coincide con el id del usuario, igual que en el alcance del backend.
const EMPLEADO_BETO = usuarioDePrueba(PERMISOS_EMPLEADO, {
  id: 'usuario-2',
  nombre: 'Beto Turno',
  rol: 'Empleado',
})

async function seleccionarEstado(
  user: ReturnType<typeof userEvent.setup>,
  etiqueta: string,
) {
  await user.click(screen.getByRole('combobox'))
  await user.click(await screen.findByRole('option', { name: etiqueta }))
}

describe('Página de asistencia', () => {
  it('lista los registros de la sucursal del gerente y oculta otras sucursales', async () => {
    renderComoGerente()

    expect(await screen.findByText('Dora Nueva')).toBeInTheDocument()
    expect(screen.getAllByText('Beto Turno').length).toBeGreaterThan(0)
    expect(screen.queryByText('Ciro Ruiz')).not.toBeInTheDocument()
  })

  it('muestra el acceso al terminal cuando hay permiso y sucursal', async () => {
    renderComoGerente()

    expect(
      await screen.findByRole('link', { name: 'Ir al terminal' }),
    ).toBeInTheDocument()
  })

  it('filtra para mostrar solo los registros abiertos', async () => {
    const user = userEvent.setup()
    renderComoGerente()

    expect(await screen.findByText('Cerrada')).toBeInTheDocument()

    await seleccionarEstado(user, 'Solo abiertas')

    await waitFor(() =>
      expect(screen.queryByText('Cerrada')).not.toBeInTheDocument(),
    )
  })

  it('vacía la tabla cuando el rango de fechas no tiene registros', async () => {
    renderComoGerente()
    await screen.findByText('Dora Nueva')

    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2030-01-01' },
    })

    expect(await screen.findByText('Sin registros')).toBeInTheDocument()
  })

  it('abre el historial del registro y avisa que no hay correcciones', async () => {
    const user = userEvent.setup()
    renderComoGerente()
    await screen.findByText('Dora Nueva')

    await user.click(screen.getAllByRole('button', { name: 'Historial' })[0])

    expect(
      await screen.findByRole('heading', { name: 'Historial del registro' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Este registro no tiene correcciones.'),
    ).toBeInTheDocument()
  })

  it('corrige un registro con motivo y refleja la corrección en la tabla', async () => {
    const user = userEvent.setup()
    renderComoGerente()
    await screen.findByText('Dora Nueva')

    await user.click(screen.getAllByRole('button', { name: 'Corregir' })[0])

    const guardar = await screen.findByRole('button', {
      name: 'Guardar corrección',
    })
    expect(guardar).toBeDisabled()

    await user.type(screen.getByLabelText('Motivo'), 'Olvido de registro')
    expect(guardar).toBeEnabled()
    await user.click(guardar)

    expect(await screen.findByText('Corregida')).toBeInTheDocument()
  })

  it('muestra el error del servidor al fallar la corrección', async () => {
    server.use(
      http.post(`${BASE_API}/attendance/records/:id/correct`, () =>
        HttpResponse.json(
          { statusCode: 403, message: 'Solo un gerente puede corregir' },
          { status: 403 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderComoGerente()
    await screen.findByText('Dora Nueva')

    await user.click(screen.getAllByRole('button', { name: 'Corregir' })[0])
    await user.type(await screen.findByLabelText('Motivo'), 'Prueba')
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }))

    expect(
      await screen.findByText('Solo un gerente puede corregir'),
    ).toBeInTheDocument()
  })

  it('muestra el 403 del servidor al intentar corregir un registro propio', async () => {
    // El registro no expone el usuario dueño, así que la interfaz ofrece la
    // acción y es el backend quien la rechaza con su mensaje.
    const user = userEvent.setup()
    iniciarSesionDePrueba(
      usuarioDePrueba(PERMISOS_GERENTE, {
        id: 'usuario-2',
        nombre: 'Beto Turno',
        rol: 'Gerente',
      }),
    )
    renderConProveedores(<AsistenciaPage />)
    await screen.findAllByText('Beto Turno')

    await user.click(screen.getAllByRole('button', { name: 'Corregir' })[0])
    await user.type(
      await screen.findByLabelText('Motivo'),
      'Intento de corrección propia',
    )
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }))

    expect(
      await screen.findByText('No puedes corregir tus propios registros'),
    ).toBeInTheDocument()
  })

  it('un Empleado solo ve sus propios registros', async () => {
    iniciarSesionDePrueba(EMPLEADO_BETO)
    renderConProveedores(<AsistenciaPage />)

    expect((await screen.findAllByText('Beto Turno')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Dora Nueva')).not.toBeInTheDocument()
    expect(screen.queryByText('Ciro Ruiz')).not.toBeInTheDocument()
  })

  it('no ofrece corregir a quien solo puede ver registros', async () => {
    iniciarSesionDePrueba(EMPLEADO_BETO)
    renderConProveedores(<AsistenciaPage />)

    expect((await screen.findAllByText('Beto Turno')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Dora Nueva')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Corregir' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'Historial' }).length,
    ).toBeGreaterThan(0)
  })

  it('el admin sin sucursal ve todos los registros pero no el terminal', async () => {
    iniciarSesionDePrueba(
      usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
    )
    renderConProveedores(<AsistenciaPage />)

    expect(await screen.findByText('Ciro Ruiz')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Ir al terminal' }),
    ).not.toBeInTheDocument()
    // El Admin no tiene `asistencia.corregir`: nunca ve la acción de corregir.
    expect(
      screen.queryByRole('button', { name: 'Corregir' }),
    ).not.toBeInTheDocument()
  })

  it('lista las faltas del rango y permite justificarlas', async () => {
    const user = userEvent.setup()
    renderComoGerente()

    await user.click(await screen.findByRole('tab', { name: 'Faltas' }))

    expect(await screen.findByText('Beto Turno')).toBeInTheDocument()
    expect(screen.getByText('Dora Nueva')).toBeInTheDocument()
    expect(
      screen.getAllByText('Turno fijo · Lun, Mar, Mié, Jue, Vie').length,
    ).toBeGreaterThan(0)

    await user.click(screen.getAllByRole('button', { name: 'Justificar' })[0])
    const dialogo = within(await screen.findByRole('dialog'))
    await user.type(
      dialogo.getByLabelText('Motivo'),
      'Permiso médico presentado',
    )
    await user.click(dialogo.getByRole('button', { name: 'Justificar' }))

    await waitFor(() =>
      expect(screen.queryByText('Beto Turno')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Dora Nueva')).toBeInTheDocument()
  })

  it('no ofrece justificar a quien solo puede ver registros', async () => {
    const user = userEvent.setup()
    iniciarSesionDePrueba(EMPLEADO_BETO)
    renderConProveedores(<AsistenciaPage />)

    await user.click(await screen.findByRole('tab', { name: 'Faltas' }))

    expect(await screen.findByText('Beto Turno')).toBeInTheDocument()
    expect(screen.queryByText('Dora Nueva')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Justificar' }),
    ).not.toBeInTheDocument()
  })
})
