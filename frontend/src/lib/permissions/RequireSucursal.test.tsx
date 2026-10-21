// Pruebas del guard RequireSucursal.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderConProveedores, iniciarSesionDePrueba } from '@/test/render'
import { RequireSucursal } from './RequireSucursal'
import { usuarioDePrueba } from '@/test/handlers'

describe('RequireSucursal', () => {
  it('muestra el contenido cuando el usuario tiene sucursal', () => {
    const usuario = usuarioDePrueba(['asistencia.ver'], { sucursalId: 'suc-1' })
    iniciarSesionDePrueba(usuario)

    renderConProveedores(
      <RequireSucursal>
        <span>contenido-protegido</span>
      </RequireSucursal>,
    )

    expect(screen.getByText('contenido-protegido')).toBeInTheDocument()
  })

  it('muestra Forbidden cuando el usuario no tiene sucursal', () => {
    const usuario = usuarioDePrueba([], { sucursalId: null })
    iniciarSesionDePrueba(usuario)

    renderConProveedores(
      <RequireSucursal>
        <span>contenido-protegido</span>
      </RequireSucursal>,
    )

    expect(screen.queryByText('contenido-protegido')).not.toBeInTheDocument()
    expect(screen.getByText(/acceso denegado/i)).toBeInTheDocument()
  })
})
