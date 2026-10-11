import { http, HttpResponse } from 'msw'
import type {
  AlertaStockApi,
  CartaOferta,
  EquipoApi,
  RegistroAsistenciaApi,
  ReporteComparativoApi,
  RespuestaLogin,
  SucursalApi,
  UsuarioApi,
  VentaCompletaApi,
} from '@/types/api'

export const BASE_API = 'http://localhost/api'

// Permisos efectivos por rol segun `docs/seguridad-y-permisos.md`.
export const PERMISOS_ADMIN: string[] = [
  'sucursales.crear_editar',
  'sucursales.ver',
  'usuarios.crear_editar',
  'permisos.asignar',
  'productos.catalogo.editar',
  'productos.ver',
  'insumos.catalogo.editar',
  'insumos.ver',
  'inventario.registrar',
  'inventario.minimo.editar',
  'inventario.recuento',
  'alertas.ver_resolver',
  'ventas.ver',
  'reportes.comparativos.ver',
  'empleados.crear_editar',
  'turnos.editar',
  'asistencia.marcar',
  'asistencia.ver',
  'equipo.registrar_editar',
  'equipo.ver',
]

export const PERMISOS_GERENTE: string[] = [
  'sucursales.ver',
  'usuarios.crear_editar',
  'permisos.asignar',
  'productos.precio.editar',
  'productos.ver',
  'insumos.ver',
  'inventario.registrar',
  'inventario.minimo.editar',
  'inventario.recuento',
  'alertas.ver_resolver',
  'ventas.registrar',
  'ventas.anular',
  'ventas.ver',
  'empleados.crear_editar',
  'turnos.editar',
  'asistencia.marcar',
  'asistencia.corregir',
  'asistencia.ver',
  'equipo.registrar_editar',
  'equipo.ver',
]

export const PERMISOS_EMPLEADO: string[] = [
  'sucursales.ver',
  'productos.ver',
  'ventas.anular',
  'asistencia.marcar',
  'asistencia.ver',
]

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

export const ALERTAS_PRUEBA: AlertaStockApi[] = [
  {
    id: 'alerta-1',
    insumoSucursalId: 'is-1',
    estado: 'abierta',
    fechaResuelta: null,
    createdAt: '2026-10-11T13:00:00.000Z',
    updatedAt: '2026-10-11T13:00:00.000Z',
    insumoSucursal: {
      id: 'is-1',
      insumoId: 'i-1',
      sucursalId: 'sucursal-1',
      stockActual: '2.00',
      stockMinimo: '5.00',
      estado: 'activo',
      insumo: { id: 'i-1', nombre: 'Café en grano', presentacion: 'kg' },
    },
  },
]

export const REGISTROS_PRUEBA: RegistroAsistenciaApi[] = [
  {
    id: 'registro-1',
    empleadoId: 'usuario-2',
    sucursalId: 'sucursal-1',
    tipo: 'entrada',
    fechaHora: '2026-10-11T13:05:00.000Z',
    metodo: 'pin',
    abierta: true,
    corregido: false,
    empleado: { id: 'usuario-2', nombre: 'Beto Turno' },
  },
]

export const EQUIPOS_PRUEBA: EquipoApi[] = [
  {
    id: 'equipo-1',
    sucursalId: 'sucursal-1',
    nombre: 'Máquina de espresso',
    tipo: 'cafetera',
    estado: 'funcionando',
    observaciones: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'equipo-2',
    sucursalId: 'sucursal-1',
    nombre: 'Molino',
    tipo: 'molino',
    estado: 'en_mantenimiento',
    observaciones: 'Revisión programada',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
  },
  {
    id: 'equipo-3',
    sucursalId: 'sucursal-1',
    nombre: 'Refrigeradora',
    tipo: 'refrigeradora',
    estado: 'danado',
    observaciones: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
  },
]

export const REPORTE_COMPARATIVO_PRUEBA: ReporteComparativoApi = {
  desde: '2026-10-11',
  hasta: '2026-10-11',
  generadoEn: '2026-10-11T20:00:00.000Z',
  sucursales: [
    {
      sucursalId: 'sucursal-1',
      sucursalNombre: 'Sucursal Centro',
      ventas: {
        total: '100.00',
        cantidad: 10,
        ticketPromedio: '10.00',
        porMetodoPago: {
          efectivo: { total: '60.00', cantidad: 6 },
          tarjeta: { total: '40.00', cantidad: 4 },
        },
        anuladas: { cantidad: 1 },
      },
      inventario: {
        movimientos: {
          total: 3,
          entradas: { cantidad: 2, cantidadNeta: '10.00' },
          ajustes: { cantidad: 1, cantidadNeta: '-1.00' },
        },
      },
      asistencia: { faltas: 1, faltasJustificadas: 0 },
      estadoActual: { insumosConAlertaAbierta: 1, entradasAbiertas: 1 },
    },
  ],
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

  http.get(`${BASE_API}/inventario/alertas`, ({ request }) => {
    const url = new URL(request.url)
    const estado = url.searchParams.get('estado')
    let alertas = ALERTAS_PRUEBA
    if (estado) alertas = alertas.filter((a) => a.estado === estado)
    return HttpResponse.json({
      data: alertas,
      total: alertas.length,
      page: 1,
      limit: 20,
      totalPaginas: 1,
    })
  }),

  http.get(`${BASE_API}/attendance/records`, ({ request }) => {
    const url = new URL(request.url)
    const abierta = url.searchParams.get('abierta')
    let registros = REGISTROS_PRUEBA
    if (abierta !== null) {
      registros = registros.filter((r) => String(r.abierta) === abierta)
    }
    return HttpResponse.json({
      items: registros,
      total: registros.length,
      page: 1,
      limit: 20,
    })
  }),

  http.get(`${BASE_API}/equipment`, ({ request }) => {
    const url = new URL(request.url)
    const estado = url.searchParams.get('estado')
    let equipos = EQUIPOS_PRUEBA
    if (estado) equipos = equipos.filter((e) => e.estado === estado)
    return HttpResponse.json({
      data: equipos,
      total: equipos.length,
      page: 1,
      limit: 20,
      totalPaginas: 1,
    })
  }),

  http.get(`${BASE_API}/reports/comparativo`, () =>
    HttpResponse.json(REPORTE_COMPARATIVO_PRUEBA),
  ),
]
