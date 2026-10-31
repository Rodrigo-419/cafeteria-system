// Regresiones del cuelgue real de la pantalla de exportaciones.
//
// La aplicacion se monta con `StrictMode` por fuera de los proveedores, como
// en `main.tsx`. En desarrollo React ejecuta el efecto, su limpieza y otra vez
// el efecto; el hook marcaba "desmontado" en la limpieza y no lo deshacia en el
// segundo setup, asi que la primera exportacion ni se descargaba ni dejaba de
// "generar". Las pruebas existentes de la pantalla montan `StrictMode` por
// dentro de los proveedores y por eso no reproducen ese ciclo.
//
// Tambien se cubre una respuesta que nunca termina: Cancelar debe devolver la
// pantalla a la normalidad al instante y permitir otra exportacion, y la espera
// maxima de 90 s debe rendirse con un mensaje claro (sin reintento).
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PERMISOS_ADMIN, usuarioDePrueba } from '@/test/handlers'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import { ExportacionesPage } from './ExportacionesPage'

const NOMBRE_CARTA = 'carta-2026-10-26.csv'
const MENSAJE_TIEMPO =
  'La exportación tardó más de 90 segundos y se canceló. Inténtalo de nuevo.'

function fila(nombre: string) {
  const titulo = screen.getByRole('heading', { name: nombre, level: 3 })
  const item = titulo.closest('li')
  if (!item) throw new Error(`No se encontró la fila de ${nombre}`)
  return within(item)
}

function prepararDescarga() {
  const crear = vi
    .spyOn(URL, 'createObjectURL')
    .mockReturnValue('blob:prueba')
  const liberar = vi
    .spyOn(URL, 'revokeObjectURL')
    .mockImplementation(() => {})
  const descargas: Array<{ nombre: string; href: string }> = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
    function (this: HTMLAnchorElement) {
      descargas.push({ nombre: this.download, href: this.href })
    },
  )
  return { crear, liberar, descargas }
}

/** Monta la pantalla como la monta `main.tsx`: `StrictMode` por fuera. */
function iniciarPaginaEstricta() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_ADMIN))
  return renderConProveedores(<ExportacionesPage />, { estricto: true })
}

/** Respuesta normal de la API con el archivo CSV. */
function archivoCarta() {
  return new Response('contenido-exportado', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${NOMBRE_CARTA}"`,
    },
  })
}

/**
 * Simula un servidor que acepta la exportacion y no contesta nunca.
 *
 * La primera peticion a `/exports` queda pendiente para siempre, aunque el
 * cliente aborte: asi la prueba demuestra que Cancelar no depende de que el
 * servidor (ni `fetch`) reaccione. Las siguientes peticiones responden el CSV.
 *
 * Se sustituye `fetch` en vez de usar MSW porque en MSW 3.0.3 una peticion
 * interceptada que se aborta a media respuesta deja el socket simulado en mal
 * estado y la peticion siguiente del mismo archivo acaba en una conexion real a
 * `localhost:80` ("fetch failed", ECONNREFUSED) sin llegar a ningun handler.
 * Lo que se prueba aqui es el estado de la pantalla, no el transporte.
 */
function servidorQueNoResponde() {
  let llamadas = 0
  const original = globalThis.fetch
  vi.spyOn(globalThis, 'fetch').mockImplementation((entrada, opciones) => {
    const url =
      typeof entrada === 'string'
        ? entrada
        : entrada instanceof Request
          ? entrada.url
          : String(entrada)
    if (!url.endsWith('/exports')) return original(entrada, opciones)

    llamadas += 1
    if (llamadas === 1) return new Promise<Response>(() => undefined)
    return Promise.resolve(archivoCarta())
  })
  return { llamadas: () => llamadas }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ExportacionesPage en desarrollo (StrictMode)', () => {
  it('descarga el archivo y limpia el estado al terminar', async () => {
    const user = userEvent.setup()
    const descarga = prepararDescarga()
    iniciarPaginaEstricta()

    await screen.findByRole('heading', { name: 'Exportaciones' })
    await user.click(fila('Carta y precios').getByRole('button', { name: /CSV/ }))

    expect(
      await screen.findByText(
        `Archivo ${NOMBRE_CARTA} descargado.`,
        {},
        { timeout: 2000 },
      ),
    ).toBeInTheDocument()
    expect(descarga.descargas[0]?.nombre).toBe(NOMBRE_CARTA)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('Cancelar responde en menos de 1 s aunque la respuesta no termine', async () => {
    const user = userEvent.setup()
    servidorQueNoResponde()
    iniciarPaginaEstricta()

    await screen.findByRole('heading', { name: 'Exportaciones' })
    await user.click(fila('Carta y precios').getByRole('button', { name: /CSV/ }))
    expect(await screen.findByRole('progressbar')).toBeInTheDocument()

    const inicio = performance.now()
    await user.click(
      screen.getByRole('button', { name: 'Cancelar exportación' }),
    )
    expect(
      await screen.findByText('Exportación cancelada.', {}, { timeout: 1000 }),
    ).toBeInTheDocument()
    expect(performance.now() - inicio).toBeLessThan(1000)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Exportar Carta y precios a CSV' }),
    ).toBeEnabled()
  })

  it('después de cancelar se puede iniciar otra exportación y descargarla', async () => {
    const user = userEvent.setup()
    const servidor = servidorQueNoResponde()
    const descarga = prepararDescarga()
    iniciarPaginaEstricta()

    await screen.findByRole('heading', { name: 'Exportaciones' })
    await user.click(fila('Carta y precios').getByRole('button', { name: /CSV/ }))
    expect(await screen.findByRole('progressbar')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Cancelar exportación' }),
    )
    expect(
      await screen.findByText('Exportación cancelada.', {}, { timeout: 1000 }),
    ).toBeInTheDocument()

    await user.click(fila('Carta y precios').getByRole('button', { name: /CSV/ }))
    expect(
      await screen.findByText(
        `Archivo ${NOMBRE_CARTA} descargado.`,
        {},
        { timeout: 2000 },
      ),
    ).toBeInTheDocument()
    expect(servidor.llamadas()).toBe(2)
    expect(descarga.descargas).toHaveLength(1)
  })

  it('a los 90 s se rinde con un mensaje claro y sin reintentar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const servidor = servidorQueNoResponde()
    iniciarPaginaEstricta()

    await screen.findByRole('heading', { name: 'Exportaciones' })
    await user.click(fila('Carta y precios').getByRole('button', { name: /CSV/ }))
    expect(await screen.findByRole('progressbar')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(90_000)

    expect(
      await screen.findByText(MENSAJE_TIEMPO, {}, { timeout: 2000 }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText('Exportación cancelada.')).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(120_000)
    expect(servidor.llamadas()).toBe(1)
  })
})
