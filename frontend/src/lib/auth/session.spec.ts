import { beforeEach, describe, expect, it } from 'vitest'
import type { UsuarioApi } from '@/types/api'
import { cargarSesionInicial, crearSesion, guardarSesion } from './session'

const CLAVE = 'cafeteria.sesion'

const USUARIO: UsuarioApi = {
  id: 'u-1',
  nombre: 'Ada',
  email: 'ada@cafeteria.test',
  rol: 'Gerente',
  sucursalId: 's-1',
  permisos: ['ventas.ver'],
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('cargarSesionInicial', () => {
  it('devuelve la sesion guardada cuando es valida y no ha vencido', () => {
    guardarSesion(crearSesion('tok', USUARIO, 3600))

    const { sesion, expirada } = cargarSesionInicial()

    expect(expirada).toBe(false)
    expect(sesion?.accessToken).toBe('tok')
    expect(sesion?.user.permisos).toEqual(['ventas.ver'])
  })

  it('descarta y reporta una sesion vencida', () => {
    const sesion = crearSesion('tok', USUARIO, 1)
    guardarSesion({ ...sesion, expiresAt: Date.now() - 1000 })

    const { sesion: recuperada, expirada } = cargarSesionInicial()

    expect(recuperada).toBeNull()
    expect(expirada).toBe(true)
    expect(sessionStorage.getItem(CLAVE)).toBeNull()
  })

  it('descarta una sesion con formato invalido', () => {
    sessionStorage.setItem(CLAVE, '{no-es-json')

    const { sesion, expirada } = cargarSesionInicial()

    expect(sesion).toBeNull()
    expect(expirada).toBe(false)
  })

  it('devuelve null cuando no hay nada guardado', () => {
    expect(cargarSesionInicial()).toEqual({ sesion: null, expirada: false })
  })
})
