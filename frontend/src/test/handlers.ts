import { http, HttpResponse } from 'msw'
import type {
  CartaOferta,
  RespuestaLogin,
  SucursalApi,
  UsuarioApi,
  VentaCompletaApi,
} from '@/types/api'

export const BASE_API = 'http://localhost/api'

export const USUARIO_PRUEBA: UsuarioApi = {
  id: 'usuario-1',
  nombre: 'Ada Pruebas',
  nombreUsuario: 'ada',
  rol: 'Gerente',
  sucursalId: 'sucursal-1',
  permisos: ['ventas.ver', 'productos.ver', 'ventas.registrar'],
}

export const RESPUESTA_LOGIN_PRUEBA: RespuestaLogin = {
  accessToken: 'token-de-pruebas',
  tokenType: 'Bearer',
  expiresIn: 28800,
  user: USUARIO_PRUEBA,
}

export const CREDENCIALES_VALIDAS = {
  nombreUsuario: 'ada',
  password: 'Secreta12345!',
}

export const SUCURSALES_PRUEBA: SucursalApi[] = [
  {
    id: 'sucursal-1',
    nombre: 'Sucursal Centro',
    direccion: 'Av. Central 123',
    telefono: null,
  },
  {
    id: 'sucursal-2',
    nombre: 'Sucursal Norte',
    direccion: 'Av. Norte 456',
    telefono: '555-0102',
  },
]

export const CARTA_PRUEBA: CartaOferta[] = [
  {
    id: 'pv-cafe-mediano',
    productoId: 'p-1',
    varianteId: 'v-1',
    precio: '10.00',
    estado: 'activo',
    producto: {
      id: 'p-1',
      nombre: 'Café Americano',
      categoriaId: 'c-1',
      categoria: { id: 'c-1', nombre: 'Cafés' },
    },
    variante: { id: 'v-1', nombre: 'Mediano' },
  },
  {
    id: 'pv-te-verde',
    productoId: 'p-2',
    varianteId: 'v-2',
    precio: '8.50',
    estado: 'activo',
    producto: {
      id: 'p-2',
      nombre: 'Té Verde',
      categoriaId: 'c-2',
      categoria: { id: 'c-2', nombre: 'Bebidas' },
    },
    variante: { id: 'v-2', nombre: 'Grande' },
  },
]

export function ventaCompleta(
  parciales: Partial<VentaCompletaApi> = {},
): VentaCompletaApi {
  return {
    id: 'venta-1',
    sucursalId: 'sucursal-1',
    usuarioId: 'usuario-1',
    metodoPago: 'efectivo',
    estado: 'completada',
    fechaAnulacion: null,
    usuarioAnuladorId: null,
    motivoAnulacion: null,
    createdAt: '2026-10-11T14:30:00.000Z',
    updatedAt: '2026-10-11T14:30:00.000Z',
    sucursal: { id: 'sucursal-1', nombre: 'Sucursal Centro' },
    vendedor: { id: 'usuario-1', nombre: 'Ada Pruebas' },
    anulador: null,
    fecha: '2026-10-11',
    total: '10.00',
    lineas: 1,
    detalles: [
      {
        id: 'detalle-1',
        productoSucursalVarianteId: 'pv-cafe-mediano',
        cantidad: 1,
        precioUnitario: '10.00',
        subtotal: '10.00',
        producto: { id: 'p-1', nombre: 'Café Americano' },
        variante: { id: 'v-1', nombre: 'Mediano' },
      },
    ],
    ...parciales,
  }
}

export const VENTA_ANULADA = ventaCompleta({
  id: 'venta-2',
  estado: 'anulada',
  fechaAnulacion: '2026-10-11T15:00:00.000Z',
  usuarioAnuladorId: 'usuario-1',
  motivoAnulacion: 'Se equivoco el cliente',
  anulador: { id: 'usuario-1', nombre: 'Ada Pruebas' },
})

/** Usuario de prueba con permisos efectivos arbitrarios. */
export function usuarioDePrueba(
  permisos: string[],
  parciales: Partial<UsuarioApi> = {},
): UsuarioApi {
  return {
    id: 'usuario-1',
    nombre: 'Ada Pruebas',
    nombreUsuario: 'ada',
    rol: 'Gerente',
    sucursalId: 'sucursal-1',
    permisos,
    ...parciales,
  }
}

