// Pantalla de exportaciones: permisos, validación del rango, descarga,
// errores, sesión vencida, cancelación y estados de la interfaz.
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/App'
import { useAuth } from '@/lib/auth/useAuth'
import { diaDeNegocioLima } from '@/lib/format/dates'
import { filtrarMenu, puedeAccederRuta, rutaInicio } from '@/lib/navigation/menu'
import {
  BASE_API,
  PERMISOS_ADMIN,
  PERMISOS_EMPLEADO,
  PERMISOS_GERENTE,
  usuarioDePrueba,
} from '@/test/handlers'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import { server } from '@/test/server'
import { ListaConjuntos } from './ListaConjuntos'
import { ExportacionesPage } from './ExportacionesPage'
import { desplazarDia } from './presentacion'

const HOY = diaDeNegocioLima(new Date())
const NOMBRES_ADMIN = [
  'Ventas',
  'Carta y precios',
  'Stock',
  'Movimientos de inventario',
  'Empleados',
  'Turnos',
  'Asignaciones de turnos',
  'Asistencia',
  'Faltas',
  'Equipos',
  'Usuarios',
  'Sucursales',
  'Reporte comparativo',
  'Auditoría',
]

function iniciarPagina(
  permisos: string[] = PERMISOS_ADMIN,
  opciones: { ruta?: string } = {},
) {
  iniciarSesionDePrueba(usuarioDePrueba(permisos))
  return renderConProveedores(<ExportacionesPage />, {
    ruta: opciones.ruta ?? '/',
  })
}

function fila(nombre: string) {
  const titulo = screen.getByRole('heading', { name: nombre, level: 3 })
  const item = titulo.closest('li')
  if (!item) throw new Error(`No se encontró la fila de ${nombre}`)
  return within(item)
}

function completarRango(desde: string, hasta: string) {
  fireEvent.change(screen.getByLabelText('Desde'), {
    target: { value: desde },
  })
  fireEvent.change(screen.getByLabelText('Hasta'), {
    target: { value: hasta },
  })
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

async function esperarPantalla() {
  await screen.findByRole('heading', { name: 'Exportaciones' })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ExportacionesPage: permisos y catálogo', () => {
  it('un Admin ve los 14 conjuntos agrupados en cinco áreas', async () => {
    iniciarPagina()
    await esperarPantalla()

    for (const area of [
      'Ventas y precios',
      'Inventario',
      'Personal y turnos',
      'Asistencia',
      'Sistema y reportes',
    ]) {
      expect(
        screen.getByRole('heading', { name: area, level: 2 }),
      ).toBeInTheDocument()
    }
    for (const nombre of NOMBRES_ADMIN) {
      expect(
        screen.getByRole('heading', { name: nombre, level: 3 }),
      ).toBeInTheDocument()
    }
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(14)
  })

  it('un Gerente no ve el reporte comparativo', async () => {
    iniciarPagina(PERMISOS_GERENTE)
    await esperarPantalla()

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(13)
    expect(
      screen.queryByRole('heading', {
        name: 'Reporte comparativo',
        level: 3,
      }),
    ).not.toBeInTheDocument()
  })

  it('con solo usuarios.crear_editar solo ve Usuarios y Auditoría', async () => {
    iniciarPagina(['usuarios.crear_editar'])
    await esperarPantalla()

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2)
    expect(
      screen.getByRole('heading', { name: 'Usuarios', level: 3 }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Auditoría', level: 3 }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Ventas', level: 3 }),
    ).not.toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay conjuntos visibles', () => {
    renderConProveedores(
      <ListaConjuntos
        conjuntos={[]}
        generando={false}
        preseleccionado={null}
        onExportar={() => {}}
      />,
    )

    expect(screen.getByText('Sin conjuntos disponibles')).toBeInTheDocument()
    expect(
      screen.getByText(
        'No tienes permiso de lectura para ningún conjunto exportable.',
      ),
    ).toBeInTheDocument()
  })

  it('el Empleado no ve Exportaciones, no puede entrar y /exports conserva la URL', async () => {
    expect(
      filtrarMenu(PERMISOS_EMPLEADO).some(
        (item) => item.label === 'Exportaciones',
      ),
    ).toBe(false)
    expect(puedeAccederRuta(PERMISOS_EMPLEADO, '/exports')).toBe(false)
    expect(puedeAccederRuta(PERMISOS_GERENTE, '/exports')).toBe(true)
    expect(rutaInicio(PERMISOS_GERENTE)).toBe('/')

    iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_EMPLEADO))
    window.history.pushState({}, '', '/exports')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Acceso denegado' }),
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe('/exports')
  })

  it('el Admin abre la ruta /exports desde la aplicación', async () => {
    iniciarSesionDePrueba(
      usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
    )
    window.history.pushState({}, '', '/exports')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Exportaciones' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Exportaciones' }),
    ).toBeInTheDocument()
  })
})

