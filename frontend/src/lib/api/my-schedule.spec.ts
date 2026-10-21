// Pruebas del cliente HTTP del horario propio.
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { obtenerMiHorario } from './my-schedule'
import { server } from '@/test/server'

describe('my-schedule API', () => {
  afterEach(() => {
    server.resetHandlers()
  })

  it('llama a GET /my/schedule sin query por defecto', async () => {
    let url = ''
    server.use(
      http.get('*/api/my/schedule', ({ request }) => {
        url = request.url
        return HttpResponse.json({ empleado: {}, dias: [] })
      }),
    )

    await obtenerMiHorario()

    expect(url).toContain('/api/my/schedule')
    expect(url).not.toContain('?')
  })

  it('incluye desde y hasta en la query', async () => {
    let url = ''
    server.use(
      http.get('*/api/my/schedule', ({ request }) => {
        url = request.url
        return HttpResponse.json({ empleado: {}, dias: [] })
      }),
    )

    await obtenerMiHorario({ desde: '2026-10-12', hasta: '2026-10-18' })

    expect(url).toContain('desde=2026-10-12')
    expect(url).toContain('hasta=2026-10-18')
  })

  it('propaga el error del servidor', async () => {
    server.use(
      http.get('*/api/my/schedule', () =>
        HttpResponse.json(
          { statusCode: 404, message: 'No estás vinculado a un empleado', error: 'Not Found' },
          { status: 404 },
        ),
      ),
    )

    await expect(obtenerMiHorario()).rejects.toMatchObject({ status: 404 })
  })
})