export const handlers = [
  http.post(`${BASE_API}/auth/login`, async ({ request }) => {
    const cuerpo = (await request.json()) as {
      nombreUsuario?: string
      password?: string
    }

    if (
      cuerpo.nombreUsuario === CREDENCIALES_VALIDAS.nombreUsuario &&
      cuerpo.password === CREDENCIALES_VALIDAS.password
    ) {
      return HttpResponse.json(RESPUESTA_LOGIN_PRUEBA)
    }

    return HttpResponse.json(
      {
        statusCode: 401,
        message: 'Usuario o contrasena incorrectos',
        error: 'Unauthorized',
      },
      { status: 401 },
    )
  }),

  http.get(`${BASE_API}/auth/me`, () => HttpResponse.json(USUARIO_PRUEBA)),

  http.get(`${BASE_API}/branches/:sucursalId/products`, () =>
    HttpResponse.json(CARTA_PRUEBA),
  ),

  http.get(`${BASE_API}/branches`, () => HttpResponse.json(SUCURSALES_PRUEBA)),

  http.get(`${BASE_API}/sales`, ({ request }) => {
    const url = new URL(request.url)
    const estado = url.searchParams.get('estado')
    const metodoPago = url.searchParams.get('metodoPago')
    const sucursalId = url.searchParams.get('sucursalId')
    const fecha = url.searchParams.get('fecha')

    let ventas: VentaCompletaApi[] = [ventaCompleta(), VENTA_ANULADA]
    if (estado) ventas = ventas.filter((v) => v.estado === estado)
    if (metodoPago) ventas = ventas.filter((v) => v.metodoPago === metodoPago)
    if (sucursalId) ventas = ventas.filter((v) => v.sucursalId === sucursalId)
    if (fecha) ventas = ventas.filter((v) => v.fecha === fecha)

    return HttpResponse.json({
      data: ventas,
      total: ventas.length,
      page: 1,
      limit: 20,
      totalPaginas: Math.max(1, Math.ceil(ventas.length / 20)),
    })
  }),

  http.get(`${BASE_API}/sales/:id`, ({ params }) => {
    const venta = [ventaCompleta(), VENTA_ANULADA].find(
      (v) => v.id === params.id,
    )
    if (!venta) {
      return HttpResponse.json(
        {
          statusCode: 404,
          message: 'La venta no existe',
          error: 'Not Found',
        },
        { status: 404 },
      )
    }
    return HttpResponse.json(venta)
  }),

  http.post(`${BASE_API}/sales`, async ({ request }) => {
    const cuerpo = (await request.json()) as {
      metodoPago?: string
      items?: { productoSucursalVarianteId: string; cantidad: number }[]
    }
    const items = cuerpo.items ?? []
    let total = 0
    const detalles = items.map((item) => {
      const oferta = CARTA_PRUEBA.find(
        (o) => o.id === item.productoSucursalVarianteId,
      )
      const precio = oferta ? Number(oferta.precio) : 0
      const subtotal = precio * item.cantidad
      total += subtotal
      return {
        id: `detalle-${item.productoSucursalVarianteId}`,
        productoSucursalVarianteId: item.productoSucursalVarianteId,
        cantidad: item.cantidad,
        precioUnitario: precio.toFixed(2),
        subtotal: subtotal.toFixed(2),
        producto: {
          id: oferta?.producto.id ?? 'p-x',
          nombre: oferta?.producto.nombre ?? 'Producto',
        },
        variante: { id: oferta?.variante.id ?? 'v-x', nombre: oferta?.variante.nombre ?? 'Variante' },
      }
    })

    return HttpResponse.json(
      ventaCompleta({
        id: 'venta-nueva',
        metodoPago: cuerpo.metodoPago === 'tarjeta' ? 'tarjeta' : 'efectivo',
        total: total.toFixed(2),
        lineas: items.length,
        detalles,
      }),
      { status: 201 },
    )
  }),

  http.post(`${BASE_API}/sales/:id/anular`, async ({ request, params }) => {
    const cuerpo = (await request.json()) as { motivo?: string }
    const actual =
      [ventaCompleta(), VENTA_ANULADA].find((v) => v.id === params.id) ??
      ventaCompleta({ id: String(params.id) })
    return HttpResponse.json({
      ...actual,
      estado: 'anulada',
      fechaAnulacion: '2026-10-11T16:00:00.000Z',
      usuarioAnuladorId: 'usuario-1',
      motivoAnulacion: cuerpo.motivo ?? '',
      anulador: { id: 'usuario-1', nombre: 'Ada Pruebas' },
    })
  }),
]
