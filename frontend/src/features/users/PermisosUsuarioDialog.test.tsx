import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { UsuariosPage } from './UsuariosPage'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import {
  BASE_API,
  PERMISOS_ADMIN,
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

async function abrirPermisos(
  user: ReturnType<typeof userEvent.setup>,
  nombre: string,
): Promise<HTMLElement> {
  await screen.findByText(nombre)
  const fila = screen.getByText(nombre).closest('tr') as HTMLElement
  await user.click(within(fila).getByRole('button', { name: 'Permisos' }))
  const dialogo = await screen.findByRole('dialog')
  expect(within(dialogo).getByText(`Permisos de ${nombre}`)).toBeInTheDocument()
  return dialogo
}

/** Devuelve la fila (div) de un permiso dentro de la lista del diálogo. */
function filaDelPermiso(descripcion: string): HTMLElement {
  const contenedor = screen.getByText(descripcion).closest('div')
  return (contenedor?.parentElement ?? null) as HTMLElement
}

describe('Permisos de un usuario', () => {
  it('muestra un permiso revocado como Inactivo y permite restablecerlo', async () => {
    const user = userEvent.setup({ delay: null })
    renderComoAdmin()
    await abrirPermisos(user, 'Beto Turno')

    await screen.findByText('Ver productos')
    const fila = filaDelPermiso('Ver productos')
    expect(within(fila).getByText('Revocado')).toBeInTheDocument()
    expect(within(fila).getByText('Inactivo')).toBeInTheDocument()

    expect(
      within(fila).getByRole('button', { name: 'Restablecer' }),
    ).toBeEnabled()
    expect(
      within(fila).queryByRole('button', { name: 'Conceder' }),
    ).toBeNull()
  })

  it('quita una concesión y vuelve al valor que da el rol', async () => {
    const user = userEvent.setup({ delay: null })
    let tipo: 'concedido' | null = 'concedido'
    server.use(
      http.get(`${BASE_API}/users/usuario-1/permisos`, () =>
        HttpResponse.json([
          {
            permisoId: 'perm-inventario-recuento',
            codigo: 'inventario.recuento',
            descripcion: 'Registrar recuentos de inventario',
            origen: tipo === 'concedido' ? 'concedido' : 'rol',
            efectivo: true,
          },
        ]),
      ),
      http.delete(`${BASE_API}/users/usuario-1/permisos/:permisoId`, () => {
        tipo = null
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderComoAdmin()
    await abrirPermisos(user, 'Ada Pruebas')

    await screen.findByText('Registrar recuentos de inventario')
    const fila = filaDelPermiso('Registrar recuentos de inventario')
    expect(within(fila).getByText('Concedido')).toBeInTheDocument()

    await user.click(within(fila).getByRole('button', { name: 'Quitar' }))
    await waitFor(() =>
      expect(within(fila).getByRole('button')).toHaveTextContent('Revocar'),
    )
    expect(within(fila).getByText('Del rol')).toBeInTheDocument()
  })

  it('restablece un permiso revocado y luego puede volver a revocarlo', async () => {
    const user = userEvent.setup({ delay: null })
    renderComoAdmin()
    await abrirPermisos(user, 'Ada Pruebas')

    await screen.findByText('Registrar recuentos de inventario')
    const fila = filaDelPermiso('Registrar recuentos de inventario')
    expect(within(fila).getByText('Revocado')).toBeInTheDocument()
    expect(within(fila).getByText('Inactivo')).toBeInTheDocument()

    await user.click(within(fila).getByRole('button', { name: 'Restablecer' }))
    await waitFor(() =>
      expect(within(fila).getByRole('button')).toHaveTextContent('Revocar'),
    )
    expect(within(fila).getByText('Del rol')).toBeInTheDocument()
    expect(within(fila).getByText('Activo')).toBeInTheDocument()

    await user.click(within(fila).getByRole('button', { name: 'Revocar' }))
    await waitFor(() =>
      expect(within(fila).getByRole('button')).toHaveTextContent('Restablecer'),
    )
    expect(within(fila).getByText('Revocado')).toBeInTheDocument()
    expect(within(fila).getByText('Inactivo')).toBeInTheDocument()
  })

  it('revoca un permiso que el rol otorga por defecto', async () => {
    const user = userEvent.setup({ delay: null })
    renderComoAdmin()
    await abrirPermisos(user, 'Ada Pruebas')

    await screen.findByText('Crear y editar usuarios')
    const fila = filaDelPermiso('Crear y editar usuarios')
    expect(within(fila).getByText('Del rol')).toBeInTheDocument()
    expect(within(fila).getByText('Activo')).toBeInTheDocument()

    await user.click(within(fila).getByRole('button', { name: 'Revocar' }))
    await waitFor(() =>
      expect(within(fila).getByRole('button')).toHaveTextContent('Restablecer'),
    )
    expect(within(fila).getByText('Revocado')).toBeInTheDocument()
    expect(within(fila).getByText('Inactivo')).toBeInTheDocument()
  })

  it('no permite revocar un permiso que el actor no posee', async () => {
    const user = userEvent.setup({ delay: null })
    renderComoAdmin()
    await abrirPermisos(user, 'Ada Pruebas')

    await screen.findByText('Registrar ventas')
    const fila = filaDelPermiso('Registrar ventas')
    const boton = within(fila).getByRole('button', { name: 'Revocar' })
    expect(boton).toBeDisabled()
    expect(boton).toHaveAttribute(
      'title',
      'No puedes revocar un permiso que no posees.',
    )
  })

  it('muestra el error del listado de permisos con reintentar', async () => {
    server.use(
      http.get(`${BASE_API}/users/usuario-2/permisos`, () =>
        HttpResponse.json({ message: 'Fallo de permisos' }, { status: 500 }),
      ),
    )
    const user = userEvent.setup({ delay: null })
    renderComoAdmin()

    await abrirPermisos(user, 'Beto Turno')
    expect(
      await screen.findByText('No se pudieron cargar los permisos'),
    ).toBeInTheDocument()
    expect(screen.getByText('Fallo de permisos')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument()
  })

  it('avisa cuando el usuario no tiene permisos asignables', async () => {
    server.use(
      http.get(`${BASE_API}/users/usuario-3/permisos`, () =>
        HttpResponse.json([]),
      ),
    )
    const user = userEvent.setup({ delay: null })
    renderComoAdmin()

    await abrirPermisos(user, 'Ciro Ruiz')
    expect(
      await screen.findByText('Este usuario no tiene permisos asignables.'),
    ).toBeInTheDocument()
  })
})
