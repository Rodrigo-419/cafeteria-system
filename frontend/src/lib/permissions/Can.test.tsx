import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderConProveedores, iniciarSesionDePrueba } from '@/test/render'
import type { UsuarioApi } from '@/types/api'
import { Can } from './Can'

function usuarioCon(permisos: string[]): UsuarioApi {
  return {
    id: 'u-1',
    nombre: 'Ada',
    nombreUsuario: 'ada',
    rol: 'Gerente',
    sucursalId: null,
    permisos,
  }
}

describe('<Can>', () => {
  it('muestra los hijos cuando el usuario tiene el permiso', () => {
    iniciarSesionDePrueba(usuarioCon(['ventas.ver']))

    renderConProveedores(
      <Can permiso="ventas.ver">
        <span>contenido</span>
      </Can>,
    )

    expect(screen.getByText('contenido')).toBeInTheDocument()
  })

  it('oculta el contenido y muestra el fallback cuando no tiene permiso', () => {
    iniciarSesionDePrueba(usuarioCon([]))

    renderConProveedores(
      <Can permiso="ventas.ver" fallback={<span>sin acceso</span>}>
        <span>contenido</span>
      </Can>,
    )

    expect(screen.queryByText('contenido')).not.toBeInTheDocument()
    expect(screen.getByText('sin acceso')).toBeInTheDocument()
  })

  it('con modo "any" basta con uno de los permisos', () => {
    iniciarSesionDePrueba(usuarioCon(['productos.ver']))

    renderConProveedores(
      <Can permiso={['ventas.ver', 'productos.ver']} modo="any">
        <span>ok</span>
      </Can>,
    )

    expect(screen.getByText('ok')).toBeInTheDocument()
  })

  it('con modo "all" exige todos los permisos', () => {
    iniciarSesionDePrueba(usuarioCon(['productos.ver']))

    renderConProveedores(
      <Can permiso={['ventas.ver', 'productos.ver']}>
        <span>ok</span>
      </Can>,
    )

    expect(screen.queryByText('ok')).not.toBeInTheDocument()
  })
})
