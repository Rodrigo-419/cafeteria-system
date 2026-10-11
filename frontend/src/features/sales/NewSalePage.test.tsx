import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { NewSalePage } from './NewSalePage'
import { iniciarSesionDePrueba, renderConProveedores } from '@/test/render'
import {
  BASE_API,
  CARTA_PRUEBA,
  USUARIO_PRUEBA,
  usuarioDePrueba,
  ventaCompleta,
} from '@/test/handlers'
import { server } from '@/test/server'

function renderNuevaVenta(usuario = USUARIO_PRUEBA) {
  iniciarSesionDePrueba(usuario)
  return renderConProveedores(<NewSalePage />)
}

async function agregarProductoAlCarrito(nombre = 'Café Americano') {
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole('button', { name: `Agregar ${nombre}` }),
  )
  return user
}

describe('NewSalePage', () => {
  it('muestra la carta de la sucursal por categoría', async () => {
    renderNuevaVenta()

    expect(
      await screen.findByRole('button', { name: 'Cafés' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Café Americano')).toBeInTheDocument()
    expect(screen.getByText('Té Verde')).toBeInTheDocument()
  })

  it('deshabilita el botón de registrar con el carrito vacío', async () => {
    renderNuevaVenta()

    expect(
      screen.getByRole('button', { name: 'Registrar venta' }),
    ).toBeDisabled()
  })

  it('registra la venta y muestra la confirmación con los datos del servidor', async () => {
    let cuerpo = {}
    server.use(
      http.post(`${BASE_API}/sales`, async ({ request }) => {
        cuerpo = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(ventaCompleta(), { status: 201 })
      }),
    )
    renderNuevaVenta()

    await agregarProductoAlCarrito()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    expect(cuerpo).toMatchObject({
      metodoPago: 'efectivo',
      items: [{ productoSucursalVarianteId: 'pv-cafe-mediano', cantidad: 1 }],
    })
    expect(await screen.findByText('Venta registrada')).toBeInTheDocument()
    expect(screen.getByText(/venta-1/)).toBeInTheDocument()
  })

  it('no envía una segunda petición si se hace clic dos veces durante el envío', async () => {
    let llamadas = 0
    server.use(
      http.post(`${BASE_API}/sales`, async () => {
        llamadas += 1
        await new Promise((resolver) => setTimeout(resolver, 100))
        return HttpResponse.json(ventaCompleta(), { status: 201 })
      }),
    )
    renderNuevaVenta()

    const user = await agregarProductoAlCarrito()
    const boton = screen.getByRole('button', { name: 'Registrar venta' })
    await user.click(boton)
    await user.click(boton)

    expect(await screen.findByText('Venta registrada')).toBeInTheDocument()
    expect(llamadas).toBe(1)
  })

  it('avisa cuando una oferta está inactiva (409)', async () => {
    server.use(
      http.post(`${BASE_API}/sales`, () =>
        HttpResponse.json(
          {
            statusCode: 409,
            message: 'Una de las ofertas esta inactiva',
            error: 'Conflict',
          },
          { status: 409 },
        ),
      ),
    )
    renderNuevaVenta()

    await agregarProductoAlCarrito()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Registrar venta' }))

    expect(await screen.findByText(/inactiva/i)).toBeInTheDocument()
  })

  it('no muestra la carta sin el permiso productos.ver', async () => {
    const empleado = usuarioDePrueba(['ventas.registrar'], {
      rol: 'Empleado',
    })
    renderNuevaVenta(empleado)

    expect(
      await screen.findByText('No puedes ver la carta'),
    ).toBeInTheDocument()
    expect(screen.queryByText(CARTA_PRUEBA[0].producto.nombre)).not.toBeInTheDocument()
  })
})