import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { AuditoriaPage } from './AuditoriaPage'
import { HistorialUsuario } from './HistorialUsuario'
import { filtrarMenu, puedeAccederRuta } from '@/lib/navigation/menu'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import {
  BASE_API,
  PERMISOS_ADMIN,
  PERMISOS_EMPLEADO,
  usuarioDePrueba,
} from '@/test/handlers'
import { server } from '@/test/server'

function renderComoAdmin() {
  iniciarSesionDePrueba(
    usuarioDePrueba(PERMISOS_ADMIN, {
      id: 'admin-1',
      nombre: 'Administrador',
      nombreUsuario: 'admin',
      rol: 'Admin',
      sucursalId: null,
    }),
  )
  return renderConProveedores(<AuditoriaPage />)
}

/** Abre el diálogo de detalle de la fila cuya acción es `etiquetaAccion`. */
async function abrirDetalle(
  user: ReturnType<typeof userEvent.setup>,
  accion: string,
) {
  const fila = await waitFor(() => {
    const filas = screen.getAllByRole('row')
    const encontrada = filas.find(
      (filaActual) =>
        within(filaActual).queryByText(accion) !== null &&
        within(filaActual).queryByRole('button', { name: 'Ver detalle' }) !==
          null,
    )
    if (!encontrada) throw new Error(`No hay fila para "${accion}"`)
    return encontrada
  })
  await user.click(within(fila).getByRole('button', { name: 'Ver detalle' }))
  return screen.findByRole('dialog')
}

describe('Bitácora de auditoría', () => {
  it('lista los eventos con etiquetas en español y el autor', async () => {
    renderComoAdmin()

    expect(await screen.findByText('Rol de usuario cambiado')).toBeInTheDocument()
    expect(screen.getByText('Usuario bloqueado')).toBeInTheDocument()
    expect(screen.getByText('Precio de oferta fijado')).toBeInTheDocument()
    expect(
      screen.getByText('Contraseña de usuario restablecida'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('@admin').length).toBeGreaterThan(0)
  })

  it('filtra por acción', async () => {
    renderComoAdmin()
    const user = userEvent.setup({ delay: null })
    await screen.findByText('Rol de usuario cambiado')

    await user.click(screen.getByLabelText('Acción'))
    await user.click(
      await screen.findByRole('option', { name: 'Usuario bloqueado' }),
    )

    await waitFor(() =>
      expect(screen.queryByText('Rol de usuario cambiado')).toBeNull(),
    )
    expect(screen.getAllByText('Usuario bloqueado').length).toBeGreaterThan(0)
  })

  it('filtra por entidad', async () => {
    renderComoAdmin()
    const user = userEvent.setup({ delay: null })
    await screen.findByText('Rol de usuario cambiado')

    await user.click(screen.getByLabelText('Entidad'))
    await user.click(await screen.findByRole('option', { name: 'Producto' }))

    expect(await screen.findByText('Producto creado')).toBeInTheDocument()
    expect(screen.queryByText('Rol de usuario cambiado')).toBeNull()
  })

  it('muestra el resumen antes → después de un cambio de rol', async () => {
    renderComoAdmin()
    const user = userEvent.setup({ delay: null })

    const dialogo = await abrirDetalle(user, 'Rol de usuario cambiado')

    expect(within(dialogo).getByText('Rol')).toBeInTheDocument()
    expect(within(dialogo).getByText('Empleado')).toBeInTheDocument()
    expect(within(dialogo).getByText('Gerente')).toBeInTheDocument()
  })

  it('formatea el precio del detalle como moneda', async () => {
    renderComoAdmin()
    const user = userEvent.setup({ delay: null })

    const dialogo = await abrirDetalle(user, 'Precio de oferta fijado')

    expect(within(dialogo).getByText('Precio')).toBeInTheDocument()
    expect(within(dialogo).getByText('S/ 10.00')).toBeInTheDocument()
    expect(within(dialogo).getByText('S/ 12.50')).toBeInTheDocument()
  })

  it('etiqueta una acción desconocida y nunca muestra JSON crudo', async () => {
    renderComoAdmin()
    const user = userEvent.setup({ delay: null })
    await screen.findByText('Rol de usuario cambiado')

    expect(screen.queryByText('accion_futura')).toBeNull()
    expect(screen.getAllByText('Acción').length).toBeGreaterThan(0)

    const dialogo = await abrirDetalle(user, 'Acción')
    expect(screen.queryByText('detalleInterno')).toBeNull()
    expect(screen.queryByText('no-debe-mostrarse')).toBeNull()
    expect(screen.queryByText('[object Object]')).toBeNull()
    expect(within(dialogo).getByText('Campo')).toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay eventos', async () => {
    server.use(
      http.get(`${BASE_API}/auditoria`, () =>
        HttpResponse.json({ eventos: [], total: 0, page: 1, limit: 20 }),
      ),
    )
    renderComoAdmin()

    expect(await screen.findByText('Sin eventos')).toBeInTheDocument()
  })

  it('rechaza un rango de más de 92 días con el mensaje del servidor', async () => {
    renderComoAdmin()
    await screen.findByText('Rol de usuario cambiado')

    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-01-01' },
    })
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-06-01' },
    })

    expect(
      await screen.findByText('El rango de fechas no puede superar 92 dias'),
    ).toBeInTheDocument()
  })

  it('rechaza un rango invertido', async () => {
    renderComoAdmin()
    await screen.findByText('Rol de usuario cambiado')

    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-10-20' },
    })
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-10-01' },
    })

    expect(
      await screen.findByText(
        'La fecha "hasta" no puede ser anterior a "desde"',
      ),
    ).toBeInTheDocument()
  })

  it('no rompe el resto de la pantalla si falla la lista', async () => {
    server.use(
      http.get(`${BASE_API}/auditoria`, () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Error interno', error: 'Server Error' },
          { status: 500 },
        ),
      ),
    )
    renderComoAdmin()

    expect(await screen.findByText('Error al cargar datos')).toBeInTheDocument()
    expect(screen.getByText('Error interno')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Bitácora de auditoría' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Acción')).toBeInTheDocument()
  })

  it('muestra el estado de carga hasta recibir la respuesta', async () => {
    let resolver: (() => void) | undefined
    server.use(
      http.get(`${BASE_API}/auditoria`, async () => {
        await new Promise<void>((resolve) => {
          resolver = resolve
        })
        return HttpResponse.json({ eventos: [], total: 0, page: 1, limit: 20 })
      }),
    )
    renderComoAdmin()

    expect(screen.queryByText('Sin eventos')).toBeNull()

    await waitFor(() => expect(resolver).toBeDefined())
    resolver?.()
    expect(await screen.findByText('Sin eventos')).toBeInTheDocument()
  })

  it('no consulta la ruta si falta usuarios.crear_editar', async () => {
    let llamado = false
    server.use(
      http.get(`${BASE_API}/auditoria`, () => {
        llamado = true
        return HttpResponse.json({ eventos: [], total: 0, page: 1, limit: 20 })
      }),
    )
    iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_EMPLEADO))
    renderConProveedores(<AuditoriaPage />)

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(llamado).toBe(false)
  })
})

