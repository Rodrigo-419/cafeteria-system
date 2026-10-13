import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { UsuariosPage } from './UsuariosPage'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import {
  BASE_API,
  PERMISOS_ADMIN,
  PERMISOS_GERENTE,
  usuarioDePrueba,
} from '@/test/handlers'
import { server } from '@/test/server'

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
  return renderConProveedores(<UsuariosPage />)
}

function renderComoGerente() {
  iniciarSesionDePrueba(
    usuarioDePrueba(PERMISOS_GERENTE, {
      id: 'usuario-1',
      nombre: 'Ada Pruebas',
      nombreUsuario: 'ada',
      rol: 'Gerente',
    }),
  )
  return renderConProveedores(<UsuariosPage />)
}

describe('Gestión de usuarios', () => {
  it('el Admin ve la columna Sucursal y usuarios de todas las sucursales', async () => {
    renderComoAdmin()

    expect(await screen.findByText('Beto Turno')).toBeInTheDocument()
    expect(screen.getByText('Ciro Ruiz')).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Sucursal' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Sucursal Norte').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sucursal Centro').length).toBeGreaterThan(0)
  })

  it('el Gerente solo ve Empleados de su sucursal, sin columna ni filtro de sucursal', async () => {
    renderComoGerente()

    expect(await screen.findByText('Beto Turno')).toBeInTheDocument()
    expect(screen.queryByText('Ciro Ruiz')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'Sucursal' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Sucursal')).not.toBeInTheDocument()
  })

  it('busca por nombre o nombre de usuario', async () => {
    renderComoAdmin()
    const user = userEvent.setup({ delay: null })
    await screen.findByText('Beto Turno')

    await user.type(screen.getByLabelText('Buscar'), 'beto')

    await waitFor(() =>
      expect(screen.queryByText('Ada Pruebas')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Beto Turno')).toBeInTheDocument()
    expect(screen.queryByText('Ciro Ruiz')).not.toBeInTheDocument()
  })

  it('el Admin crea un Empleado eligiendo la sucursal', async () => {
    renderComoAdmin()
    const user = userEvent.setup({ delay: null })
    await screen.findByText('Beto Turno')

    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))
    const dialogo = await screen.findByRole('dialog')
    await user.type(within(dialogo).getByLabelText('Nombre'), 'Diana Nueva')
    await user.type(
      within(dialogo).getByLabelText('Nombre de usuario'),
      'diana',
    )
    await user.click(within(dialogo).getByLabelText('Sucursal'))
    await user.click(
      await screen.findByRole('option', { name: 'Sucursal Norte' }),
    )
    await user.type(
      within(dialogo).getByLabelText('Contraseña'),
      'ContrasenaLarga123!',
    )
    await user.click(
      within(dialogo).getByRole('button', { name: 'Crear usuario' }),
    )

    expect(await screen.findByText('Diana Nueva')).toBeInTheDocument()
  })

  it('el Gerente crea un Empleado en su sucursal sin elegir rol ni sucursal', async () => {
    renderComoGerente()
    const user = userEvent.setup({ delay: null })
    await screen.findByText('Beto Turno')

    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).queryByLabelText('Rol')).not.toBeInTheDocument()
    expect(
      within(dialogo).queryByLabelText('Sucursal'),
    ).not.toBeInTheDocument()
    expect(within(dialogo).getByText('Empleado')).toBeInTheDocument()
    expect(within(dialogo).getByText('Sucursal Centro')).toBeInTheDocument()

    await user.type(within(dialogo).getByLabelText('Nombre'), 'Eric Nuevo')
    await user.type(
      within(dialogo).getByLabelText('Nombre de usuario'),
      'eric',
    )
    await user.type(
      within(dialogo).getByLabelText('Contraseña'),
      'ContrasenaLarga123!',
    )
    await user.click(
      within(dialogo).getByRole('button', { name: 'Crear usuario' }),
    )

    expect(await screen.findByText('Eric Nuevo')).toBeInTheDocument()
  })

  it('crear un Gerente exige elegir sucursal; un Admin no lleva sucursal', async () => {
    renderComoAdmin()
    const user = userEvent.setup({ delay: null })
    await screen.findByText('Beto Turno')

    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))
    const dialogo = await screen.findByRole('dialog')
    await user.type(within(dialogo).getByLabelText('Nombre'), 'Greta Gerente')
    await user.type(
      within(dialogo).getByLabelText('Nombre de usuario'),
      'greta',
    )
    await user.type(
      within(dialogo).getByLabelText('Contraseña'),
      'ContrasenaLarga123!',
    )

    await user.click(within(dialogo).getByLabelText('Rol'))
    await user.click(await screen.findByRole('option', { name: 'Gerente' }))
    expect(
      within(dialogo).getByRole('button', { name: 'Crear usuario' }),
    ).toBeDisabled()

    await user.click(within(dialogo).getByLabelText('Sucursal'))
    await user.click(
      await screen.findByRole('option', { name: 'Sucursal Centro' }),
    )
    expect(
      within(dialogo).getByRole('button', { name: 'Crear usuario' }),
    ).toBeEnabled()

    await user.click(within(dialogo).getByLabelText('Rol'))
    await user.click(await screen.findByRole('option', { name: 'Admin' }))
    expect(within(dialogo).getByLabelText('Sucursal')).toBeDisabled()
    expect(
      within(dialogo).getByRole('button', { name: 'Crear usuario' }),
    ).toBeEnabled()
  }, 15000)

  it('muestra el 409 de nombre de usuario repetido con el mensaje del servidor', async () => {
    renderComoAdmin()
    const user = userEvent.setup({ delay: null })
    await screen.findByText('Beto Turno')

    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))
    const dialogo = await screen.findByRole('dialog')
    await user.type(within(dialogo).getByLabelText('Nombre'), 'Otra Ada')
    await user.type(
      within(dialogo).getByLabelText('Nombre de usuario'),
      'ada',
    )
    await user.click(within(dialogo).getByLabelText('Sucursal'))
    await user.click(
      await screen.findByRole('option', { name: 'Sucursal Centro' }),
    )
    await user.type(
      within(dialogo).getByLabelText('Contraseña'),
      'ContrasenaLarga123!',
    )
    await user.click(
      within(dialogo).getByRole('button', { name: 'Crear usuario' }),
    )

    expect(await within(dialogo).findByText('No se pudo guardar'))
      .toBeInTheDocument()
    expect(
      within(dialogo).getByText('Ya existe un usuario con ese nombre de usuario'),
    ).toBeInTheDocument()
  })

  it('una contraseña corta deshabilita el alta', async () => {
    renderComoAdmin()
    const user = userEvent.setup({ delay: null })
    await screen.findByText('Beto Turno')

    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))
    const dialogo = await screen.findByRole('dialog')
    await user.type(within(dialogo).getByLabelText('Nombre'), 'Hugo Breve')
    await user.type(
      within(dialogo).getByLabelText('Nombre de usuario'),
      'hugo',
    )
    await user.click(within(dialogo).getByLabelText('Sucursal'))
    await user.click(
      await screen.findByRole('option', { name: 'Sucursal Centro' }),
    )
    await user.type(within(dialogo).getByLabelText('Contraseña'), 'corta')

    expect(
      within(dialogo).getByRole('button', { name: 'Crear usuario' }),
    ).toBeDisabled()
  })

  it('generar contraseña muestra una contraseña de 20 caracteres que no se persiste', async () => {
    const { queryClient } = renderComoAdmin()
    const user = userEvent.setup({ delay: null })
    await screen.findByText('Beto Turno')

    await user.click(screen.getByRole('button', { name: 'Crear usuario' }))
    const dialogo = await screen.findByRole('dialog')
    await user.type(within(dialogo).getByLabelText('Nombre'), 'Iris Genérica')
    await user.type(
      within(dialogo).getByLabelText('Nombre de usuario'),
      'iris',
    )
    await user.click(within(dialogo).getByLabelText('Sucursal'))
    await user.click(
      await screen.findByRole('option', { name: 'Sucursal Centro' }),
    )

    await user.click(
      within(dialogo).getByRole('button', { name: 'Generar contraseña' }),
    )
    const revelada = document.getElementById(
      'usuario-password-generada',
    ) as HTMLInputElement
    const contrasena = revelada.value
    expect(contrasena.length).toBe(20)
    expect(
      within(dialogo).getByText('Contraseña de un solo uso'),
    ).toBeInTheDocument()

    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const valoresEn = (almacen: Storage) =>
      Array.from({ length: almacen.length }, (_, indice) => almacen.key(indice))
        .filter((clave): clave is string => clave !== null)
        .some((clave) => almacen.getItem(clave)?.includes(contrasena) ?? false)
    expect(valoresEn(sessionStorage)).toBe(false)
    expect(valoresEn(localStorage)).toBe(false)

    const clavesCache = queryClient
      .getQueryCache()
      .getAll()
      .map((consulta) => JSON.stringify(consulta.queryKey))
    expect(clavesCache.some((clave) => clave.includes(contrasena))).toBe(false)
  })

  it('la propia fila no ofrece Permisos ni Bloquear, pero sí Editar', async () => {
    renderComoAdmin()

    await screen.findByText('Administrador')
    const filaPropia = screen.getByText('Administrador').closest(
      'tr',
    ) as HTMLElement
    expect(
      within(filaPropia).queryByRole('button', { name: 'Permisos' }),
    ).not.toBeInTheDocument()
    expect(
      within(filaPropia).queryByRole('button', { name: 'Bloquear' }),
    ).not.toBeInTheDocument()
    expect(
      within(filaPropia).getByRole('button', { name: 'Editar' }),
    ).toBeInTheDocument()
    expect(within(filaPropia).getByText('—')).toBeInTheDocument()

    const filaBeto = screen.getByText('Beto Turno').closest('tr') as HTMLElement
    expect(
      within(filaBeto).getByRole('button', { name: 'Permisos' }),
    ).toBeInTheDocument()
    expect(
      within(filaBeto).getByRole('button', { name: 'Bloquear' }),
    ).toBeInTheDocument()
  })

  it('el Admin edita rol y sucursal de un Empleado', async () => {
    renderComoAdmin()
    const user = userEvent.setup({ delay: null })
    await screen.findByText('Beto Turno')

    const filaBeto = screen.getByText('Beto Turno').closest('tr') as HTMLElement
    await user.click(within(filaBeto).getByRole('button', { name: 'Editar' }))
    const dialogo = await screen.findByRole('dialog')

    await user.click(within(dialogo).getByLabelText('Rol'))
    await user.click(await screen.findByRole('option', { name: 'Gerente' }))
    await user.click(within(dialogo).getByLabelText('Sucursal'))
    await user.click(
      await screen.findByRole('option', { name: 'Sucursal Norte' }),
    )
    await user.click(
      within(dialogo).getByRole('button', { name: 'Guardar cambios' }),
    )

    const filaActualizada = (await screen.findByText('Beto Turno')).closest(
      'tr',
    ) as HTMLElement
    await waitFor(() =>
      expect(
        within(filaActualizada).getByText('Sucursal Norte'),
      ).toBeInTheDocument(),
    )
  })

  it('bloquear a un Empleado confirma y cambia su estado en la tabla', async () => {
    renderComoAdmin()
    const user = userEvent.setup({ delay: null })
    await screen.findByText('Beto Turno')

    const filaBeto = screen.getByText('Beto Turno').closest('tr') as HTMLElement
    await user.click(within(filaBeto).getByRole('button', { name: 'Bloquear' }))
    const confirmacion = await screen.findByRole('alertdialog')
    await user.click(
      within(confirmacion).getByRole('button', { name: 'Bloquear' }),
    )

    await waitFor(() =>
      expect(within(filaBeto).getByText('Bloqueado')).toBeInTheDocument(),
    )
    expect(
      within(filaBeto).getByRole('button', { name: 'Activar' }),
    ).toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay usuarios en el alcance', async () => {
    server.use(
      http.get(`${BASE_API}/users`, () =>
        HttpResponse.json({
          data: [],
          total: 0,
          page: 1,
          limit: 10,
          totalPaginas: 0,
        }),
      ),
    )
    renderComoAdmin()

    expect(await screen.findByText('Sin usuarios')).toBeInTheDocument()
  })

  it('muestra el estado de error si falla el listado', async () => {
    server.use(
      http.get(`${BASE_API}/users`, () =>
        HttpResponse.json({ message: 'Fallo de carga' }, { status: 500 }),
      ),
    )
    renderComoAdmin()

    expect(await screen.findByText('Error al cargar datos')).toBeInTheDocument()
    expect(screen.getByText('Fallo de carga')).toBeInTheDocument()
  })

  it('muestra el estado de carga mientras llega el listado', async () => {
    server.use(http.get(`${BASE_API}/users`, () => new Promise(() => {})))
    renderComoAdmin()

    await waitFor(() =>
      expect(
        document.querySelectorAll('[data-slot="skeleton"]').length,
      ).toBeGreaterThan(0),
    )
  })
})
