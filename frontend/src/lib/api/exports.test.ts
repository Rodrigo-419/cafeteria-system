// Contrato de la descarga: cuerpo enviado, nombre tomado de
// `Content-Disposition` y errores traducidos a `ApiError` sin reintentos.
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import {
  nombreDesdeContentDisposition,
  sanearNombreArchivo,
} from './client'
import { ApiError } from './errors'
import { exportarConjunto, exportarLibroCompleto } from './exports'
import { diaDeNegocioLima } from '@/lib/format/dates'
import { BASE_API } from '@/test/handlers'
import { server } from '@/test/server'

function archivo(
  nombre: string | null,
  tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
) {
  return new HttpResponse('contenido', {
    status: 200,
    headers: {
      'Content-Type': tipo,
      ...(nombre
        ? { 'Content-Disposition': `attachment; filename="${nombre}"` }
        : {}),
    },
  })
}

describe('API de exportaciones', () => {
  it('envía conjunto, formato y filtros y usa el nombre del servidor', async () => {
    let cuerpo: unknown
    server.use(
      http.post(`${BASE_API}/exports`, async ({ request }) => {
        cuerpo = await request.json()
        return archivo('ventas-2026-10-26.csv', 'text/csv; charset=utf-8')
      }),
    )

    const fetchEspia = vi.spyOn(globalThis, 'fetch')

    const resultado = await exportarConjunto({
      conjunto: 'ventas',
      formato: 'csv',
      filtros: { desde: '2026-10-20', hasta: '2026-10-26' },
    })

    expect(cuerpo).toEqual({
      conjunto: 'ventas',
      formato: 'csv',
      filtros: { desde: '2026-10-20', hasta: '2026-10-26' },
    })
    expect(resultado.nombreArchivo).toBe('ventas-2026-10-26.csv')
    expect(await resultado.blob.text()).toBe('contenido')
    expect(fetchEspia).toHaveBeenCalledWith(
      expect.stringContaining('/exports'),
      expect.objectContaining({ method: 'POST', cache: 'no-store' }),
    )
    fetchEspia.mockRestore()
  })

  it('usa un nombre de reserva si el servidor no envía Content-Disposition', async () => {
    server.use(
      http.post(`${BASE_API}/exports`, () => archivo(null, 'text/csv')),
    )

    const resultado = await exportarConjunto({
      conjunto: 'carta',
      formato: 'csv',
    })

    expect(resultado.nombreArchivo).toBe(
      `carta-${diaDeNegocioLima(new Date())}.csv`,
    )
  })

  it('el libro completo se pide sin cuerpo y toma su nombre', async () => {
    let cuerpo: string | null = null
    server.use(
      http.post(`${BASE_API}/exports/full`, async ({ request }) => {
        cuerpo = await request.text()
        return archivo('libro-completo-2026-10-26.xlsx')
      }),
    )

    const resultado = await exportarLibroCompleto()

    expect(cuerpo).toBe('')
    expect(resultado.nombreArchivo).toBe('libro-completo-2026-10-26.xlsx')
  })

  it('propaga el 413 con su mensaje y Retry-After sin reintentar', async () => {
    let llamadas = 0
    server.use(
      http.post(`${BASE_API}/exports`, () => {
        llamadas += 1
        return HttpResponse.json(
          {
            statusCode: 413,
            message: 'La exportación supera el máximo de filas permitido.',
            error: 'Payload Too Large',
          },
          { status: 413, headers: { 'Retry-After': '4' } },
        )
      }),
    )

    const error = await exportarConjunto({
      conjunto: 'ventas',
      formato: 'xlsx',
      filtros: { desde: '2026-10-20', hasta: '2026-10-26' },
    }).catch((fallo: unknown) => fallo)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 413,
      mensajes: ['La exportación supera el máximo de filas permitido.'],
      retryAfter: 4,
    })
    expect(llamadas).toBe(1)
  })
})

describe('nombre de archivo', () => {
  it('lee filename entre comillas y la forma extendida', () => {
    expect(
      nombreDesdeContentDisposition(
        'attachment; filename="ventas-2026-10-26.xlsx"',
      ),
    ).toBe('ventas-2026-10-26.xlsx')
    expect(
      nombreDesdeContentDisposition(
        "attachment; filename*=UTF-8''reporte%20diario.xlsx",
      ),
    ).toBe('reporte diario.xlsx')
    expect(nombreDesdeContentDisposition('attachment')).toBeNull()
  })

  it('elimina rutas, controles y nombres reservados de Windows', () => {
    expect(sanearNombreArchivo('../../etc/passwd')).toBe('passwd')
    expect(sanearNombreArchivo('..\\..\\con.xlsx')).toBe('archivo-con.xlsx')
    expect(sanearNombreArchivo('ven\u0001tas.xlsx')).toBe('ventas.xlsx')
    expect(sanearNombreArchivo('   ')).toBeNull()
    expect(sanearNombreArchivo('..')).toBeNull()
  })

  it('limita el tamaño sin perder la extensión', () => {
    const nombre = sanearNombreArchivo(`${'a'.repeat(150)}.xlsx`)
    expect(nombre).toHaveLength(105)
    expect(nombre?.endsWith('.xlsx')).toBe(true)
  })
})
