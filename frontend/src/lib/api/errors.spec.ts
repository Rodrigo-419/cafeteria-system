import { describe, expect, it } from 'vitest'
import { ApiError, esErrorNoAutorizado, parsearErrorApi } from './errors'

describe('parsearErrorApi', () => {
  it('toma el mensaje cuando es una cadena', () => {
    const error = parsearErrorApi(401, {
      statusCode: 401,
      message: 'Credenciales invalidas',
    })

    expect(error.status).toBe(401)
    expect(error.mensajes).toEqual(['Credenciales invalidas'])
  })

  it('toma todos los mensajes cuando es un arreglo (validacion)', () => {
    const error = parsearErrorApi(400, {
      statusCode: 400,
      message: ['nombreUsuario debe ser valido', 'password es obligatoria'],
    })

    expect(error.mensajes).toEqual([
      'nombreUsuario debe ser valido',
      'password es obligatoria',
    ])
  })

  it('usa un mensaje generico si el cuerpo no trae `message`', () => {
    const error = parsearErrorApi(500, {})

    expect(error).toBeInstanceOf(ApiError)
    expect(error.mensajes).toEqual(['Error 500'])
  })
})

describe('esErrorNoAutorizado', () => {
  it('detecta el 401', () => {
    expect(esErrorNoAutorizado(new ApiError(401, ['x']))).toBe(true)
    expect(esErrorNoAutorizado(new ApiError(403, ['x']))).toBe(false)
    expect(esErrorNoAutorizado(new Error('otro'))).toBe(false)
  })
})