describe('ExportacionesPage: validación del rango', () => {
  it('exige el rango a los conjuntos de actividad y enfoca Desde', async () => {
    const user = userEvent.setup()
    let llamadas = 0
    server.use(
      http.post(`${BASE_API}/exports`, () => {
        llamadas += 1
        return new HttpResponse('no-debe-descargarse')
      }),
    )
    iniciarPagina()
    await esperarPantalla()

    await user.click(fila('Ventas').getByRole('button', { name: /Excel/ }))

    expect(
      await screen.findByText(
        'Selecciona la fecha de inicio y la fecha de fin.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Desde')).toHaveFocus()
    expect(llamadas).toBe(0)
  })

  it('rechaza una fecha de fin anterior a la de inicio', async () => {
    const user = userEvent.setup()
    iniciarPagina()
    await esperarPantalla()

    completarRango(desplazarDia(HOY, -1), desplazarDia(HOY, -5))
    await user.click(fila('Ventas').getByRole('button', { name: /Excel/ }))

    expect(
      screen.getByText(
        'La fecha de fin no puede ser anterior a la fecha de inicio.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Hasta')).toHaveFocus()
  })

  it('rechaza un rango de más de 92 días', async () => {
    const user = userEvent.setup()
    iniciarPagina()
    await esperarPantalla()

    completarRango(desplazarDia(HOY, -100), HOY)
    await user.click(fila('Ventas').getByRole('button', { name: /Excel/ }))

    expect(
      screen.getByText('El rango no puede superar 92 días.'),
    ).toBeInTheDocument()
  })

  it('rechaza fechas futuras', async () => {
    const user = userEvent.setup()
    iniciarPagina()
    await esperarPantalla()

    completarRango(HOY, desplazarDia(HOY, 1))
    await user.click(fila('Ventas').getByRole('button', { name: /Excel/ }))

    expect(
      screen.getByText('La fecha de fin no puede ser futura.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Hasta')).toHaveFocus()
  })

  it('no exige rango a un conjunto sin actividad', async () => {
    const user = userEvent.setup()
    let cuerpo: unknown
    server.use(
      http.post(`${BASE_API}/exports`, async ({ request }) => {
        cuerpo = await request.json()
        return new HttpResponse('contenido', {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="carta.csv"',
          },
        })
      }),
    )
    const descarga = prepararDescarga()
    iniciarPagina()
    await esperarPantalla()

    await user.click(fila('Carta y precios').getByRole('button', { name: /CSV/ }))

    await screen.findByText('Archivo carta.csv descargado.')
    expect(cuerpo).toEqual({ conjunto: 'carta', formato: 'csv' })
    expect(descarga.descargas[0]?.nombre).toBe('carta.csv')
  })
})

