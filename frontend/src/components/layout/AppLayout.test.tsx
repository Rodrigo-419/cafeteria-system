import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppLayout } from './AppLayout'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import {
  PERMISOS_ADMIN,
  PERMISOS_GERENTE,
  usuarioDePrueba,
} from '@/test/handlers'

function renderLayout(
  ruta: string,
  permisos: string[],
  opciones: { nombre?: string; rol?: string; sucursalId?: string | null } = {},
) {
  iniciarSesionDePrueba(
    usuarioDePrueba(permisos, {
      nombre: opciones.nombre ?? 'Ada Pruebas',
      rol: opciones.rol ?? 'Gerente',
      sucursalId:
        opciones.sucursalId === undefined
          ? 'sucursal-1'
          : opciones.sucursalId,
    }),
  )
  return renderConProveedores(
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="*" element={<p>Contenido de la pantalla</p>} />
      </Route>
    </Routes>,
    { ruta },
  )
}

describe('AppLayout: cabecera y menú agrupado', () => {
  it('muestra el nombre y una etiqueta de rol, sin la repetición "— Admin"', async () => {
    renderLayout('/', PERMISOS_ADMIN, {
      nombre: 'Administrador',
      rol: 'Admin',
      sucursalId: null,
    })

    expect(await screen.findByText('Administrador')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.queryByText('Administrador — Admin')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/—\s*Admin/),
    ).not.toBeInTheDocument()
  })

  it('conserva el cierre de sesión en el menú de cuenta', async () => {
    renderLayout('/', PERMISOS_ADMIN, {
      nombre: 'Administrador',
      rol: 'Admin',
      sucursalId: null,
    })
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: /Administrador/ }),
    )
    expect(
      await screen.findByRole('menuitem', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument()
  })

  it('no pinta grupos sin entradas visibles', async () => {
    renderLayout('/shifts', ['turnos.editar'])

    expect(await screen.findByText('PERSONAL')).toBeInTheDocument()
    expect(screen.queryByText('OPERACIÓN')).not.toBeInTheDocument()
    expect(screen.queryByText('ADMINISTRACIÓN')).not.toBeInTheDocument()
    const menu = screen.getByRole('navigation', {
      name: 'Navegación principal',
    })
    expect(within(menu).getByRole('link', { name: 'Turnos' })).toBeInTheDocument()
    expect(
      within(menu).getByRole('link', { name: 'Mi horario' }),
    ).toBeInTheDocument()
  })

  it('el menú móvil cierra desde dentro del panel y repite los grupos', async () => {
    renderLayout('/sales', PERMISOS_ADMIN, {
      nombre: 'Administrador',
      rol: 'Admin',
      sucursalId: null,
    })
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', { name: 'Abrir menú' }),
    )

    const panel = await screen.findByRole('dialog')
    expect(within(panel).getByText('OPERACIÓN')).toBeInTheDocument()
    expect(
      within(panel).getByRole('link', { name: 'Ventas' }),
    ).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('AppLayout: subnavegación del grupo', () => {
  it('solo muestra las pestañas permitidas y marca la actual con aria-current', async () => {
    renderLayout('/inventory', [
      'inventario.recuento',
      'alertas.ver_resolver',
    ])

    const subnav = await screen.findByRole('navigation', {
      name: 'Subnavegación de Inventario',
    })
    expect(within(subnav).getByRole('link', { name: 'Stock' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(
      within(subnav).getByRole('link', { name: 'Recuentos' }),
    ).toBeInTheDocument()
    expect(
      within(subnav).getByRole('link', { name: 'Alertas' }),
    ).toBeInTheDocument()
    expect(
      within(subnav).queryByRole('link', { name: 'Insumos' }),
    ).not.toBeInTheDocument()
    expect(
      within(subnav).queryByRole('link', { name: 'Movimientos' }),
    ).not.toBeInTheDocument()
  })

  it('no se muestra si el usuario solo tiene una subpágina accesible', async () => {
    renderLayout('/alerts', ['alertas.ver_resolver'])

    expect(
      await screen.findByRole('link', { name: 'Inventario' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Subnavegación de Inventario' }),
    ).not.toBeInTheDocument()
  })

  it('marca la pestaña de la carta de productos según la URL', async () => {
    renderLayout('/products?vista=carta', PERMISOS_GERENTE)

    const subnav = await screen.findByRole('navigation', {
      name: 'Subnavegación de Productos',
    })
    expect(
      within(subnav).getByRole('link', { name: 'Carta por sucursal' }),
    ).toHaveAttribute('aria-current', 'page')
    expect(
      within(subnav).getByRole('link', { name: 'Catálogo' }),
    ).not.toHaveAttribute('aria-current')
  })

  it('muestra todas las vistas de turnos para quien puede editarlos', async () => {
    renderLayout('/shifts/calendario-horas', PERMISOS_GERENTE)

    const subnav = await screen.findByRole('navigation', {
      name: 'Subnavegación de Turnos',
    })
    for (const etiqueta of [
      'Turnos',
      'Asignaciones',
      'Calendario de turnos',
      'Calendario por horas',
    ]) {
      expect(
        within(subnav).getByRole('link', { name: etiqueta }),
      ).toBeInTheDocument()
    }
    expect(
      within(subnav).getByRole('link', { name: 'Calendario por horas' }),
    ).toHaveAttribute('aria-current', 'page')
  })
})
