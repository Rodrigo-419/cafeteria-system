// Botón "Exportar" de los listados: visibilidad por permisos, rango del listado
// y navegación a la pantalla central cuando falta el rango obligatorio.
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLocation } from 'react-router-dom'
import { SalesListPage } from '@/features/sales/SalesListPage'
import { InventarioPage } from '@/features/inventory/InventarioPage'
import { EmpleadosPage } from '@/features/employees/EmpleadosPage'
import { RegistrosTab } from '@/features/attendance/RegistrosTab'
import { AuditoriaPage } from '@/features/audit/AuditoriaPage'
import { ReporteComparativoPage } from '@/features/reports/ReporteComparativoPage'
import { diaDeNegocioLima } from '@/lib/format/dates'
import {
  BASE_API,
  PERMISOS_ADMIN,
  PERMISOS_GERENTE,
  usuarioDePrueba,
} from '@/test/handlers'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import { server } from '@/test/server'
import { desplazarDia } from './presentacion'

const HOY = diaDeNegocioLima(new Date())

function respuestaExportacion(nombre: string) {
  return new HttpResponse('contenido', {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre}"`,
    },
  })
}

function prepararDescarga() {
  const crear = vi
    .spyOn(URL, 'createObjectURL')
    .mockReturnValue('blob:prueba')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const descargas: string[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
    function (this: HTMLAnchorElement) {
      descargas.push(this.download)
    },
  )
  return { crear, descargas }
}