describe('ExportacionesPage: descarga y libro completo', () => {
  it('descarga un Excel con el nombre del servidor y libera la URL temporal', async () => {
    const user = userEvent.setup()
    let cuerpo: unknown
    server.use(
      http.post(`${BASE_API}/exports`, async ({ request }) => {
        cuerpo = await request.json()
        return new HttpResponse('contenido-exportado', {
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition':
              'attachment; filename="ventas-2026-10-26.xlsx"',
          },
        })
      }),
    )
    const descarga = prepararDescarga()
    const { queryClient } = iniciarPagina()
    await esperarPantalla()

    completarRango(desplazarDia(HOY, -6), HOY)
    await user.click(fila('Ventas').getByRole('button', { name: /Excel/ }))

    expect(
      await screen.findByText('Archivo ventas-2026-10-26.xlsx descargado.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Archivo ventas-2026-10-26.xlsx descargado.'),
    ).toHaveFocus()
    expect(cuerpo).toEqual({
      conjunto: 'ventas',
      formato: 'xlsx',
      filtros: { desde: desplazarDia(HOY, -6), hasta: HOY },
    })
    expect(descarga.crear).toHaveBeenCalledTimes(1)
    expect(descarga.crear.mock.calls[0]?.[0]).toBeInstanceOf(Blob)
    expect(descarga.descargas[0]?.nombre).toBe('ventas-2026-10-26.xlsx')
    expect(descarga.liberar).toHaveBeenCalledWith('blob:prueba')

    const cache = JSON.stringify(
      queryClient.getQueryCache().getAll().map((consulta) => consulta.state.data),
    )
    expect(cache).not.toContain('contenido-exportado')
    for (const almacen of [sessionStorage, localStorage]) {
      for (let indice = 0; indice < almacen.length; indice += 1) {
        const clave = almacen.key(indice)
        expect(clave === null ? '' : almacen.getItem(clave)).not.toContain(
          'contenido-exportado',
        )
      }
    }
  })

  it('descarga un CSV sin rango', async () => {
    const user = userEvent.setup()
    const descarga = prepararDescarga()
    iniciarPagina()
    await esperarPantalla()

    await user.click(fila('Carta y precios').getByRole('button', { name: /CSV/ }))

    expect(
      await screen.findByText('Archivo carta-2026-10-26.csv descargado.'),
    ).toBeInTheDocument()
    expect(descarga.descargas[0]?.nombre).toBe('carta-2026-10-26.csv')
    expect(descarga.liberar).toHaveBeenCalled()
  })

  it('descarga el libro completo sin enviar filtros y avisa que no admite rango', async () => {
    const user = userEvent.setup()
    let cuerpo: string | null = null
    server.use(
      http.post(`${BASE_API}/exports/full`, async ({ request }) => {
        cuerpo = await request.text()
        return new HttpResponse('libro', {
          headers: {
            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition':
              'attachment; filename="libro-completo-2026-10-26.xlsx"',
          },
        })
      }),
    )
    const descarga = prepararDescarga()
    iniciarPagina()
    await esperarPantalla()

    expect(
      screen.getByText(/El libro completo no admite rango/i),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', {
        name: 'Generar libro completo en Excel',
      }),
    )

    expect(
      await screen.findByText(
        'Archivo libro-completo-2026-10-26.xlsx descargado.',
      ),
    ).toBeInTheDocument()
    expect(cuerpo).toBe('')
    expect(descarga.descargas[0]?.nombre).toBe(
      'libro-completo-2026-10-26.xlsx',
    )
  })

  it('indica el progreso, deshabilita los botones y cancela sin error visible', async () => {
    const user = userEvent.setup()
    const abortar = vi.spyOn(AbortController.prototype, 'abort')
    server.use(
      http.post(`${BASE_API}/exports`, async ({ request }) => {
        // La petición queda pendiente hasta que el usuario cancela: así la
        // prueba no compite con una respuesta que podría llegar antes.
        await new Promise<void>((resolver) => {
          const temporizador = setTimeout(resolver, 1000)
          request.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(temporizador)
              resolver()
            },
            { once: true },
          )
        })
        return HttpResponse.json(
          { statusCode: 500, message: 'Fallo interno', error: 'Internal' },
          { status: 500 },
        )
      }),
    )
    const descarga = prepararDescarga()
    iniciarPagina()
    await esperarPantalla()

    completarRango(desplazarDia(HOY, -2), HOY)
    await user.click(fila('Ventas').getByRole('button', { name: /Excel/ }))

    expect(await screen.findByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByText('Generando Ventas…')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Exportar Ventas a Excel' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: 'Generar libro completo en Excel',
      }),
    ).toBeDisabled()

    await user.click(
      screen.getByRole('button', { name: 'Cancelar exportación' }),
    )

    expect(
      await screen.findByText('Exportación cancelada.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Exportación cancelada.')).toHaveFocus()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Exportar Ventas a Excel' }),
    ).toBeEnabled()
    expect(abortar).toHaveBeenCalled()
    expect(descarga.crear).not.toHaveBeenCalled()

    // Deja terminar la petición simulada para no dejar trabajo pendiente.
    await new Promise((resolver) => setTimeout(resolver, 200))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('ExportacionesPage: errores y sesión', () => {
  it.each([
    [400, 'Revisa el rango de fechas.'],
    [403, 'Sin permiso'],
    [404, 'El conjunto no existe.'],
    [413, 'La exportación supera el máximo de filas permitido.'],
    [429, 'Demasiadas exportaciones. Espera un momento.'],
  ])('muestra en español el mensaje de un %i', async (estado, mensaje) => {
    const user = userEvent.setup()
    server.use(
      http.post(`${BASE_API}/exports`, () =>
        HttpResponse.json(
          { statusCode: estado, message: mensaje, error: 'Error' },
          { status: estado },
        ),
      ),
    )
    iniciarPagina()
    await esperarPantalla()

    completarRango(desplazarDia(HOY, -1), HOY)
    await user.click(fila('Ventas').getByRole('button', { name: /Excel/ }))

    expect(await screen.findByText(mensaje)).toBeInTheDocument()
    expect(
      screen.getByText('No se pudo exportar').closest('[role="alert"]'),
    ).toHaveFocus()
  })

  it.each([500, 503])('no reintenta una exportación fallida (%i)', async (estado) => {
    const user = userEvent.setup()
    let llamadas = 0
    server.use(
      http.post(`${BASE_API}/exports`, () => {
        llamadas += 1
        return HttpResponse.json(
          { statusCode: estado, message: 'Fallo interno', error: 'Error' },
          { status: estado },
        )
      }),
    )
    iniciarPagina()
    await esperarPantalla()

    completarRango(desplazarDia(HOY, -1), HOY)
    await user.click(fila('Ventas').getByRole('button', { name: /Excel/ }))

    expect(
      await screen.findByText(
        'No se pudo generar el archivo. Inténtalo de nuevo.',
      ),
    ).toBeInTheDocument()
    await new Promise((resolver) => setTimeout(resolver, 150))
    expect(llamadas).toBe(1)
  })

  it('un 401 cierra la sesión y no muestra un error de exportación', async () => {
    const user = userEvent.setup()
    function SondaSesion() {
      const { autenticado } = useAuth()
      return <p>{autenticado ? 'Sesión activa' : 'Sesión cerrada'}</p>
    }

    iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_ADMIN))
    renderConProveedores(
      <>
        <ExportacionesPage />
        <SondaSesion />
      </>,
    )
    await esperarPantalla()
    expect(screen.getByText('Sesión activa')).toBeInTheDocument()

    server.use(
      http.post(`${BASE_API}/exports`, () =>
        HttpResponse.json(
          { statusCode: 401, message: 'No autorizado', error: 'Unauthorized' },
          { status: 401 },
        ),
      ),
    )
    completarRango(desplazarDia(HOY, -1), HOY)
    await user.click(fila('Ventas').getByRole('button', { name: /Excel/ }))

    expect(await screen.findByText('Sesión cerrada')).toBeInTheDocument()
    expect(screen.queryByText('No se pudo exportar')).not.toBeInTheDocument()
  })
})

describe('ExportacionesPage: conjunto preseleccionado', () => {
  it('abre con el conjunto seleccionado, lo enfoca y muestra el aviso', async () => {
    iniciarPagina(PERMISOS_ADMIN, {
      ruta: '/exports?conjunto=ventas',
    })
    await esperarPantalla()

    expect(
      screen.getByText('Conjunto preseleccionado'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Ventas está listo para exportar/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Exportar Ventas a Excel' }),
    ).toHaveFocus()
    const item = screen
      .getByRole('heading', { name: 'Ventas', level: 3 })
      .closest('li')
    expect(item).toHaveAttribute('aria-current', 'true')
  })

  it('ignora un conjunto desconocido o no visible', async () => {
    iniciarPagina(['usuarios.crear_editar'], {
      ruta: '/exports?conjunto=ventas',
    })
    await esperarPantalla()

    expect(
      screen.queryByText('Conjunto preseleccionado'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Ventas', level: 3 }),
    ).not.toBeInTheDocument()
  })
})
