import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { RecuentoNuevoPage } from './RecuentoNuevoPage'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import { BASE_API, PERMISOS_GERENTE, usuarioDePrueba } from '@/test/handlers'
import { server } from '@/test/server'

function renderComoGerente() {
  iniciarSesionDePrueba(usuarioDePrueba(PERMISOS_GERENTE))
  return renderConProveedores(<RecuentoNuevoPage />)
}

const CABECERA_RECUENTO = {
  id: 'rec-nuevo',
  sucursalId: 'sucursal-1',
  usuarioId: 'usuario-1',
  createdAt: '2026-10-11T14:00:00.000Z',
}

describe('Nuevo recuento', () => {
  it('solo envía las líneas rellenadas y exige confirmar el resumen', async () => {
    const cuerpos: unknown[] = []
    server.use(
      http.post(
        `${BASE_API}/inventario/sucursales/:sucursalId/recuentos`,
        async ({ request }) => {
          cuerpos.push(await request.json())
          return HttpResponse.json(CABECERA_RECUENTO, { status: 201 })
        },
      ),
    )
    renderComoGerente()
    const user = userEvent.setup()

    await user.type(
      await screen.findByLabelText('Conteo de Café en grano'),
      '10',
    )
    await user.click(screen.getByRole('button', { name: 'Revisar recuento' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(within(dialogo).getByText('Café en grano')).toBeInTheDocument()
    expect(within(dialogo).queryByText('Leche entera')).toBeNull()
    expect(cuerpos).toHaveLength(0)

    await user.click(
      within(dialogo).getByRole('button', { name: 'Confirmar recuento' }),
    )

    await waitFor(() => expect(cuerpos).toHaveLength(1))
    expect(cuerpos[0]).toEqual({
      items: [{ insumoId: 'i-1', stockFisico: 10 }],
    })
  })

  it('acepta un conteo de 0 (diferencia negativa)', async () => {
    const cuerpos: unknown[] = []
    server.use(
      http.post(
        `${BASE_API}/inventario/sucursales/:sucursalId/recuentos`,
        async ({ request }) => {
          cuerpos.push(await request.json())
          return HttpResponse.json(CABECERA_RECUENTO, { status: 201 })
        },
      ),
    )
    renderComoGerente()
    const user = userEvent.setup()

    await user.type(
      await screen.findByLabelText('Conteo de Leche entera'),
      '0',
    )
    await user.click(screen.getByRole('button', { name: 'Revisar recuento' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(within(dialogo).getByText('-20')).toBeInTheDocument()

    await user.click(
      within(dialogo).getByRole('button', { name: 'Confirmar recuento' }),
    )

    await waitFor(() => expect(cuerpos).toHaveLength(1))
    expect(cuerpos[0]).toEqual({
      items: [{ insumoId: 'i-2', stockFisico: 0 }],
    })
  })

  it('no permite revisar si hay un conteo negativo', async () => {
    renderComoGerente()
    const user = userEvent.setup()

    await user.type(
      await screen.findByLabelText('Conteo de Café en grano'),
      '-1',
    )

    expect(
      screen.getByText('La cantidad debe ser un número con hasta 2 decimales.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Revisar recuento' }),
    ).toBeDisabled()
  })

  it('muestra el mensaje del servidor si el recuento está fuera de alcance', async () => {
    server.use(
      http.post(`${BASE_API}/inventario/sucursales/:sucursalId/recuentos`, () =>
        HttpResponse.json(
          {
            statusCode: 404,
            message: 'El recuento no existe o está fuera de tu alcance',
            error: 'Not Found',
          },
          { status: 404 },
        ),
      ),
    )
    renderComoGerente()
    const user = userEvent.setup()

    await user.type(
      await screen.findByLabelText('Conteo de Café en grano'),
      '4',
    )
    await user.click(screen.getByRole('button', { name: 'Revisar recuento' }))
    const dialogo = await screen.findByRole('alertdialog')
    await user.click(
      within(dialogo).getByRole('button', { name: 'Confirmar recuento' }),
    )

    expect(
      await screen.findByText('El recuento no existe o está fuera de tu alcance'),
    ).toBeInTheDocument()
  })
})
