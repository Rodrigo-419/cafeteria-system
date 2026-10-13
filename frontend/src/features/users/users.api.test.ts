import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import {
  actualizarUsuario,
  asignarPermisoUsuario,
  cambiarEstadoUsuario,
  crearUsuario,
  eliminarPermisoUsuario,
  listarPermisosUsuario,
  listarUsuarios,
  obtenerUsuario,
} from '@/lib/api/users'
import { iniciarSesionDePrueba } from '@/test/render'
import {
  PERMISOS_ADMIN,
  PERMISOS_GERENTE,
  usuarioDePrueba,
} from '@/test/handlers'

function sesionAdmin() {
  iniciarSesionDePrueba(
    usuarioDePrueba(PERMISOS_ADMIN, {
      id: 'admin-1',
      nombre: 'Administrador',
      nombreUsuario: 'admin',
      rol: 'Admin',
      sucursalId: null,
    }),
  )
}

function sesionGerente() {
  iniciarSesionDePrueba(
    usuarioDePrueba(PERMISOS_GERENTE, {
      id: 'usuario-1',
      nombre: 'Ada Pruebas',
      nombreUsuario: 'ada',
      rol: 'Gerente',
    }),
  )
}

function idDePermiso(codigo: string): string {
  return `perm-${codigo.replace(/\./g, '-')}`
}

