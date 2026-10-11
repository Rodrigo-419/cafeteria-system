import { http, HttpResponse } from 'msw'
import type {
  AlertaStockApi,
  CartaOferta,
  CategoriaProductoApi,
  EquipoApi,
  ProductoApi,
  RegistroAsistenciaApi,
  ReporteComparativoApi,
  RespuestaLogin,
  SucursalApi,
  UsuarioApi,
  VarianteApi,
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

// Catálogo de productos: fixtures base y estado mutable para las pruebas.
// El estado se reinicia entre pruebas con `reiniciarCatalogoPrueba`.
export const CATEGORIAS_PRUEBA: CategoriaProductoApi[] = [
  {
    id: 'c-1',
    nombre: 'Cafés',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'c-2',
    nombre: 'Bebidas',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
]

export const VARIANTES_PRUEBA: VarianteApi[] = [
  {
    id: 'v-0',
    nombre: 'Única',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'v-1',
    nombre: 'Mediano',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'v-2',
    nombre: 'Grande',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
]

export const PRODUCTOS_PRUEBA: ProductoApi[] = [
  {
    id: 'p-1',
    nombre: 'Café Americano',
    categoriaId: 'c-1',
    descripcion: 'Espresso con agua caliente',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    categoria: { id: 'c-1', nombre: 'Cafés' },
  },
  {
    id: 'p-2',
    nombre: 'Té Verde',
    categoriaId: 'c-2',
    descripcion: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    categoria: { id: 'c-2', nombre: 'Bebidas' },
  },
]

interface EstadoCatalogo {
  categorias: CategoriaProductoApi[]
  variantes: VarianteApi[]
  productos: ProductoApi[]
  carta: CartaOferta[]
}

function crearEstadoCatalogo(): EstadoCatalogo {
  return {
    categorias: CATEGORIAS_PRUEBA.map((c) => ({ ...c })),
    variantes: VARIANTES_PRUEBA.map((v) => ({ ...v })),
    productos: PRODUCTOS_PRUEBA.map((p) => ({
      ...p,
      categoria: { ...p.categoria },
    })),
    carta: CARTA_PRUEBA.map((o) => ({
      ...o,
      producto: { ...o.producto, categoria: { ...o.producto.categoria } },
      variante: { ...o.variante },
    })),
  }
}

let catalogo: EstadoCatalogo = crearEstadoCatalogo()

/** Restaura el catálogo mockeado a su estado inicial. */
export function reiniciarCatalogoPrueba(): void {
  catalogo = crearEstadoCatalogo()
}

function errorApi(status: number, mensaje: string, error: string) {
  return HttpResponse.json({ statusCode: status, message: mensaje, error }, { status })
}

function mensajePrecioInvalido(precio: unknown): string | null {
  if (typeof precio !== 'number' || !Number.isFinite(precio)) {
    return 'El precio debe ser un numero'
  }
  if (precio < 0.01 || precio > 100000) {
    return 'El precio debe estar entre 0.01 y 100000'
  }
  const decimales = (String(precio).split('.')[1] ?? '').length
  if (decimales > 2) {
    return 'El precio no puede tener mas de 2 decimales'
  }
  return null
}

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

  http.get(`${BASE_API}/branches/:sucursalId/products`, ({ request }) => {
    const url = new URL(request.url)
    const estado = url.searchParams.get('estado')
    let carta = catalogo.carta
    if (estado) carta = carta.filter((o) => o.estado === estado)
    return HttpResponse.json(carta)
  }),

  http.put(
    `${BASE_API}/branches/:sucursalId/products/:productoId/variants/:varianteId`,
    async ({ request, params }) => {
      const cuerpo = (await request.json()) as {
        precio?: unknown
        estado?: 'activo' | 'inactivo'
      }
      const problema = mensajePrecioInvalido(cuerpo.precio)
      if (problema) {
        return errorApi(400, problema, 'Bad Request')
      }
      const precio = cuerpo.precio as number
      const estadoFinal = cuerpo.estado ?? 'activo'
      const productoId = String(params.productoId)
      const varianteId = String(params.varianteId)
      const existente = catalogo.carta.find(
        (o) => o.productoId === productoId && o.varianteId === varianteId,
      )
      const producto =
        catalogo.productos.find((p) => p.id === productoId) ??
        existente?.producto
      const variante =
        catalogo.variantes.find((v) => v.id === varianteId) ??
        existente?.variante

      if (!producto || !variante) {
        return errorApi(404, 'El producto o la variante no existe', 'Not Found')
      }

      const precioTexto = precio.toFixed(2)
      catalogo.carta = [
        ...catalogo.carta.filter((o) => o !== existente),
        {
          id: existente?.id ?? `pv-${productoId}-${varianteId}`,
          productoId,
          varianteId,
          precio: precioTexto,
          estado: estadoFinal,
          producto: {
            id: producto.id,
            nombre: producto.nombre,
            categoriaId: producto.categoriaId,
            categoria: { ...producto.categoria },
          },
          variante: { id: variante.id, nombre: variante.nombre },
        },
      ]

      return HttpResponse.json({ precio: precioTexto, estado: estadoFinal })
    },
  ),

  http.get(`${BASE_API}/product-categories`, () =>
    HttpResponse.json(catalogo.categorias),
  ),

  http.post(`${BASE_API}/product-categories`, async ({ request }) => {
    const cuerpo = (await request.json()) as { nombre?: string }
    const nombre = (cuerpo.nombre ?? '').trim()
    if (
      catalogo.categorias.some(
        (c) => c.nombre.toLowerCase() === nombre.toLowerCase(),
      )
    ) {
      return errorApi(409, 'Ya existe una categoria con ese nombre', 'Conflict')
    }
    const ahora = new Date().toISOString()
    const categoria: CategoriaProductoApi = {
      id: `c-${catalogo.categorias.length + 1}`,
      nombre,
      createdAt: ahora,
      updatedAt: ahora,
    }
    catalogo.categorias = [...catalogo.categorias, categoria]
    return HttpResponse.json(categoria, { status: 201 })
  }),

  http.patch(`${BASE_API}/product-categories/:id`, async ({ request, params }) => {
    const cuerpo = (await request.json()) as { nombre?: string }
    const nombre = (cuerpo.nombre ?? '').trim()
    const categoria = catalogo.categorias.find((c) => c.id === params.id)
    if (!categoria) {
      return errorApi(404, 'La categoria no existe', 'Not Found')
    }
    if (
      catalogo.categorias.some(
        (c) =>
          c.id !== categoria.id && c.nombre.toLowerCase() === nombre.toLowerCase(),
      )
    ) {
      return errorApi(409, 'Ya existe una categoria con ese nombre', 'Conflict')
    }
    categoria.nombre = nombre
    catalogo.productos = catalogo.productos.map((p) =>
      p.categoriaId === categoria.id
        ? { ...p, categoria: { id: categoria.id, nombre } }
        : p,
    )
    return HttpResponse.json(categoria)
  }),

  http.delete(`${BASE_API}/product-categories/:id`, ({ params }) => {
    const categoria = catalogo.categorias.find((c) => c.id === params.id)
    if (!categoria) {
      return errorApi(404, 'La categoria no existe', 'Not Found')
    }
    if (catalogo.productos.some((p) => p.categoriaId === categoria.id)) {
      return errorApi(
        409,
        'No se puede eliminar una categoria con productos',
        'Conflict',
      )
    }
    catalogo.categorias = catalogo.categorias.filter(
      (c) => c.id !== categoria.id,
    )
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${BASE_API}/variants`, () => HttpResponse.json(catalogo.variantes)),

  http.post(`${BASE_API}/variants`, async ({ request }) => {
    const cuerpo = (await request.json()) as { nombre?: string }
    const nombre = (cuerpo.nombre ?? '').trim()
    if (
      catalogo.variantes.some(
        (v) => v.nombre.toLowerCase() === nombre.toLowerCase(),
      )
    ) {
      return errorApi(409, 'Ya existe una variante con ese nombre', 'Conflict')
    }
    const ahora = new Date().toISOString()
    const variante: VarianteApi = {
      id: `v-${catalogo.variantes.length + 10}`,
      nombre,
      createdAt: ahora,
      updatedAt: ahora,
    }
    catalogo.variantes = [...catalogo.variantes, variante]
    return HttpResponse.json(variante, { status: 201 })
  }),

  http.patch(`${BASE_API}/variants/:id`, async ({ request, params }) => {
    const cuerpo = (await request.json()) as { nombre?: string }
    const nombre = (cuerpo.nombre ?? '').trim()
    const variante = catalogo.variantes.find((v) => v.id === params.id)
    if (!variante) {
      return errorApi(404, 'La variante no existe', 'Not Found')
    }
    if (variante.nombre.toLowerCase() === 'única') {
      return errorApi(409, 'La variante base no se puede modificar', 'Conflict')
    }
    if (
      catalogo.variantes.some(
        (v) =>
          v.id !== variante.id && v.nombre.toLowerCase() === nombre.toLowerCase(),
      )
    ) {
      return errorApi(409, 'Ya existe una variante con ese nombre', 'Conflict')
    }
    variante.nombre = nombre
    return HttpResponse.json(variante)
  }),

  http.delete(`${BASE_API}/variants/:id`, ({ params }) => {
    const variante = catalogo.variantes.find((v) => v.id === params.id)
    if (!variante) {
      return errorApi(404, 'La variante no existe', 'Not Found')
    }
    if (variante.nombre.toLowerCase() === 'única') {
      return errorApi(409, 'La variante base no se puede eliminar', 'Conflict')
    }
    if (catalogo.carta.some((o) => o.varianteId === variante.id)) {
      return errorApi(
        409,
        'No se puede eliminar una variante con precios',
        'Conflict',
      )
    }
    catalogo.variantes = catalogo.variantes.filter((v) => v.id !== variante.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${BASE_API}/products`, ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.toLowerCase()
    const categoriaId = url.searchParams.get('categoriaId')
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '20')
    let items = catalogo.productos
    if (categoriaId) items = items.filter((p) => p.categoriaId === categoriaId)
    if (q) items = items.filter((p) => p.nombre.toLowerCase().includes(q))
    const total = items.length
    const inicio = (page - 1) * limit
    const data = items.slice(inicio, inicio + limit)
    return HttpResponse.json({
      data,
      total,
      page,
      limit,
      totalPaginas: Math.max(1, Math.ceil(total / limit)),
    })
  }),

  http.post(`${BASE_API}/products`, async ({ request }) => {
    const cuerpo = (await request.json()) as {
      nombre?: string
      categoriaId?: string
      descripcion?: string | null
    }
    const nombre = (cuerpo.nombre ?? '').trim()
    if (
      catalogo.productos.some(
        (p) => p.nombre.toLowerCase() === nombre.toLowerCase(),
      )
    ) {
      return errorApi(
        409,
        'Ya existe un producto con ese nombre en la categoria',
        'Conflict',
      )
    }
    const categoria = catalogo.categorias.find((c) => c.id === cuerpo.categoriaId)
    if (!categoria) {
      return errorApi(400, 'La categoria no existe', 'Bad Request')
    }
    const ahora = new Date().toISOString()
    const producto: ProductoApi = {
      id: `p-${catalogo.productos.length + 10}`,
      nombre,
      categoriaId: categoria.id,
      descripcion: cuerpo.descripcion ?? null,
      createdAt: ahora,
      updatedAt: ahora,
      categoria: { id: categoria.id, nombre: categoria.nombre },
    }
    catalogo.productos = [...catalogo.productos, producto]
    return HttpResponse.json(producto, { status: 201 })
  }),

  http.patch(`${BASE_API}/products/:id`, async ({ request, params }) => {
    const cuerpo = (await request.json()) as {
      nombre?: string
      categoriaId?: string
      descripcion?: string | null
    }
    const producto = catalogo.productos.find((p) => p.id === params.id)
    if (!producto) {
      return errorApi(404, 'Producto no encontrado', 'Not Found')
    }
    const nombre = (cuerpo.nombre ?? producto.nombre).trim()
    if (
      catalogo.productos.some(
        (p) => p.id !== producto.id && p.nombre.toLowerCase() === nombre.toLowerCase(),
      )
    ) {
      return errorApi(
        409,
        'Ya existe un producto con ese nombre en la categoria',
        'Conflict',
      )
    }
    const categoriaId = cuerpo.categoriaId ?? producto.categoriaId
    const categoria = catalogo.categorias.find((c) => c.id === categoriaId)
    producto.nombre = nombre
    producto.categoriaId = categoriaId
    producto.descripcion =
      cuerpo.descripcion === undefined ? producto.descripcion : cuerpo.descripcion
    if (categoria) {
      producto.categoria = { id: categoria.id, nombre: categoria.nombre }
    }
    producto.updatedAt = new Date().toISOString()
    return HttpResponse.json(producto)
  }),

  http.delete(`${BASE_API}/products/:id`, ({ params }) => {
    const producto = catalogo.productos.find((p) => p.id === params.id)
    if (!producto) {
      return errorApi(404, 'Producto no encontrado', 'Not Found')
    }
    if (catalogo.carta.some((o) => o.productoId === producto.id)) {
      return errorApi(
        409,
        'No se puede eliminar un producto con precios',
        'Conflict',
      )
    }
    catalogo.productos = catalogo.productos.filter((p) => p.id !== producto.id)
    return new HttpResponse(null, { status: 204 })
  }),

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