describe('Visibilidad de Auditoría según permisos', () => {
  it('aparece en el menú y es accesible con usuarios.crear_editar', () => {
    expect(filtrarMenu(PERMISOS_ADMIN).some((i) => i.to === '/auditoria')).toBe(
      true,
    )
    expect(puedeAccederRuta(PERMISOS_ADMIN, '/auditoria')).toBe(true)
  })

  it('se oculta y deniega sin usuarios.crear_editar', () => {
    expect(filtrarMenu(PERMISOS_EMPLEADO).some((i) => i.to === '/auditoria')).toBe(
      false,
    )
    expect(puedeAccederRuta(PERMISOS_EMPLEADO, '/auditoria')).toBe(false)
  })
})

describe('Historial de un usuario', () => {
  it('lista los eventos del usuario', async () => {
    iniciarSesionDePrueba(
      usuarioDePrueba(PERMISOS_ADMIN, { id: 'admin-1', rol: 'Admin' }),
    )
    renderConProveedores(<HistorialUsuario usuarioId="usuario-2" />)

    expect(await screen.findByText('Rol de usuario cambiado')).toBeInTheDocument()
    expect(
      screen.getByText('Contraseña de usuario restablecida'),
    ).toBeInTheDocument()
  })

  it('avisa cuando el historial no está disponible (404)', async () => {
    iniciarSesionDePrueba(
      usuarioDePrueba(PERMISOS_ADMIN, { id: 'admin-1', rol: 'Admin' }),
    )
    renderConProveedores(<HistorialUsuario usuarioId="usuario-inexistente" />)

    expect(
      await screen.findByText('El historial de este usuario no está disponible.'),
    ).toBeInTheDocument()
  })
})
