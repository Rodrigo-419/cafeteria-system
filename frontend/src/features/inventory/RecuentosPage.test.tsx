import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RecuentosPage } from './RecuentosPage'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import {
  PERMISOS_ADMIN,
  PERMISOS_GERENTE,
  usuarioDePrueba,
} from '@/test/handlers'

function renderComoGerente(permisos = PERMISOS_GERENTE) {
  iniciarSesionDePrueba(usuarioDePrueba(permisos))
  return renderConProveedores(<RecuentosPage />)
}

function renderComoAdmin() {
  iniciarSesionDePrueba(
    usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
  )
  return renderConProveedores(<RecuentosPage />)
}

describe('Historial de recuentos', () => {
  it('abre el detalle con el usuario, la sucursal y las diferencias', async () => {
    renderComoGerente()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Ver detalle' }))

    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Ada Pruebas')).toBeInTheDocument()
    expect(within(dialogo).getByText('Sucursal Centro')).toBeInTheDocument()
    expect(within(dialogo).getByText('Café en grano')).toBeInTheDocument()
    expect(within(dialogo).getByText('-1')).toBeInTheDocument()
    expect(within(dialogo).getByText('Disminución')).toBeInTheDocument()
  })

  it('el Admin ve la columna de sucursal', async () => {
    renderComoAdmin()

    expect(
      await screen.findByRole('columnheader', { name: 'Sucursal' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sucursal Centro')).toBeInTheDocument()
  })

  it('oculta las acciones al usuario sin permiso de recuento', async () => {
    renderComoGerente(['ventas.ver'])

    expect(await screen.findByText('Sin recuentos')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Nuevo recuento' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Ver detalle' }),
    ).not.toBeInTheDocument()
  })
})
