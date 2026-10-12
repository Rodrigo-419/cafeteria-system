import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import {
  actualizarEquipo,
  crearEquipo,
  listarHistorialEquipo,
  obtenerEquipo,
} from '@/lib/api/equipment'
import { iniciarSesionDePrueba } from '@/test/render'
import {
  PERMISOS_ADMIN,
  PERMISOS_GERENTE,
  usuarioDePrueba,
} from '@/test/handlers'

function sesionAdmin() {
  iniciarSesionDePrueba(
    usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
  )
}

function sesionGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
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

describe('Contratos de la API de equipos', () => {
  it('registra un equipo (201) en estado funcionando', async () => {
    sesionAdmin()
    const equipo = await crearEquipo({
      sucursalId: 'sucursal-1',
      nombre: 'Tostadora',
      tipo: 'tostadora',
    })

    expect(equipo.nombre).toBe('Tostadora')
    expect(equipo.estado).toBe('funcionando')
  })

  it('el Gerente registra siempre en su sucursal aunque envíe otra', async () => {
    sesionGerente()
    const equipo = await crearEquipo({
      sucursalId: 'sucursal-2',
      nombre: 'Tostadora',
      tipo: 'tostadora',
    })

    expect(equipo.sucursalId).toBe('sucursal-1')
  })

  it('el Admin registra en la sucursal elegida', async () => {
    sesionAdmin()
    const equipo = await crearEquipo({
      sucursalId: 'sucursal-2',
      nombre: 'Tostadora',
      tipo: 'tostadora',
    })

    expect(equipo.sucursalId).toBe('sucursal-2')
  })

  it('rechaza un nombre demasiado corto (400)', async () => {
    sesionAdmin()
    const error = await capturar(
      crearEquipo({ sucursalId: 'sucursal-1', nombre: 'X', tipo: 'tostadora' }),
    )

    expect(error.status).toBe(400)
  })

  it('rechaza cambiar el estado de un equipo retirado (409)', async () => {
    sesionAdmin()
    const error = await capturar(
      actualizarEquipo('equipo-4', { estado: 'funcionando' }),
    )

    expect(error.status).toBe(409)
  })

  it('devuelve 404 al consultar un equipo fuera del alcance (Gerente)', async () => {
    sesionGerente()
    const error = await capturar(obtenerEquipo('equipo-5'))

    expect(error.status).toBe(404)
  })

  it('devuelve el historial del equipo ordenado del más reciente al más antiguo', async () => {
    sesionAdmin()
    const historial = await listarHistorialEquipo('equipo-2')

    expect(historial.total).toBe(1)
    expect(historial.data[0]?.estadoNuevo).toBe('en_mantenimiento')
  })
})