function SondaRuta() {
  const ubicacion = useLocation()
  return <p>{`${ubicacion.pathname}${ubicacion.search}`}</p>
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('botón Exportar de los listados', () => {
  it('Ventas solo muestra Exportar con ventas.ver y usuarios.crear_editar', async () => {
    iniciarSesionDePrueba(usuarioDePrueba(['ventas.ver']))
    const primera = renderConProveedores(<SalesListPage />)
    await screen.findByText('Completada')
    expect(
      screen.queryByRole('button', { name: 'Exportar Ventas en Excel' }),
    ).not.toBeInTheDocument()
    primera.unmount()

    iniciarSesionDePrueba(
      usuarioDePrueba(['ventas.ver', 'usuarios.crear_editar']),
    )
    renderConProveedores(<SalesListPage />)
    expect(
      await screen.findByRole('button', {
        name: 'Exportar Ventas en Excel',
      }),
    ).toBeInTheDocument()
  })

  it('no muestra Exportar si falta el permiso de lectura del conjunto', async () => {
    iniciarSesionDePrueba(usuarioDePrueba(['usuarios.crear_editar']))
    renderConProveedores(<SalesListPage />)

    expect(
      await screen.findByRole('heading', { name: 'Ventas' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Exportar Ventas en Excel' }),
    ).not.toBeInTheDocument()
  })

  it('Ventas exporta la fecha actual del listado', async () => {
    const user = userEvent.setup()
    let cuerpo: unknown
    server.use(
      http.post(`${BASE_API}/exports`, async ({ request }) => {
        cuerpo = await request.json()
        return respuestaExportacion('ventas.xlsx')
      }),
    )
    prepararDescarga()
    iniciarSesionDePrueba(
      usuarioDePrueba(['ventas.ver', 'usuarios.crear_editar']),
    )
    renderConProveedores(<SalesListPage />)
    await screen.findByText('Completada')

    fireEvent.change(screen.getByLabelText('Fecha'), {
      target: { value: HOY },
    })
    await user.click(
      screen.getByRole('button', { name: 'Exportar Ventas en Excel' }),
    )

    expect(
      await screen.findByText('Archivo ventas.xlsx descargado.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Exportar Ventas en Excel' }),
    ).toHaveFocus()
    expect(cuerpo).toEqual({
      conjunto: 'ventas',
      formato: 'xlsx',
      filtros: { desde: HOY, hasta: HOY },
    })
  })

  it('Ventas sin fecha abre Exportaciones con el conjunto preseleccionado', async () => {
    const user = userEvent.setup()
    prepararDescarga()
    iniciarSesionDePrueba(
      usuarioDePrueba(['ventas.ver', 'usuarios.crear_editar']),
    )
    renderConProveedores(
      <>
        <SalesListPage />
        <SondaRuta />
      </>,
    )
    await screen.findByText('Completada')

    await user.click(
      screen.getByRole('button', { name: 'Exportar Ventas en Excel' }),
    )

    expect(
      await screen.findByText('/exports?conjunto=ventas'),
    ).toBeInTheDocument()
  })

  it('Inventario exporta stock sin rango', async () => {
    const user = userEvent.setup()
    let cuerpo: unknown
    server.use(
      http.post(`${BASE_API}/exports`, async ({ request }) => {
        cuerpo = await request.json()
        return respuestaExportacion('stock.xlsx')
      }),
    )
    prepararDescarga()
    iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
    renderConProveedores(<InventarioPage />)
    await screen.findByText('Café en grano')

    await user.click(
      screen.getByRole('button', { name: 'Exportar Stock en Excel' }),
    )

    expect(
      await screen.findByText('Archivo stock.xlsx descargado.'),
    ).toBeInTheDocument()
    expect(cuerpo).toEqual({ conjunto: 'stock', formato: 'xlsx' })
  })

  it('Empleados exporta sin rango', async () => {
    const user = userEvent.setup()
    let cuerpo: unknown
    server.use(
      http.post(`${BASE_API}/exports`, async ({ request }) => {
        cuerpo = await request.json()
        return respuestaExportacion('empleados.xlsx')
      }),
    )
    prepararDescarga()
    iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
    renderConProveedores(<EmpleadosPage />)
    await screen.findByText('Beto Turno')

    await user.click(
      screen.getByRole('button', { name: 'Exportar Empleados en Excel' }),
    )

    expect(
      await screen.findByText('Archivo empleados.xlsx descargado.'),
    ).toBeInTheDocument()
    expect(cuerpo).toEqual({ conjunto: 'empleados', formato: 'xlsx' })
  })

  it('Asistencia pasa el rango actual de registros', async () => {
    const user = userEvent.setup()
    let cuerpo: unknown
    server.use(
      http.post(`${BASE_API}/exports`, async ({ request }) => {
        cuerpo = await request.json()
        return respuestaExportacion('asistencia.xlsx')
      }),
    )
    prepararDescarga()
    iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
    renderConProveedores(<RegistrosTab />)
    await screen.findByText('Dora Nueva')

    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: desplazarDia(HOY, -2) },
    })
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: HOY },
    })
    await user.click(
      screen.getByRole('button', { name: 'Exportar Asistencia en Excel' }),
    )

    expect(
      await screen.findByText('Archivo asistencia.xlsx descargado.'),
    ).toBeInTheDocument()
    expect(cuerpo).toEqual({
      conjunto: 'asistencia',
      formato: 'xlsx',
      filtros: { desde: desplazarDia(HOY, -2), hasta: HOY },
    })
  })

  it('Asistencia sin rango abre Exportaciones con las fechas disponibles', async () => {
    const user = userEvent.setup()
    prepararDescarga()
    iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
    renderConProveedores(
      <>
        <RegistrosTab />
        <SondaRuta />
      </>,
    )
    await screen.findByText('Dora Nueva')

    await user.click(
      screen.getByRole('button', { name: 'Exportar Asistencia en Excel' }),
    )

    expect(
      await screen.findByText('/exports?conjunto=asistencia'),
    ).toBeInTheDocument()
  })

  it('Auditoría exporta sin filtros', async () => {
    const user = userEvent.setup()
    let cuerpo: unknown
    server.use(
      http.post(`${BASE_API}/exports`, async ({ request }) => {
        cuerpo = await request.json()
        return respuestaExportacion('auditoria.xlsx')
      }),
    )
    prepararDescarga()
    iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
    renderConProveedores(<AuditoriaPage />)
    await screen.findByText('Rol de usuario cambiado')

    await user.click(
      screen.getByRole('button', { name: 'Exportar Auditoría en Excel' }),
    )

    expect(
      await screen.findByText('Archivo auditoria.xlsx descargado.'),
    ).toBeInTheDocument()
    expect(cuerpo).toEqual({ conjunto: 'auditoria', formato: 'xlsx' })
  })

  it('Reporte comparativo pasa el rango aplicado', async () => {
    const user = userEvent.setup()
    let cuerpo: unknown
    server.use(
      http.post(`${BASE_API}/exports`, async ({ request }) => {
        cuerpo = await request.json()
        return respuestaExportacion('reporte.xlsx')
      }),
    )
    prepararDescarga()
    iniciarSesionDePrueba(
      usuarioDePrueba(PERMISOS_ADMIN, { rol: 'Admin', sucursalId: null }),
    )
    renderConProveedores(<ReporteComparativoPage />, { ruta: '/reports' })
    await screen.findByText('Comparativo del periodo')

    await user.click(
      screen.getByRole('button', {
        name: 'Exportar Reporte comparativo en Excel',
      }),
    )

    expect(
      await screen.findByText('Archivo reporte.xlsx descargado.'),
    ).toBeInTheDocument()
    expect(cuerpo).toEqual({
      conjunto: 'reporte',
      formato: 'xlsx',
      filtros: { desde: HOY, hasta: HOY },
    })
  })
})
