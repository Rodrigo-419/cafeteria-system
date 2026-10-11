import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import {
  configurarStock,
  crearInsumo,
  eliminarInsumo,
  registrarEntrada,
} from '@/lib/api/inventory'
import { iniciarSesionDePrueba } from '@/test/render'
import { PERMISOS_ADMIN, usuarioDePrueba } from '@/test/handlers'
import type { PresentacionInsumo } from '@/types/api'

function sesion() {
  iniciarSesionDePrueba(
    usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
  )
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

describe('Contratos de la API de inventario', () => {
  it('crea un insumo (201)', async () => {
    sesion()
    const insumo = await crearInsumo({
      nombre: 'Azúcar rubia',
      presentacion: 'bolsa',
    })

    expect(insumo.nombre).toBe('Azúcar rubia')
    expect(insumo.presentacion).toBe('bolsa')
  })

  it('rechaza un nombre duplicado (409)', async () => {
    sesion()
    const error = await capturar(
      crearInsumo({ nombre: 'Café en grano', presentacion: 'bolsa' }),
    )

    expect(error.status).toBe(409)
  })

  it('rechaza una presentación inválida (400)', async () => {
    sesion()
    const error = await capturar(
      crearInsumo({
        nombre: 'Azúcar',
        presentacion: 'litro' as unknown as PresentacionInsumo,
      }),
    )

    expect(error.status).toBe(400)
  })

  it('rechaza eliminar un insumo con stock (409)', async () => {
    sesion()
    const error = await capturar(eliminarInsumo('i-1'))

    expect(error.status).toBe(409)
  })

  it('rechaza una entrada con cantidad 0 (400)', async () => {
    sesion()
    const error = await capturar(
      registrarEntrada('sucursal-1', 'i-1', { cantidad: 0 }),
    )

    expect(error.status).toBe(400)
  })

  it('rechaza una entrada a un insumo descontinuado (409)', async () => {
    sesion()
    const error = await capturar(
      registrarEntrada('sucursal-1', 'i-3', { cantidad: 1 }),
    )

    expect(error.status).toBe(409)
  })

  it('rechaza una entrada a un insumo no dado de alta (404)', async () => {
    sesion()
    const error = await capturar(
      registrarEntrada('sucursal-2', 'i-1', { cantidad: 1 }),
    )

    expect(error.status).toBe(404)
  })

  it('devuelve 404 fuera del alcance de la sucursal', async () => {
    sesion()
    const error = await capturar(
      configurarStock('sucursal-ajena', 'i-1', { stockMinimo: 5 }),
    )

    expect(error.status).toBe(404)
  })

  it('registra una entrada y devuelve el stock actualizado (201)', async () => {
    sesion()
    const resultado = await registrarEntrada('sucursal-1', 'i-1', {
      cantidad: 3,
      motivo: 'Compra',
    })

    expect(resultado.stock.stockActual).toBe('5.00')
    expect(resultado.movimiento.motivo).toBe('Compra')
  })
})