async function capturar(promesa: Promise<unknown>): Promise<ApiError> {
  try {
    await promesa
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('Se esperaba un ApiError')
}

const PASSWORD_VALIDA = 'ContrasenaLarga123!'

describe('Contratos de la API de usuarios', () => {
  it('el Admin lista usuarios de todas las sucursales', async () => {
    sesionAdmin()
    const listado = await listarUsuarios({ limit: 10 })

    expect(listado.total).toBe(4)
    expect(listado.data.map((usuario) => usuario.id)).toEqual([
      'admin-1',
      'usuario-1',
      'usuario-2',
      'usuario-3',
    ])
  })

  it('el Gerente solo ve Empleados de su sucursal', async () => {
    sesionGerente()
    const listado = await listarUsuarios({ limit: 10 })

    expect(listado.total).toBe(1)
    expect(listado.data[0]?.id).toBe('usuario-2')
  })

  it('crea un Empleado como Admin con la sucursal elegida (201)', async () => {
    sesionAdmin()
    const creado = await crearUsuario({
      nombre: 'Diana Nueva',
      nombreUsuario: 'diana',
      password: PASSWORD_VALIDA,
      rol: 'Empleado',
      sucursalId: 'sucursal-2',
    })

    expect(creado.rol).toBe('Empleado')
    expect(creado.sucursalId).toBe('sucursal-2')
    expect(creado.estado).toBe('activo')
    expect(creado.nombreUsuario).toBe('diana')
  })

  it('un Admin no lleva sucursal', async () => {
    sesionAdmin()
    const creado = await crearUsuario({
      nombre: 'Otro Admin',
      nombreUsuario: 'otroadmin',
      password: PASSWORD_VALIDA,
      rol: 'Admin',
    })

    expect(creado.sucursalId).toBeNull()
  })

  it('el Gerente crea siempre Empleados en su sucursal aunque mande otra', async () => {
    sesionGerente()
    const creado = await crearUsuario({
      nombre: 'Eric Nuevo',
      nombreUsuario: 'eric',
      password: PASSWORD_VALIDA,
      rol: 'Gerente',
      sucursalId: 'sucursal-2',
    })

    expect(creado.rol).toBe('Empleado')
    expect(creado.sucursalId).toBe('sucursal-1')
  })

  it('la creación exige una contraseña de al menos 12 caracteres (400)', async () => {
    sesionAdmin()
    const error = await capturar(
      crearUsuario({
        nombre: 'Perdida Rapida',
        nombreUsuario: 'corta',
        password: 'abc',
        rol: 'Empleado',
        sucursalId: 'sucursal-1',
      }),
    )

    expect(error.status).toBe(400)
  })

  it('la contraseña no puede superar 72 bytes (400)', async () => {
    sesionAdmin()
    const error = await capturar(
      crearUsuario({
        nombre: 'Muchos Caracteres',
        nombreUsuario: 'larga',
        password: 'a'.repeat(80),
        rol: 'Empleado',
        sucursalId: 'sucursal-1',
      }),
    )

    expect(error.status).toBe(400)
  })

  it('rechaza un nombre de usuario repetido (409)', async () => {
    sesionAdmin()
    const error = await capturar(
      crearUsuario({
        nombre: 'Otra Ada',
        nombreUsuario: 'ada',
        password: PASSWORD_VALIDA,
        rol: 'Empleado',
        sucursalId: 'sucursal-1',
      }),
    )

    expect(error.status).toBe(409)
    expect(error.mensajes.join(' ')).toContain('Ya existe un usuario')
  })

  it('el Admin cambia el rol y la sucursal sin tocar el nombre de usuario', async () => {
    sesionAdmin()
    const actualizado = await actualizarUsuario('usuario-2', {
      nombre: 'Beto Supervisor',
      rol: 'Gerente',
      sucursalId: 'sucursal-2',
    })

    expect(actualizado.nombre).toBe('Beto Supervisor')
    expect(actualizado.rol).toBe('Gerente')
    expect(actualizado.sucursalId).toBe('sucursal-2')
    expect(actualizado.nombreUsuario).toBe('beto')
  })

  it('el Gerente no puede cambiar el rol (403)', async () => {
    sesionGerente()
    const error = await capturar(
      actualizarUsuario('usuario-2', { rol: 'Gerente' }),
    )

    expect(error.status).toBe(403)
    expect(error.mensajes.join(' ')).toContain('Solo el administrador')
  })

  it('devuelve 404 al consultar un usuario fuera del alcance (Gerente)', async () => {
    sesionGerente()
    const error = await capturar(obtenerUsuario('usuario-3'))

    expect(error.status).toBe(404)
  })

  it('nadie puede cambiar el estado de su propia cuenta (400)', async () => {
    sesionAdmin()
    const error = await capturar(cambiarEstadoUsuario('admin-1', 'bloqueado'))

    expect(error.status).toBe(400)
    expect(error.mensajes.join(' ')).toContain('tu propia cuenta')
  })

  it('no se puede bloquear al último administrador activo (409)', async () => {
    sesionAdmin()
    await crearUsuario({
      nombre: 'Admin Respaldo',
      nombreUsuario: 'respaldo',
      password: PASSWORD_VALIDA,
      rol: 'Admin',
    })
    const segundoAdminId = (await listarUsuarios({ limit: 20 })).data.find(
      (usuario) => usuario.nombreUsuario === 'respaldo',
    )?.id as string

    // Con dos Admins activos el bloqueo es válido (200).
    await cambiarEstadoUsuario(segundoAdminId, 'bloqueado')

    // Con un solo Admin activo el segundo intento choca con el guard (409).
    const segundo = await capturar(
      cambiarEstadoUsuario(segundoAdminId, 'bloqueado'),
    )
expect(segundo.status).toBe(409)
    expect(segundo.mensajes.join(' ')).toContain('ultimo administrador')
  })

  it('refleja las revocaciones sembradas en los permisos efectivos', async () => {
    sesionAdmin()
    const permisos = await listarPermisosUsuario('usuario-1')

    const recuento = permisos.find(
      (permiso) => permiso.codigo === 'inventario.recuento',
    )
    expect(recuento?.origen).toBe('revocado')
    expect(recuento?.efectivo).toBe(false)

    const ver = permisos.find((permiso) => permiso.codigo === 'sucursales.ver')
    expect(ver?.origen).toBe('rol')
    expect(ver?.efectivo).toBe(true)
  })

  it('revoca un permiso del rol y el cambio se refleja en los efectivos', async () => {
    sesionAdmin()
await asignarPermisoUsuario(
      'usuario-1',
      idDePermiso('usuarios.crear_editar'),
      'revocado',
    )

    const permisos = await listarPermisosUsuario('usuario-1')
    const usuariosPermiso = permisos.find(
      (permiso) => permiso.codigo === 'usuarios.crear_editar',
    )
    expect(usuariosPermiso?.origen).toBe('revocado')
    expect(usuariosPermiso?.efectivo).toBe(false)
  })

  it('concede de nuevo un permiso revocado (204)', async () => {
    sesionAdmin()
    await asignarPermisoUsuario(
      'usuario-1',
      idDePermiso('inventario.recuento'),
      'concedido',
    )

    const permisos = await listarPermisosUsuario('usuario-1')
    const recuento = permisos.find(
      (permiso) => permiso.codigo === 'inventario.recuento',
    )
    expect(recuento?.origen).toBe('concedido')
    expect(recuento?.efectivo).toBe(true)
  })

  it('a un Empleado solo se le conceden permisos de la matriz de seguridad (400)', async () => {
    sesionAdmin()
    const error = await capturar(
      asignarPermisoUsuario(
        'usuario-2',
        idDePermiso('productos.ver'),
        'concedido',
      ),
    )

    expect(error.status).toBe(400)
    expect(error.mensajes.join(' ')).toContain('matriz de seguridad')
  })

  it('a un Empleado sí se le puede conceder un permiso de la matriz (204)', async () => {
    sesionAdmin()
    await asignarPermisoUsuario(
      'usuario-2',
      idDePermiso('insumos.ver'),
      'concedido',
    )

    const permisos = await listarPermisosUsuario('usuario-2')
    expect(
      permisos.some(
        (permiso) =>
          permiso.codigo === 'insumos.ver' && permiso.efectivo === true,
      ),
    ).toBe(true)
  })

  it('no se puede revocar un permiso que el rol no otorga por defecto (400)', async () => {
    sesionAdmin()
    const error = await capturar(
      asignarPermisoUsuario('usuario-2', idDePermiso('ventas.ver'), 'revocado'),
    )

    expect(error.status).toBe(400)
    expect(error.mensajes.join(' ')).toContain('el rol no otorga por defecto')
  })

  it('no se puede asignar un permiso que el actor no posee (400)', async () => {
    sesionAdmin()
    const error = await capturar(
      asignarPermisoUsuario(
        'usuario-1',
        idDePermiso('ventas.registrar'),
        'revocado',
      ),
    )

    expect(error.status).toBe(400)
    expect(error.mensajes.join(' ')).toContain('que no posees')
  })

  it('quitar la concesión restaura el valor del rol (204)', async () => {
    sesionAdmin()
    await eliminarPermisoUsuario('usuario-2', idDePermiso('productos.ver'))

    const permisos = await listarPermisosUsuario('usuario-2')
    const ver = permisos.find((permiso) => permiso.codigo === 'productos.ver')
    expect(ver?.origen).toBe('rol')
    expect(ver?.efectivo).toBe(true)
  })

  it('quitar un permiso sin concesión devuelve 404', async () => {
    sesionAdmin()
    const error = await capturar(
      eliminarPermisoUsuario('usuario-2', idDePermiso('equipo.ver')),
    )

    expect(error.status).toBe(404)
  })
})
