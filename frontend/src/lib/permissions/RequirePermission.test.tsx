import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { RequirePermission } from './RequirePermission'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import type { UsuarioApi } from '@/types/api'

function usuarioCon(permisos: string[]): UsuarioApi {
  return {
    id: 'u-1',
    nombre: 'Prueba Permisos',
    nombreUsuario: 'permisos',
    rol: 'Gerente',
    sucursalId: 'sucursal-1',
    permisos,
  }
}

function rutaCon(children: React.ReactNode) {
  return (
    <Routes>
      <Route path="/modulo" element={children} />
      <Route path="/login" element={<div>Pantalla de login</div>} />
    </Routes>
  )
}

describe('RequirePermission', () => {
  it('muestra el contenido cuando el usuario tiene el permiso', async () => {
    iniciarSesionDePrueba(usuarioCon(['productos.ver']))
    renderConProveedores(
      rutaCon(
        <RequirePermission permiso="productos.ver">
          <div>Contenido permitido</div>
        </RequirePermission>,
      ),
      { ruta: '/modulo' },
    )

    expect(await screen.findByText('Contenido permitido')).toBeInTheDocument()
  })

  it('muestra 403 cuando falta el permiso', async () => {
    iniciarSesionDePrueba(usuarioCon(['productos.ver']))
    renderConProveedores(
      rutaCon(
        <RequirePermission permiso="reportes.comparativos.ver">
          <div>Contenido permitido</div>
        </RequirePermission>,
      ),
      { ruta: '/modulo' },
    )

    expect(await screen.findByText(/Acceso denegado/)).toBeInTheDocument()
    expect(screen.queryByText('Contenido permitido')).not.toBeInTheDocument()
  })

  it('redirige al login cuando no hay sesión', async () => {
    renderConProveedores(
      rutaCon(
        <RequirePermission permiso="productos.ver">
          <div>Contenido permitido</div>
        </RequirePermission>,
      ),
      { ruta: '/modulo' },
    )

    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument()
  })

  it('con modo "any" basta con uno de los permisos', async () => {
    iniciarSesionDePrueba(usuarioCon(['ventas.anular']))
    renderConProveedores(
      rutaCon(
        <RequirePermission permiso={['ventas.ver', 'ventas.anular']} modo="any">
          <div>Contenido permitido</div>
        </RequirePermission>,
      ),
      { ruta: '/modulo' },
    )

    expect(await screen.findByText('Contenido permitido')).toBeInTheDocument()
  })

  it('con modo "all" exige todos los permisos', async () => {
    iniciarSesionDePrueba(usuarioCon(['ventas.ver']))
    renderConProveedores(
      rutaCon(
        <RequirePermission permiso={['ventas.ver', 'ventas.anular']} modo="all">
          <div>Contenido permitido</div>
        </RequirePermission>,
      ),
      { ruta: '/modulo' },
    )

    expect(await screen.findByText(/Acceso denegado/)).toBeInTheDocument()
  })
})
