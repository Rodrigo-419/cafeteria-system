import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { AnnulSaleDialog } from './AnnulSaleDialog'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import { BASE_API, usuarioDePrueba, ventaCompleta } from '@/test/handlers'
import { server } from '@/test/server'

const ANULACION_URL = `${BASE_API}/sales/:id/anular`

function renderAnulacion() {
  iniciarSesionDePrueba(
    usuarioDePrueba(['ventas.anular'], { rol: 'Empleado' }),
  )
  return renderConProveedores(<AnnulSaleDialog venta={ventaCompleta()} />)
}

async function abrirYConfirmar(motivo: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Anular' }))
  await user.type(screen.getByLabelText('Motivo de la anulación'), motivo)
  await user.click(screen.getByRole('button', { name: 'Anular venta' }))
}

describe('AnnulSaleDialog', () => {
  it('no permite confirmar con el motivo vacío', async () => {
    renderAnulacion()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Anular' }))

    expect(
      screen.getByRole('button', { name: 'Anular venta' }),
    ).toBeDisabled()
  })

  it('anula con motivo y cierra el diálogo al confirmar', async () => {
    let motivoEnviado = ''
    server.use(
      http.post(ANULACION_URL, async ({ request }) => {
        const cuerpo = (await request.json()) as { motivo?: string }
        motivoEnviado = cuerpo.motivo ?? ''
        return HttpResponse.json(ventaCompleta({ estado: 'anulada' }))
      }),
    )
    renderAnulacion()

    await abrirYConfirmar('Se equivoco el cliente')

    expect(motivoEnviado).toBe('Se equivoco el cliente')
    expect(screen.queryByText('Anular venta')).not.toBeInTheDocument()
  })

  it('muestra el 403 al intentar anular una venta de otro usuario', async () => {
    server.use(
      http.post(ANULACION_URL, () =>
        HttpResponse.json(
          {
            statusCode: 403,
            message: 'No puedes anular una venta registrada por otro usuario',
            error: 'Forbidden',
          },
          { status: 403 },
        ),
      ),
    )
    renderAnulacion()

    await abrirYConfirmar('Venta ajena')

    expect(
      await screen.findByText(/No puedes anular una venta/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Anular venta' }),
    ).toBeInTheDocument()
  })

  it('muestra el 409 al intentar anular una venta de otro día', async () => {
    server.use(
      http.post(ANULACION_URL, () =>
        HttpResponse.json(
          {
            statusCode: 409,
            message: 'Solo se pueden anular ventas del mismo dia',
            error: 'Conflict',
          },
          { status: 409 },
        ),
      ),
    )
    renderAnulacion()

    await abrirYConfirmar('Otro dia')

    expect(
      await screen.findByText(/Solo se pueden anular ventas del mismo día/),
    ).toBeInTheDocument()
  })
})