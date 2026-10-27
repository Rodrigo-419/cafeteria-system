import { http, HttpResponse } from 'msw'
import type {
  AccionAuditoria,
  AlertaStockApi,
  AsignacionApi,
  CartaOferta,
  CategoriaProductoApi,
  CorreccionAsistenciaApi,
  EmpleadoApi,
  EquipoApi,
  EstadoEquipo,
  EstadoStockInsumo,
  EstadoUsuario,
  EventoAuditoriaApi,
  FaltaApi,
  HistorialEquipoApi,
  InsumoApi,
  JustificacionFaltaApi,
  LineaRecuentoApi,
  MovimientoInventarioApi,
  PresentacionInsumo,
  PermisoEfectivoApi,
  ProductoApi,
  RecuentoDetalleApi,
  RegistroAsistenciaApi,
  RegistroMarcajeApi,
  ReporteComparativoApi,
  ReporteSucursalApi,
  RespuestaLogin,
  StockInsumoApi,
  SucursalApi,
  TurnoApi,
  UsuarioApi,
  UsuarioGestionApi,
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

// Catálogo completo de permisos con sus descripciones (mismo de `seed.ts`).
// Los ids son simulados; en producción el backend genera los UUID y la interfaz
// solo conoce los que recibe dentro de `GET /users/:id/permisos`.
function idDePermiso(codigo: string): string {
  return `perm-${codigo.replace(/\./g, '-')}`
}

export interface PermisoCatalogoPrueba {
  id: string
  codigo: string
  descripcion: string
}

export const CATALOGO_PERMISOS_PRUEBA: PermisoCatalogoPrueba[] = (
  [
    { codigo: 'sucursales.crear_editar', descripcion: 'Crear y editar sucursales' },
    { codigo: 'sucursales.ver', descripcion: 'Ver sucursales' },
    { codigo: 'usuarios.crear_editar', descripcion: 'Crear y editar usuarios' },
    { codigo: 'permisos.asignar', descripcion: 'Asignar y revocar permisos de usuarios' },
    { codigo: 'productos.catalogo.editar', descripcion: 'Editar el catalogo de productos' },
    { codigo: 'productos.precio.editar', descripcion: 'Editar precios de productos por sucursal' },
    { codigo: 'productos.ver', descripcion: 'Ver productos' },
    { codigo: 'insumos.catalogo.editar', descripcion: 'Editar el catalogo de insumos' },
    { codigo: 'insumos.ver', descripcion: 'Ver insumos' },
    { codigo: 'inventario.registrar', descripcion: 'Registrar movimientos de inventario' },
    { codigo: 'inventario.minimo.editar', descripcion: 'Editar el stock minimo de los insumos' },
    { codigo: 'inventario.recuento', descripcion: 'Registrar recuentos de inventario' },
    { codigo: 'alertas.ver_resolver', descripcion: 'Ver y resolver alertas de stock' },
    { codigo: 'ventas.registrar', descripcion: 'Registrar ventas' },
    { codigo: 'ventas.anular', descripcion: 'Anular ventas del dia' },
    { codigo: 'ventas.ver', descripcion: 'Ver ventas' },
    { codigo: 'reportes.comparativos.ver', descripcion: 'Ver reportes comparativos entre sucursales' },
    { codigo: 'empleados.crear_editar', descripcion: 'Crear y editar empleados' },
    { codigo: 'turnos.editar', descripcion: 'Editar turnos y asignaciones' },
    { codigo: 'asistencia.marcar', descripcion: 'Marcar entradas y salidas' },
    { codigo: 'asistencia.corregir', descripcion: 'Corregir registros de asistencia' },
    { codigo: 'asistencia.ver', descripcion: 'Ver registros de asistencia' },
    { codigo: 'equipo.registrar_editar', descripcion: 'Registrar y editar equipos' },
    { codigo: 'equipo.ver', descripcion: 'Ver equipos y su historial' },
  ] as const
).map((permiso) => ({
  ...permiso,
  id: idDePermiso(permiso.codigo),
}))

/** Permisos que cada rol otorga por defecto (matriz de `seguridad-y-permisos.md`). */
export const DEFAULT_PERMISOS_POR_ROL: Record<string, string[]> = {
  Admin: PERMISOS_ADMIN,
  Gerente: PERMISOS_GERENTE,
  Empleado: PERMISOS_EMPLEADO,
}

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

// Inventario: insumos, stock por sucursal y alertas.
//
// El estado es mutable y se reinicia entre pruebas con
// `reiniciarInventarioPrueba`. Las alertas no se editan a mano: se
// sincronizan a partir del stock (stock activo <= mínimo abre; reponer o
// descontinuar cierra).
export const INSUMOS_PRUEBA: InsumoApi[] = [
  {
    id: 'i-1',
    nombre: 'Café en grano',
    presentacion: 'bolsa',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'i-2',
    nombre: 'Leche entera',
    presentacion: 'caja',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'i-3',
    nombre: 'Vasos 12oz',
    presentacion: 'paquete',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
]

export const PRESENTACIONES_INSUMO_PRUEBA: PresentacionInsumo[] = [
  'paquete',
  'bolsa',
  'caja',
  'unidad',
  'paquete_varias_unidades',
]

interface EstadoInventario {
  insumos: InsumoApi[]
  stock: StockInsumoApi[]
  alertas: AlertaStockApi[]
  movimientos: MovimientoInventarioApi[]
  recuentos: RecuentoDetalleApi[]
}

function crearFilaStock(
  insumo: InsumoApi,
  sucursalId: string,
  sobre: Partial<
    Pick<StockInsumoApi, 'id' | 'stockActual' | 'stockMinimo' | 'estado'>
  > = {},
): StockInsumoApi {
  return {
    id: sobre.id ?? `is-${insumo.id}-${sucursalId}`,
    insumoId: insumo.id,
    sucursalId,
    stockActual: sobre.stockActual ?? '0.00',
    stockMinimo: sobre.stockMinimo ?? '0.00',
    estado: sobre.estado ?? 'activo',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    insumo: { ...insumo },
  }
}

function crearEstadoInventario(): EstadoInventario {
  const insumos = INSUMOS_PRUEBA.map((insumo) => ({ ...insumo }))
  const porId = new Map(insumos.map((insumo) => [insumo.id, insumo]))
  const stock: StockInsumoApi[] = [
    crearFilaStock(porId.get('i-1')!, 'sucursal-1', {
      id: 'is-1',
      stockActual: '2.00',
      stockMinimo: '5.00',
    }),
    crearFilaStock(porId.get('i-2')!, 'sucursal-1', {
      id: 'is-2',
      stockActual: '20.00',
      stockMinimo: '10.00',
    }),
    crearFilaStock(porId.get('i-3')!, 'sucursal-1', {
      id: 'is-3',
      stockActual: '3.00',
      stockMinimo: '0.00',
      estado: 'descontinuado',
    }),
  ]
  const fila1 = stock[0]!
  const estado: EstadoInventario = {
    insumos,
    stock,
    alertas: [],
    movimientos: [
      {
        id: 'mov-1',
        insumoSucursalId: 'is-2',
        tipo: 'entrada',
        cantidad: '5.00',
        usuarioId: 'usuario-1',
        motivo: 'Compra semanal',
        createdAt: '2026-10-10T09:00:00.000Z',
      },
      {
        id: 'mov-2',
        insumoSucursalId: 'is-1',
        tipo: 'ajuste',
        cantidad: '-1.00',
        usuarioId: 'usuario-1',
        motivo: 'Recuento físico',
        createdAt: '2026-10-10T12:00:00.000Z',
      },
    ],
    recuentos: [
      {
        id: 'rec-1',
        sucursalId: 'sucursal-1',
        usuarioId: 'usuario-1',
        createdAt: '2026-10-10T12:00:00.000Z',
        usuario: { id: 'usuario-1', nombre: 'Ada Pruebas' },
        sucursal: { id: 'sucursal-1', nombre: 'Sucursal Centro' },
        detalles: [
          {
            id: 'rec-1-d1',
            recuentoId: 'rec-1',
            insumoSucursalId: 'is-1',
            stockSistema: '3.00',
            stockFisico: '2.00',
            diferencia: '-1.00',
            createdAt: '2026-10-10T12:00:00.000Z',
            insumoSucursal: { ...fila1, insumo: { ...fila1.insumo } },
          },
        ],
      },
    ],
  }
  sincronizarAlertas(estado)
  return estado
}

function sincronizarAlertas(estado: EstadoInventario): void {
  const ahora = '2026-10-11T13:00:00.000Z'
  for (const fila of estado.stock) {
    const abierta = estado.alertas.find(
      (alerta) =>
        alerta.insumoSucursalId === fila.id && alerta.estado === 'abierta',
    )
    const necesitaAlerta =
      fila.estado === 'activo' &&
      Number(fila.stockActual) <= Number(fila.stockMinimo)
    if (necesitaAlerta && !abierta) {
      estado.alertas.push({
        id: `alerta-${fila.id}`,
        insumoSucursalId: fila.id,
        estado: 'abierta',
        fechaResuelta: null,
        createdAt: ahora,
        updatedAt: ahora,
        insumoSucursal: { ...fila, insumo: { ...fila.insumo } },
      })
    } else if (!necesitaAlerta && abierta) {
      abierta.estado = 'resuelta'
      abierta.fechaResuelta = ahora
      abierta.updatedAt = ahora
      abierta.insumoSucursal = { ...fila, insumo: { ...fila.insumo } }
    } else if (abierta) {
      abierta.insumoSucursal = { ...fila, insumo: { ...fila.insumo } }
    }
  }
}

let inventario: EstadoInventario = crearEstadoInventario()

/** Registra un recuento: fija el stock, genera ajustes y devuelve el detalle. */
function crearRecuentoDetalle(
  estado: EstadoInventario,
  sucursalId: string,
  items: { insumoId: string; stockFisico: number }[],
): RecuentoDetalleApi {
  const ahora = new Date().toISOString()
  const id = `rec-${estado.recuentos.length + 1}`
  const sucursal = SUCURSALES_PRUEBA.find((s) => s.id === sucursalId)
  const detalles: LineaRecuentoApi[] = []
  items.forEach((item, indice) => {
    const fila = estado.stock.find(
      (f) => f.sucursalId === sucursalId && f.insumoId === item.insumoId,
    )!
    const stockSistema = fila.stockActual
    const stockFisico = item.stockFisico.toFixed(2)
    const diferencia = (Number(stockFisico) - Number(stockSistema)).toFixed(2)
    fila.stockActual = stockFisico
    fila.updatedAt = ahora
    if (diferencia !== '0.00') {
      estado.movimientos.push({
        id: `mov-${id}-${indice}`,
        insumoSucursalId: fila.id,
        tipo: 'ajuste',
        cantidad: diferencia,
        usuarioId: 'usuario-1',
        motivo: 'Recuento físico',
        createdAt: ahora,
      })
    }
    detalles.push({
      id: `${id}-d${indice}`,
      recuentoId: id,
      insumoSucursalId: fila.id,
      stockSistema,
      stockFisico,
      diferencia,
      createdAt: ahora,
      insumoSucursal: { ...fila, insumo: { ...fila.insumo } },
    })
  })
  const recuento: RecuentoDetalleApi = {
    id,
    sucursalId,
    usuarioId: 'usuario-1',
    createdAt: ahora,
    usuario: { id: 'usuario-1', nombre: 'Ada Pruebas' },
    sucursal: { id: sucursalId, nombre: sucursal?.nombre ?? 'Sucursal' },
    detalles,
  }
  estado.recuentos.push(recuento)
  sincronizarAlertas(estado)
  return recuento
}

/** Restaura el inventario mockeado (insumos, stock y alertas) a su inicio. */
export function reiniciarInventarioPrueba(): void {
  inventario = crearEstadoInventario()
}

function paginar<T>(items: T[], page: number, limit: number) {
  const total = items.length
  const inicio = (page - 1) * limit
  return {
    data: items.slice(inicio, inicio + limit),
    total,
    page,
    limit,
    totalPaginas: Math.max(1, Math.ceil(total / limit)),
  }
}

function sucursalValida(sucursalId: string): boolean {
  return SUCURSALES_PRUEBA.some((sucursal) => sucursal.id === sucursalId)
}

function mensajeCantidadInvalida(
  valor: unknown,
  etiqueta: string,
): string | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return `La ${etiqueta} debe ser un numero`
  }
  if (valor < 0) {
    return `La ${etiqueta} no puede ser negativa`
  }
  const decimales = (String(valor).split('.')[1] ?? '').length
  if (decimales > 2) {
    return `La ${etiqueta} no puede tener mas de 2 decimales`
  }
  return null
}

export const REGISTROS_PRUEBA: RegistroAsistenciaApi[] = [
  {
    id: 'registro-0',
    empleadoId: 'usuario-2',
    sucursalId: 'sucursal-1',
    tipo: 'salida',
    fechaHora: '2026-10-10T21:00:00.000Z',
    metodo: 'pin',
    abierta: false,
    corregido: false,
    empleado: { id: 'usuario-2', nombre: 'Beto Turno' },
  },
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
  {
    id: 'registro-2',
    empleadoId: 'usuario-3',
    sucursalId: 'sucursal-2',
    tipo: 'entrada',
    fechaHora: '2026-10-11T13:00:00.000Z',
    metodo: 'pin',
    abierta: true,
    corregido: false,
    empleado: { id: 'usuario-3', nombre: 'Ciro Ruiz' },
  },
]

// ---------------------------------------------------------------- asistencia
//
// Fixtures y estado mutable del módulo de asistencia. El alcance depende del
// actor, que fija `iniciarSesionDePrueba` (o `establecerActorAsistencia`); el
// estado se reinicia entre pruebas con `reiniciarAsistenciaPrueba`.

/** PIN de seis dígitos válido para todos los empleados del terminal de prueba. */
export const PIN_TERMINAL_VALIDO = '123456'

/**
 * Empleados activos por sucursal que ofrece el terminal. El backend solo
 * devuelve `{ id, nombre }`; `sucursalId` se usa aquí para acotar el alcance.
 */
export const EMPLEADOS_TERMINAL_PRUEBA = [
  { id: 'usuario-2', nombre: 'Beto Turno', sucursalId: 'sucursal-1' },
  { id: 'usuario-4', nombre: 'Dora Nueva', sucursalId: 'sucursal-1' },
  { id: 'usuario-3', nombre: 'Ciro Ruiz', sucursalId: 'sucursal-2' },
]

/** Faltas calculadas de referencia (`GET /attendance/absences`). */
export const FALTAS_PRUEBA: FaltaApi[] = [
  {
    empleadoId: 'usuario-2',
    empleadoNombre: 'Beto Turno',
    sucursalId: 'sucursal-1',
    fecha: '2026-10-05',
    turno: { tipo: 'fijo', diasSemana: '1,2,3,4,5' },
  },
  {
    empleadoId: 'usuario-4',
    empleadoNombre: 'Dora Nueva',
    sucursalId: 'sucursal-1',
    fecha: '2026-10-06',
    turno: { tipo: 'fijo', diasSemana: '1,2,3,4,5' },
  },
]

interface IntentosPin {
  fallos: number
  inicioVentanaMs: number | null
}

interface EstadoAsistencia {
  registros: RegistroAsistenciaApi[]
  correcciones: Map<string, CorreccionAsistenciaApi[]>
  justificaciones: JustificacionFaltaApi[]
  fallosPin: Map<string, IntentosPin>
  secuencia: number
}

function clonarRegistroAsistencia(
  registro: RegistroAsistenciaApi,
): RegistroAsistenciaApi {
  return { ...registro, empleado: { ...registro.empleado } }
}

/** Día de negocio lima ("AAAA-MM-DD") de un instante ISO. */
function diaLimaDeIso(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

function registroDeHoy(
  id: string,
  empleado: { id: string; nombre: string; sucursalId: string },
  tipo: 'entrada' | 'salida',
  abierta: boolean,
): RegistroAsistenciaApi {
  return {
    id,
    empleadoId: empleado.id,
    sucursalId: empleado.sucursalId,
    tipo,
    fechaHora: `${diaNegocioPrueba()}T13:00:00.000Z`,
    metodo: 'pin',
    abierta,
    corregido: false,
    empleado: { id: empleado.id, nombre: empleado.nombre },
  }
}

function crearEstadoAsistencia(): EstadoAsistencia {
  const dora = EMPLEADOS_TERMINAL_PRUEBA.find(
    (empleado) => empleado.id === 'usuario-4',
  )!
  return {
    registros: [
      ...REGISTROS_PRUEBA.map(clonarRegistroAsistencia),
      // Dora ya marcó entrada hoy y sigue abierta: una entrada nueva da 409.
      registroDeHoy('registro-dora-hoy', dora, 'entrada', true),
    ],
    correcciones: new Map(),
    justificaciones: [],
    fallosPin: new Map(),
    secuencia: 0,
  }
}

let asistencia: EstadoAsistencia = crearEstadoAsistencia()

// Actor vigente para el alcance de asistencia. Si es `null` no se aplica
// alcance (útil para pruebas que no inician sesión); `iniciarSesionDePrueba`
// lo fija.
let actorAsistencia: UsuarioApi | null = null

export function establecerActorAsistencia(usuario: UsuarioApi | null): void {
  actorAsistencia = usuario
}

/** Restaura el estado de asistencia y limpia el actor de alcance. */
export function reiniciarAsistenciaPrueba(): void {
  asistencia = crearEstadoAsistencia()
  actorAsistencia = null
}

function asistenciaEsAdmin(): boolean {
  if (!actorAsistencia) return true
  return (actorAsistencia.rol ?? '').toLowerCase() === 'admin'
}

function asistenciaEsEmpleado(): boolean {
  if (!actorAsistencia) return false
  return (actorAsistencia.rol ?? '').toLowerCase() === 'empleado'
}

function sucursalAsistencia(): string | null {
  return actorAsistencia?.sucursalId ?? null
}

/** true si hay un actor sin sucursal (Admin), que no puede marcar. */
function sinSucursalParaMarcar(): boolean {
  return actorAsistencia !== null && sucursalAsistencia() === null
}

/**
 * Alcance de lectura (mismo criterio que `alcance.ts` del backend): el Admin ve
 * todo, el Gerente su sucursal y el Empleado solo lo suyo. En las fixtures el
 * `empleadoId` coincide con el id del usuario, así que un Empleado solo ve los
 * registros de su propio id.
 */
function registroVisible(registro: RegistroAsistenciaApi): boolean {
  if (asistenciaEsAdmin()) return true
  if (asistenciaEsEmpleado()) return registro.empleadoId === actorAsistencia?.id
  return registro.sucursalId === sucursalAsistencia()
}

/** Alcance de lectura de faltas, con el mismo criterio que los registros. */
function faltaVisible(falta: FaltaApi): boolean {
  if (asistenciaEsAdmin()) return true
  if (asistenciaEsEmpleado()) return falta.empleadoId === actorAsistencia?.id
  return falta.sucursalId === sucursalAsistencia()
}

const VENTANA_FALLOS_PIN_MS = 60_000
const MAXIMO_FALLOS_PIN = 5

function pinBloqueado(empleadoId: string, ahoraMs: number): boolean {
  const estado = asistencia.fallosPin.get(empleadoId)
  if (!estado || estado.inicioVentanaMs === null) return false
  return (
    estado.fallos >= MAXIMO_FALLOS_PIN &&
    ahoraMs - estado.inicioVentanaMs < VENTANA_FALLOS_PIN_MS
  )
}

function registrarFalloPin(empleadoId: string, ahoraMs: number): void {
  const estado = asistencia.fallosPin.get(empleadoId)
  const vigente =
    estado !== null &&
    estado !== undefined &&
    estado.inicioVentanaMs !== null &&
    ahoraMs - estado.inicioVentanaMs < VENTANA_FALLOS_PIN_MS
  if (!vigente) {
    asistencia.fallosPin.set(empleadoId, {
      fallos: 1,
      inicioVentanaMs: ahoraMs,
    })
    return
  }
  asistencia.fallosPin.set(empleadoId, {
    fallos: estado.fallos + 1,
    inicioVentanaMs: estado.inicioVentanaMs,
  })
}

/** true si la falta (empleado + día) ya fue justificada. */
function faltaJustificada(empleadoId: string, fecha: string): boolean {
  return asistencia.justificaciones.some(
    (justificacion) =>
      justificacion.empleadoId === empleadoId &&
      justificacion.fecha.slice(0, 10) === fecha,
  )
}

export const ESTADOS_EQUIPO_PRUEBA: EstadoEquipo[] = [
  'funcionando',
  'danado',
  'en_mantenimiento',
  'retirado',
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
  {
    id: 'equipo-4',
    sucursalId: 'sucursal-1',
    nombre: 'Licuadora industrial',
    tipo: 'licuadora',
    estado: 'retirado',
    observaciones: 'Dado de baja',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-09T09:00:00.000Z',
  },
  {
    id: 'equipo-5',
    sucursalId: 'sucursal-2',
    nombre: 'Vitrina refrigerada',
    tipo: 'vitrina',
    estado: 'funcionando',
    observaciones: null,
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
  },
]

export const HISTORIAL_EQUIPOS_PRUEBA: HistorialEquipoApi[] = [
  {
    id: 'hist-equipo-2-1',
    equipoId: 'equipo-2',
    estadoAnterior: 'funcionando',
    estadoNuevo: 'en_mantenimiento',
    observacionesAnterior: null,
    observacionesNuevas: 'Revisión programada',
    usuarioId: 'usuario-1',
    createdAt: '2026-10-10T10:00:00.000Z',
    usuario: { id: 'usuario-1', nombre: 'Ada Pruebas' },
  },
  {
    id: 'hist-equipo-3-1',
    equipoId: 'equipo-3',
    estadoAnterior: 'funcionando',
    estadoNuevo: 'danado',
    observacionesAnterior: null,
    observacionesNuevas: null,
    usuarioId: 'usuario-1',
    createdAt: '2026-10-10T11:00:00.000Z',
    usuario: { id: 'usuario-1', nombre: 'Ada Pruebas' },
  },
  {
    id: 'hist-equipo-4-1',
    equipoId: 'equipo-4',
    estadoAnterior: 'danado',
    estadoNuevo: 'retirado',
    observacionesAnterior: null,
    observacionesNuevas: 'Dado de baja',
    usuarioId: 'usuario-1',
    createdAt: '2026-10-09T09:00:00.000Z',
    usuario: { id: 'usuario-1', nombre: 'Ada Pruebas' },
  },
]

interface EstadoEquipos {
  equipos: EquipoApi[]
  historial: HistorialEquipoApi[]
}

function crearEstadoEquipos(): EstadoEquipos {
  return {
    equipos: EQUIPOS_PRUEBA.map((equipo) => ({ ...equipo })),
    historial: HISTORIAL_EQUIPOS_PRUEBA.map((entrada) => ({
      ...entrada,
      usuario: entrada.usuario ? { ...entrada.usuario } : null,
    })),
  }
}

let equipos: EstadoEquipos = crearEstadoEquipos()

// Actor vigente para el alcance de equipos. Si es `null` no se aplica alcance
// (útil para pruebas que no inician sesión); `iniciarSesionDePrueba` lo fija.
let actorEquipos: UsuarioApi | null = null

export function establecerActorEquipos(usuario: UsuarioApi | null): void {
  actorEquipos = usuario
}

/** Restaura los equipos y su historial, y limpia el actor de alcance. */
export function reiniciarEquiposPrueba(): void {
  equipos = crearEstadoEquipos()
  actorEquipos = null
}

function actorEsAdmin(): boolean {
  if (!actorEquipos) return true
  return (actorEquipos.rol ?? '').toLowerCase() === 'admin'
}

function equipoVisible(equipo: EquipoApi): boolean {
  if (actorEsAdmin()) return true
  return equipo.sucursalId === (actorEquipos?.sucursalId ?? null)
}

function equipoFueraDeAlcance() {
  return errorApi(404, 'El equipo no existe', 'Not Found')
}

// Empleados: personal vinculado a un usuario existente.
//
// El estado es mutable y se reinicia entre pruebas con
// `reiniciarEmpleadosPrueba`. Los fixtures cubren un Admin (todos), un Gerente
// (solo empleados de usuarios Empleado de su sucursal) y un cesado. El actor de
// alcance lo fija `iniciarSesionDePrueba` con `establecerActorEmpleados`.
const USUARIOS_POR_EMPLEADO: Record<
  string,
  { nombre: string; nombreUsuario: string; rol: string }
> = {
  'usuario-1': { nombre: 'Ada Pruebas', nombreUsuario: 'ada', rol: 'Gerente' },
  'usuario-2': { nombre: 'Beto Turno', nombreUsuario: 'beto', rol: 'Empleado' },
  'usuario-3': { nombre: 'Ciro Ruiz', nombreUsuario: 'ciro', rol: 'Empleado' },
}

export const EMPLEADOS_PRUEBA: EmpleadoApi[] = [
  {
    id: 'empleado-1',
    usuarioId: 'usuario-1',
    cargo: 'Gerente de tienda',
    sucursalId: 'sucursal-1',
    fechaContratacion: '2026-01-15T00:00:00.000Z',
    fechaCese: null,
    estado: 'activo',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    usuario: { id: 'usuario-1', ...USUARIOS_POR_EMPLEADO['usuario-1']! },
  },
  {
    id: 'empleado-2',
    usuarioId: 'usuario-2',
    cargo: 'Barista',
    sucursalId: 'sucursal-1',
    fechaContratacion: '2026-02-01T00:00:00.000Z',
    fechaCese: null,
    estado: 'activo',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
    usuario: { id: 'usuario-2', ...USUARIOS_POR_EMPLEADO['usuario-2']! },
  },
  {
    id: 'empleado-3',
    usuarioId: 'usuario-3',
    cargo: 'Cajero',
    sucursalId: 'sucursal-2',
    fechaContratacion: '2026-01-20T00:00:00.000Z',
    fechaCese: '2026-06-30T00:00:00.000Z',
    estado: 'inactivo',
    createdAt: '2026-01-20T10:00:00.000Z',
    updatedAt: '2026-06-30T10:00:00.000Z',
    usuario: { id: 'usuario-3', ...USUARIOS_POR_EMPLEADO['usuario-3']! },
  },
]

interface EstadoEmpleados {
  empleados: EmpleadoApi[]
}

function crearEstadoEmpleados(): EstadoEmpleados {
  return {
    empleados: EMPLEADOS_PRUEBA.map((empleado) => ({
      ...empleado,
      usuario: { ...empleado.usuario },
    })),
  }
}

let empleadosEstado: EstadoEmpleados = crearEstadoEmpleados()

// Actor vigente para el alcance de empleados. Si es `null` no se aplica alcance
// (útil para pruebas que no inician sesión); `iniciarSesionDePrueba` lo fija.
let actorEmpleados: UsuarioApi | null = null

export function establecerActorEmpleados(usuario: UsuarioApi | null): void {
  actorEmpleados = usuario
}

/** Restaura los empleados mockeados y limpia el actor de alcance. */
export function reiniciarEmpleadosPrueba(): void {
  empleadosEstado = crearEstadoEmpleados()
  actorEmpleados = null
}

function actorEmpleadosEsAdmin(): boolean {
  if (!actorEmpleados) return true
  return (actorEmpleados.rol ?? '').toLowerCase() === 'admin'
}

function empleadoVisible(empleado: EmpleadoApi): boolean {
  if (actorEmpleadosEsAdmin()) return true
  return (
    empleado.usuario.rol === 'Empleado' &&
    empleado.sucursalId === (actorEmpleados?.sucursalId ?? null)
  )
}

function empleadoFueraDeAlcance() {
  return errorApi(404, 'El empleado no existe o esta fuera de tu alcance', 'Not Found')
}

/** Mensaje de problema del vínculo, o `null`; replica el backend. */
function problemaVinculoEmpleado(
  usuario: UsuarioGestionApi,
  sucursalEmpleado?: string | null,
): string | null {
  if (usuario.rol === 'Admin') {
    return 'Un usuario con rol Admin no puede ser empleado'
  }
  if (usuario.rol !== 'Empleado' && usuario.rol !== 'Gerente') {
    return 'El usuario debe tener rol Empleado o Gerente'
  }
  if (!usuario.sucursalId) {
    return 'El usuario debe tener una sucursal asignada'
  }
  if (sucursalEmpleado && sucursalEmpleado !== usuario.sucursalId) {
    return 'La sucursal del empleado debe coincidir con la del usuario'
  }
  return null
}

// Usuarios: cuentas, su rol y las asignaciones individuales de permisos.
//
// El estado es mutable y se reinicia entre pruebas con `reiniciarUsuariosPrueba`.
// Las asignaciones se guardan por `usuarioId:permisoId` → tipo. Se siembran dos
// revocaciones realistas para poder probar conceder/revocar/restaurar sin
// montar estados extra en cada prueba: `inventario.recuento` revocado a un
// Gerente y `productos.ver` revocado a un Empleado.
export const USUARIOS_PRUEBA: UsuarioGestionApi[] = [
  {
    id: 'admin-1',
    nombre: 'Administrador',
    nombreUsuario: 'admin',
    rol: 'Admin',
    sucursalId: null,
    estado: 'activo',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'usuario-1',
    nombre: 'Ada Pruebas',
    nombreUsuario: 'ada',
    rol: 'Gerente',
    sucursalId: 'sucursal-1',
    estado: 'activo',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'usuario-2',
    nombre: 'Beto Turno',
    nombreUsuario: 'beto',
    rol: 'Empleado',
    sucursalId: 'sucursal-1',
    estado: 'activo',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'usuario-3',
    nombre: 'Ciro Ruiz',
    nombreUsuario: 'ciro',
    rol: 'Empleado',
    sucursalId: 'sucursal-2',
    estado: 'bloqueado',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'usuario-4',
    nombre: 'Dora Nueva',
    nombreUsuario: 'dora',
    rol: 'Empleado',
    sucursalId: 'sucursal-1',
    estado: 'activo',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
]

interface EstadoUsuarios {
  usuarios: UsuarioGestionApi[]
  /** Asignaciones individuales por `usuarioId:permisoId` → tipo. */
  individuales: Map<string, 'concedido' | 'revocado'>
}

function crearEstadoUsuarios(): EstadoUsuarios {
  const individuales = new Map<string, 'concedido' | 'revocado'>()
  // Un Gerente con `inventario.recuento` revocado: permite probar regrant/restauración.
  individuales.set(`usuario-1:${idDePermiso('inventario.recuento')}`, 'revocado')
  // Un Empleado con `productos.ver` revocado: el rol lo otorga, la concesión lo quita.
  individuales.set(`usuario-2:${idDePermiso('productos.ver')}`, 'revocado')
  return {
    usuarios: USUARIOS_PRUEBA.map((usuario) => ({ ...usuario })),
    individuales,
  }
}

let usuarios: EstadoUsuarios = crearEstadoUsuarios()

// Actor vigente para el alcance de usuarios. Si es `null` no se aplica alcance
// (útil para pruebas que no inician sesión); `iniciarSesionDePrueba` lo fija.
let actorUsuarios: UsuarioApi | null = null

export function establecerActorUsuarios(usuario: UsuarioApi | null): void {
  actorUsuarios = usuario
}

/** Restaura los usuarios y las asignaciones, y limpia el actor de alcance. */
export function reiniciarUsuariosPrueba(): void {
  usuarios = crearEstadoUsuarios()
  actorUsuarios = null
}

function actorUsuariosEsAdmin(): boolean {
  if (!actorUsuarios) return true
  return (actorUsuarios.rol ?? '').toLowerCase() === 'admin'
}

function usuarioVisible(usuario: UsuarioGestionApi): boolean {
  if (actorUsuariosEsAdmin()) return true
  return (
    usuario.rol === 'Empleado' &&
    usuario.sucursalId === (actorUsuarios?.sucursalId ?? null)
  )
}

function usuarioFueraDeAlcance() {
  return errorApi(404, 'El usuario no existe o esta fuera de tu alcance', 'Not Found')
}

function permisoDeCatalogo(codigo: string) {
  return CATALOGO_PERMISOS_PRUEBA.find((permiso) => permiso.codigo === codigo)
}

/** Permisos efectivos: los del rol más las asignaciones individuales. */
function permisosEfectivos(usuario: UsuarioGestionApi): PermisoEfectivoApi[] {
  const porDefecto = DEFAULT_PERMISOS_POR_ROL[usuario.rol] ?? []
  const resultado: PermisoEfectivoApi[] = []
  const vistos = new Set<string>()

  for (const codigo of porDefecto) {
    const permiso = permisoDeCatalogo(codigo)
    if (!permiso) continue
    vistos.add(permiso.codigo)
    const tipo = usuarios.individuales.get(`${usuario.id}:${permiso.id}`)
    resultado.push({
      permisoId: permiso.id,
      codigo,
      descripcion: permiso.descripcion,
      origen: tipo ?? 'rol',
      efectivo: tipo ? tipo === 'concedido' : true,
    })
  }

  // Concesiones de permisos que el rol no otorga (p. ej. los 4 de un Empleado).
  for (const [clave, tipo] of usuarios.individuales) {
    const [usuarioId, permisoId] = clave.split(':')
    if (usuarioId !== usuario.id) continue
    const permiso = CATALOGO_PERMISOS_PRUEBA.find((p) => p.id === permisoId)
    if (!permiso || vistos.has(permiso.codigo)) continue
    vistos.add(permiso.codigo)
    resultado.push({
      permisoId: permiso.id,
      codigo: permiso.codigo,
      descripcion: permiso.descripcion,
      origen: tipo,
      efectivo: tipo === 'concedido',
    })
  }

  return resultado.sort((a, b) => a.codigo.localeCompare(b.codigo))
}

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

// Reporte comparativo: respuesta dinámica que respeta el contrato real del
// backend (rango válido de hasta 92 días, `hasta >= desde`, sucursal 404 y 403
// sin `reportes.comparativos.ver`). Las métricas por sucursal salen del fixture
// anterior; una sucursal sin datos responde con ceros y `ticketPromedio: null`.
const MAXIMO_DIAS_REPORTE_MOCK = 92

function esFechaLocalMock(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const [anio, mes, dia] = valor.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio!, mes! - 1, dia!))
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes! - 1 &&
    fecha.getUTCDate() === dia
  )
}

function diasDelRangoMock(desde: string, hasta: string): number {
  const inicio = Date.parse(`${desde}T00:00:00.000Z`)
  const fin = Date.parse(`${hasta}T00:00:00.000Z`)
  return Math.round((fin - inicio) / 86_400_000) + 1
}

type MetricasReporte = Omit<ReporteSucursalApi, 'sucursalId' | 'sucursalNombre'>

function metricasReporteVacias(): MetricasReporte {
  return {
    ventas: {
      total: '0.00',
      cantidad: 0,
      ticketPromedio: null,
      porMetodoPago: {
        efectivo: { total: '0.00', cantidad: 0 },
        tarjeta: { total: '0.00', cantidad: 0 },
      },
      anuladas: { cantidad: 0 },
    },
    inventario: {
      movimientos: {
        total: 0,
        entradas: { cantidad: 0, cantidadNeta: '0.00' },
        ajustes: { cantidad: 0, cantidadNeta: '0.00' },
      },
    },
    asistencia: { faltas: 0, faltasJustificadas: 0 },
    estadoActual: { insumosConAlertaAbierta: 0, entradasAbiertas: 0 },
  }
}

function metricasReporteDeSucursal(sucursalId: string): MetricasReporte {
  const fila = REPORTE_COMPARATIVO_PRUEBA.sucursales.find(
    (s) => s.sucursalId === sucursalId,
  )
  if (!fila) {
    return metricasReporteVacias()
  }
  const { sucursalId: _id, sucursalNombre: _nombre, ...metricas } = fila
  return metricas
}

// Auditoría: log de eventos de solo lectura.
//
// Fixtures estáticas que cubren los casos que la interfaz debe resolver:
// cambios de rol/estado, un precio (dinero), un detalle vacío, una acción
// desconocida y un valor anidado (que nunca debe mostrarse como JSON crudo).
// El estado es mutable y se reinicia entre pruebas con `reiniciarAuditoriaPrueba`.
const ACTOR_ADMIN_AUDITORIA = {
  id: 'admin-1',
  nombre: 'Administrador',
  nombreUsuario: 'admin',
}

export const EVENTOS_AUDITORIA_PRUEBA: EventoAuditoriaApi[] = [
  {
    id: 'ev-rol',
    entidad: 'usuario',
    entidadId: 'usuario-2',
    accion: 'usuario_rol_cambiado',
    actor: { ...ACTOR_ADMIN_AUDITORIA },
    usuarioAfectadoId: 'usuario-2',
    sucursalAfectadaId: 'sucursal-1',
    detalle: { antes: { rol: 'Empleado' }, despues: { rol: 'Gerente' } },
    fecha: '2026-10-12T15:00:00.000Z',
  },
  {
    id: 'ev-estado',
    entidad: 'usuario',
    entidadId: 'usuario-3',
    accion: 'usuario_bloqueado',
    actor: { ...ACTOR_ADMIN_AUDITORIA },
    usuarioAfectadoId: 'usuario-3',
    sucursalAfectadaId: 'sucursal-2',
    detalle: { antes: { estado: 'activo' }, despues: { estado: 'bloqueado' } },
    fecha: '2026-10-12T14:00:00.000Z',
  },
  {
    id: 'ev-precio',
    entidad: 'oferta',
    entidadId: 'pv-cafe-mediano',
    accion: 'oferta_precio_fijado',
    actor: { ...ACTOR_ADMIN_AUDITORIA },
    usuarioAfectadoId: null,
    sucursalAfectadaId: 'sucursal-1',
    detalle: { antes: { precio: '10.00' }, despues: { precio: '12.50' } },
    fecha: '2026-10-12T13:00:00.000Z',
  },
  {
    id: 'ev-password',
    entidad: 'usuario',
    entidadId: 'usuario-2',
    accion: 'usuario_password_restablecida',
    actor: { ...ACTOR_ADMIN_AUDITORIA },
    usuarioAfectadoId: 'usuario-2',
    sucursalAfectadaId: 'sucursal-1',
    detalle: {},
    fecha: '2026-10-12T12:00:00.000Z',
  },
  {
    id: 'ev-desconocida',
    entidad: 'usuario',
    entidadId: 'usuario-2',
    accion: 'accion_futura' as AccionAuditoria,
    actor: { ...ACTOR_ADMIN_AUDITORIA },
    usuarioAfectadoId: 'usuario-2',
    sucursalAfectadaId: 'sucursal-2',
    detalle: {
      antes: { nombre: 'Beto Turno' },
      despues: {
        nombre: 'Beto T.',
        detalleInterno: { secreto: 'no-debe-mostrarse' },
      },
    },
    fecha: '2026-10-12T11:00:00.000Z',
  },
  {
    id: 'ev-producto',
    entidad: 'producto',
    entidadId: 'p-1',
    accion: 'producto_creado',
    actor: { ...ACTOR_ADMIN_AUDITORIA },
    usuarioAfectadoId: null,
    sucursalAfectadaId: null,
    detalle: {
      despues: { nombre: 'Latte', categoriaId: 'c-1', descripcion: null },
    },
    fecha: '2026-10-11T10:00:00.000Z',
  },
  {
    id: 'ev-turno',
    entidad: 'turno',
    entidadId: 'turno-1',
    accion: 'turno_creado',
    actor: { ...ACTOR_ADMIN_AUDITORIA },
    usuarioAfectadoId: null,
    sucursalAfectadaId: 'sucursal-1',
    detalle: {
      despues: {
        tipo: 'fijo',
        horaInicio: '07:30',
        horaFin: '16:00',
        diasSemana: '1,2,3,4,5',
      },
    },
    fecha: '2026-10-11T09:00:00.000Z',
  },
]

let auditoria: EventoAuditoriaApi[] = EVENTOS_AUDITORIA_PRUEBA.map(clonarEvento)

function clonarEvento(evento: EventoAuditoriaApi): EventoAuditoriaApi {
  return {
    ...evento,
    actor: { ...evento.actor },
    detalle: evento.detalle
      ? {
          antes: evento.detalle.antes ? { ...evento.detalle.antes } : undefined,
          despues: evento.detalle.despues
            ? { ...evento.detalle.despues }
            : undefined,
        }
      : null,
  }
}

/** Restaura el log de auditoría mockeado a su estado inicial. */
export function reiniciarAuditoriaPrueba(): void {
  auditoria = EVENTOS_AUDITORIA_PRUEBA.map(clonarEvento)
}

function paginarAuditoria(items: EventoAuditoriaApi[], page: number, limit: number) {
  const total = items.length
  const inicio = (page - 1) * limit
  return {
    eventos: items.slice(inicio, inicio + limit),
    total,
    page,
    limit,
  }
}

function diasEntreFechas(desde: string, hasta: string): number {
  const [ay, am, ad] = desde.split('-').map(Number)
  const [by, bm, bd] = hasta.split('-').map(Number)
  const inicio = Date.UTC(ay!, am! - 1, ad!)
  const fin = Date.UTC(by!, bm! - 1, bd!)
  return (fin - inicio) / (24 * 60 * 60 * 1000)
}

// ------------------------------------------------ turnos y asignaciones
//
// El estado es mutable y se reinicia entre pruebas con `reiniciarTurnosPrueba`.
// Los fixtures cubren un turno fijo con días y un variable sin horario (los dos
// de sucursal-1), un fijo de sucursal-2, y tres asignaciones: una vigente con
// días (pinta la rejilla), una variable sin días (se lista aparte) y una
// finalizada de la otra sucursal. El actor de alcance lo fija
// `iniciarSesionDePrueba` con `establecerActorTurnos`.
export const TURNOS_PRUEBA: TurnoApi[] = [
  {
    id: 'turno-1',
    sucursalId: 'sucursal-1',
    tipo: 'fijo',
    horaInicio: '07:30',
    horaFin: '16:00',
    diasSemana: '1,2,3,4,5',
    createdAt: '2026-01-02T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
  },
  {
    id: 'turno-2',
    sucursalId: 'sucursal-1',
    tipo: 'variable',
    horaInicio: null,
    horaFin: null,
    diasSemana: null,
    createdAt: '2026-01-02T10:05:00.000Z',
    updatedAt: '2026-01-02T10:05:00.000Z',
  },
  {
    id: 'turno-3',
    sucursalId: 'sucursal-2',
    tipo: 'fijo',
    horaInicio: '09:00',
    horaFin: '17:00',
    diasSemana: '6',
    createdAt: '2026-01-03T10:00:00.000Z',
    updatedAt: '2026-01-03T10:00:00.000Z',
  },
]

/** Día de negocio de hoy en America/Lima ("AAAA-MM-DD"). */
function diaNegocioPrueba(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

/** Lunes de la semana que contiene un día "AAAA-MM-DD". */
function lunesDePrueba(iso: string): string {
  const fecha = new Date(`${iso}T12:00:00.000Z`)
  const desdeLunes = (fecha.getUTCDay() + 6) % 7
  fecha.setUTCDate(fecha.getUTCDate() - desdeLunes)
  return fecha.toISOString().slice(0, 10)
}

/** Día "AAAA-MM-DD" desplazado `dias` (puede ser negativo). */
function sumarDiasPrueba(iso: string, dias: number): string {
  const fecha = new Date(`${iso}T12:00:00.000Z`)
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

function asignacionPrueba(
  parciales: Partial<AsignacionApi> & Pick<AsignacionApi, 'id'>,
): AsignacionApi {
  const turno = TURNOS_PRUEBA[0]!
  return {
    empleadoId: 'empleado-2',
    turnoId: turno.id,
    fechaInicio: sumarDiasPrueba(lunesDePrueba(diaNegocioPrueba()), -14),
    fechaFin: null,
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-05T10:00:00.000Z',
    empleado: {
      id: 'empleado-2',
      cargo: 'Barista',
      sucursalId: 'sucursal-1',
      usuario: { id: 'usuario-2', nombre: 'Beto Turno', nombreUsuario: 'beto' },
    },
    turno: { ...turno },
    ...parciales,
  }
}

function crearEstadoTurnos(): EstadoTurnos {
  const lunes = lunesDePrueba(diaNegocioPrueba())
  const turno1 = TURNOS_PRUEBA[0]!
  const turno2 = TURNOS_PRUEBA[1]!
  const turno3 = TURNOS_PRUEBA[2]!
  return {
    turnos: TURNOS_PRUEBA.map((turno) => ({ ...turno })),
    asignaciones: [
      asignacionPrueba({
        id: 'asignacion-1',
        empleadoId: 'empleado-2',
        turnoId: turno1.id,
        fechaInicio: sumarDiasPrueba(lunes, -14),
        fechaFin: null,
        turno: { ...turno1 },
      }),
      asignacionPrueba({
        id: 'asignacion-2',
        empleadoId: 'empleado-1',
        turnoId: turno2.id,
        fechaInicio: lunes,
        fechaFin: null,
        turno: { ...turno2 },
        empleado: {
          id: 'empleado-1',
          cargo: 'Gerente de tienda',
          sucursalId: 'sucursal-1',
          usuario: { id: 'usuario-1', nombre: 'Ada Pruebas', nombreUsuario: 'ada' },
        },
      }),
      asignacionPrueba({
        id: 'asignacion-3',
        empleadoId: 'empleado-3',
        turnoId: turno3.id,
        fechaInicio: sumarDiasPrueba(lunes, -70),
        fechaFin: sumarDiasPrueba(lunes, -14),
        turno: { ...turno3 },
        empleado: {
          id: 'empleado-3',
          cargo: 'Cajero',
          sucursalId: 'sucursal-2',
          usuario: { id: 'usuario-3', nombre: 'Ciro Ruiz', nombreUsuario: 'ciro' },
        },
      }),
    ],
  }
}

interface EstadoTurnos {
  turnos: TurnoApi[]
  asignaciones: AsignacionApi[]
}

let turnosEstado: EstadoTurnos = crearEstadoTurnos()

// Actor vigente para el alcance de turnos. Si es `null` no se aplica alcance
// (útil para pruebas que no inician sesión); `iniciarSesionDePrueba` lo fija.
let actorTurnos: UsuarioApi | null = null

export function establecerActorTurnos(usuario: UsuarioApi | null): void {
  actorTurnos = usuario
}

/** Restaura turnos y asignaciones, y limpia el actor de alcance. */
export function reiniciarTurnosPrueba(): void {
  turnosEstado = crearEstadoTurnos()
  actorTurnos = null
}

function actorTurnosEsAdmin(): boolean {
  if (!actorTurnos) return true
  return (actorTurnos.rol ?? '').toLowerCase() === 'admin'
}

function turnoVisible(turno: TurnoApi): boolean {
  if (actorTurnosEsAdmin()) return true
  return turno.sucursalId === (actorTurnos?.sucursalId ?? null)
}

function asignacionVisible(asignacion: AsignacionApi): boolean {
  if (actorTurnosEsAdmin()) return true
  return asignacion.empleado.sucursalId === (actorTurnos?.sucursalId ?? null)
}

/** Reglas de la franja horaria (mismas que `domain/rules/horario.ts`). */
function problemasHorarioMock(
  tipo: string,
  horaInicio: string | null,
  horaFin: string | null,
): string[] {
  const tieneInicio = horaInicio !== null && horaInicio !== ''
  const tieneFin = horaFin !== null && horaFin !== ''

  if (tipo === 'fijo' && (!tieneInicio || !tieneFin)) {
    return ['Un turno fijo debe tener hora de inicio y de fin']
  }
  if (!tieneInicio && !tieneFin) return []
  if (tieneInicio !== tieneFin) {
    return [
      'Un turno variable debe indicar hora de inicio y de fin, o ninguna de las dos',
    ]
  }
  if (horaInicio === null || horaFin === null) return []

  const problemas: string[] = []
  const patron = /^([01]\d|2[0-3]):[0-5]\d$/
  if (!patron.test(horaInicio)) {
    problemas.push('La hora de inicio debe tener el formato HH:mm')
  }
  if (!patron.test(horaFin)) {
    problemas.push('La hora de fin debe tener el formato HH:mm')
  }
  if (problemas.length > 0) return problemas
  if (horaFin <= horaInicio) {
    problemas.push('La hora de fin debe ser posterior a la hora de inicio')
  }
  return problemas
}

/** Reglas de `diasSemana` (mismas que `domain/rules/dias-semana.ts`). */
function problemasDiasMock(valor: string): string[] {
  const recortado = valor.trim()
  if (recortado === '') return ['diasSemana no puede estar vacio']

  const dias: number[] = []
  const problemas: string[] = []
  for (const parte of recortado.split(',')) {
    const limpio = parte.trim()
    if (!/^\d+$/.test(limpio)) {
      problemas.push(`"${parte}" no es un numero de dia valido`)
      continue
    }
    const dia = Number(limpio)
    if (dia < 1 || dia > 7) {
      problemas.push(`El dia ${dia} esta fuera del rango 1-7`)
      continue
    }
    dias.push(dia)
  }
  if (problemas.length > 0) return problemas
  if (new Set(dias).size !== dias.length) {
    problemas.push('Los dias de la semana no se pueden repetir')
  }
  for (let indice = 1; indice < dias.length; indice += 1) {
    if (dias[indice] <= dias[indice - 1]) {
      problemas.push('Los dias de la semana deben venir en orden ascendente')
      break
    }
  }
  return problemas
}

/**
 * Normaliza `diasSemana` como el backend: vacío en un fijo es 400, en un
 * variable es `null`; el texto válido se guarda en forma canónica "1,2,3".
 */
function normalizarDiasMock(
  valor: string | undefined,
  tipo: string,
):
  | { ok: true; valor: string | null }
  | { ok: false; mensaje: string; problemas: string[] } {
  const texto = valor?.trim() ?? ''
  if (texto === '') {
    if (tipo === 'fijo') {
      return {
        ok: false,
        mensaje: 'Los dias del turno no son validos',
        problemas: ['Un turno fijo debe indicar los dias de la semana'],
      }
    }
    return { ok: true, valor: null }
  }
  const problemas = problemasDiasMock(texto)
  if (problemas.length > 0) {
    return { ok: false, mensaje: 'Los dias del turno no son validos', problemas }
  }
  return { ok: true, valor: texto.split(',').map((p) => Number(p.trim())).join(',') }
}

function normalizarHoraMock(valor: string | undefined): string | null {
  const texto = valor?.trim() ?? ''
  return texto === '' ? null : texto
}

function errorConProblemas(mensaje: string, problemas: string[]) {
  return HttpResponse.json(
    { statusCode: 400, message: mensaje, problemas, error: 'Bad Request' },
    { status: 400 },
  )
}

function turnoFueraDeAlcance() {
  return errorApi(404, 'Turno no encontrado', 'Not Found')
}

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/

/** Dos rangos de fechas se solapan (extremos inclusivos, sin fin = abierto). */
function rangosSeCruzanMock(
  a: { fechaInicio: string; fechaFin: string | null },
  b: { fechaInicio: string; fechaFin: string | null },
): boolean {
  const finA = a.fechaFin ?? '9999-12-31'
  const finB = b.fechaFin ?? '9999-12-31'
  return a.fechaInicio <= finB && b.fechaInicio <= finA
}

/** Dos turnos chocan en el tiempo (regla simplificada de `solapamiento.ts`). */
function horariosSeCruzanMock(
  a: TurnoApi,
  b: TurnoApi,
): boolean {
  if (a.tipo === 'variable' || b.tipo === 'variable') return true
  if (
    a.horaInicio === null ||
    a.horaFin === null ||
    b.horaInicio === null ||
    b.horaFin === null
  ) {
    return true
  }
  const diasA = new Set(
    (a.diasSemana ?? '').split(',').filter(Boolean).map(Number),
  )
  const diasB = (b.diasSemana ?? '').split(',').filter(Boolean).map(Number)
  const seCruzanDias = diasB.some((dia) => diasA.has(dia))
  return (
    seCruzanDias && a.horaInicio < b.horaFin && b.horaInicio < a.horaFin
  )
}

// Sucursales: CRUD con alcance por rol.
//
// El estado es mutable y se reinicia entre pruebas con
// `reiniciarSucursalesPrueba`. El Admin ve todas (ordenadas por nombre); un
// Gerente o Empleado solo la suya y cualquier otra devuelve 404. La unicidad de
// nombre ignora mayúsculas y espacios internos, como `branches.rules.ts`. El
// actor de alcance lo fija `iniciarSesionDePrueba` con
// `establecerActorSucursales`.
let sucursalesEstado: SucursalApi[] = SUCURSALES_PRUEBA.map((s) => ({ ...s }))

let actorSucursales: UsuarioApi | null = null

export function establecerActorSucursales(usuario: UsuarioApi | null): void {
  actorSucursales = usuario
}

/** Restaura las sucursales mockeadas y limpia el actor de alcance. */
export function reiniciarSucursalesPrueba(): void {
  sucursalesEstado = SUCURSALES_PRUEBA.map((s) => ({ ...s }))
  actorSucursales = null
}

function sucursalesEsAdmin(): boolean {
  if (!actorSucursales) return true
  return (actorSucursales.rol ?? '').toLowerCase() === 'admin'
}

function sucursalVisible(sucursal: SucursalApi): boolean {
  if (sucursalesEsAdmin()) return true
  return sucursal.id === (actorSucursales?.sucursalId ?? null)
}

function sucursalFueraDeAlcance() {
  return errorApi(404, 'Sucursal no encontrada', 'Not Found')
}

// El reporte comparativo reutiliza el actor de sesión para decidir el 403: solo
// quien tiene `reportes.comparativos.ver` (Admin) puede consultarlo.
function reportesPermitido(): boolean {
  if (!actorSucursales) return true
  return actorSucursales.permisos.includes('reportes.comparativos.ver')
}

function normalizarNombreSucursalMock(nombre: string): string {
  return nombre.trim().replace(/\s+/gu, ' ').toLowerCase()
}

function nombreSucursalEnUso(nombre: string, exceptoId?: string): boolean {
  const normalizado = normalizarNombreSucursalMock(nombre)
  return sucursalesEstado.some(
    (sucursal) =>
      sucursal.id !== exceptoId &&
      normalizarNombreSucursalMock(sucursal.nombre) === normalizado,
  )
}

const CONTENIDO_EXPORTACION = 'contenido-exportado'
const CONTENIDO_LIBRO_COMPLETO = 'contenido-libro-completo'
const FECHA_EXPORTACION_PRUEBA = '2026-10-26'

function respuestaArchivo(
  contenido: string,
  nombreArchivo: string,
  tipoContenido: string,
) {
  return new HttpResponse(contenido, {
    status: 200,
    headers: {
      'Content-Type': tipoContenido,
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  })
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

  http.post(`${BASE_API}/exports`, async ({ request }) => {
    const cuerpo = (await request.json()) as {
      conjunto?: string
      formato?: string
    }
    const formato = cuerpo.formato === 'csv' ? 'csv' : 'xlsx'
    const conjunto = cuerpo.conjunto ?? 'conjunto'
    return respuestaArchivo(
      CONTENIDO_EXPORTACION,
      `${conjunto}-${FECHA_EXPORTACION_PRUEBA}.${formato}`,
      formato === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
  }),

  http.post(`${BASE_API}/exports/full`, () =>
    respuestaArchivo(
      CONTENIDO_LIBRO_COMPLETO,
      `libro-completo-${FECHA_EXPORTACION_PRUEBA}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ),
  ),

  http.get(`${BASE_API}/branches`, () => {
    const visibles = sucursalesEstado
      .filter(sucursalVisible)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((sucursal) => ({ ...sucursal }))
    return HttpResponse.json(visibles)
  }),

  http.post(`${BASE_API}/branches`, async ({ request }) => {
    const cuerpo = (await request.json()) as {
      nombre?: unknown
      direccion?: unknown
      telefono?: unknown
    }

    if (typeof cuerpo.nombre !== 'string' || cuerpo.nombre.trim().length < 2) {
      return errorApi(
        400,
        'El nombre debe tener al menos 2 caracteres',
        'Bad Request',
      )
    }
    if (typeof cuerpo.direccion !== 'string' || cuerpo.direccion.trim().length < 1) {
      return errorApi(
        400,
        'La direccion no puede estar vacia',
        'Bad Request',
      )
    }
    const nombre = cuerpo.nombre.trim()
    if (nombre.length > 100) {
      return errorApi(
        400,
        'El nombre no puede exceder 100 caracteres',
        'Bad Request',
      )
    }
    const direccion = cuerpo.direccion.trim()
    if (direccion.length > 200) {
      return errorApi(
        400,
        'La direccion no puede exceder 200 caracteres',
        'Bad Request',
      )
    }
    let telefono: string | null
    if (cuerpo.telefono === undefined || cuerpo.telefono === null) {
      telefono = null
    } else if (typeof cuerpo.telefono === 'string') {
      telefono = cuerpo.telefono.trim()
      if (telefono.length > 30) {
        return errorApi(
          400,
          'El telefono no puede exceder 30 caracteres',
          'Bad Request',
        )
      }
    } else {
      return errorApi(400, 'El telefono debe ser texto', 'Bad Request')
    }

    if (nombreSucursalEnUso(nombre)) {
      return errorApi(
        409,
        'Ya existe una sucursal con ese nombre',
        'Conflict',
      )
    }

    const sucursal: SucursalApi = {
      id: `sucursal-${sucursalesEstado.length + 1}`,
      nombre,
      direccion,
      telefono,
    }
    sucursalesEstado = [...sucursalesEstado, sucursal]
    return HttpResponse.json(sucursal, { status: 201 })
  }),

  http.get(`${BASE_API}/branches/:id`, ({ params }) => {
    const sucursal = sucursalesEstado.find((s) => s.id === params.id)
    if (!sucursal || !sucursalVisible(sucursal)) {
      return sucursalFueraDeAlcance()
    }
    return HttpResponse.json({ ...sucursal })
  }),

  http.patch(`${BASE_API}/branches/:id`, async ({ request, params }) => {
    const sucursal = sucursalesEstado.find((s) => s.id === params.id)
    if (!sucursal || !sucursalVisible(sucursal)) {
      return sucursalFueraDeAlcance()
    }
    const cuerpo = (await request.json()) as {
      nombre?: unknown
      direccion?: unknown
      telefono?: unknown
    }

    let nombre = sucursal.nombre
    if (cuerpo.nombre !== undefined) {
      if (typeof cuerpo.nombre !== 'string' || cuerpo.nombre.trim().length < 2) {
        return errorApi(
          400,
          'El nombre debe tener al menos 2 caracteres',
          'Bad Request',
        )
      }
      nombre = cuerpo.nombre.trim()
      if (nombre.length > 100) {
        return errorApi(
          400,
          'El nombre no puede exceder 100 caracteres',
          'Bad Request',
        )
      }
    }

    let direccion = sucursal.direccion
    if (cuerpo.direccion !== undefined) {
      if (
        typeof cuerpo.direccion !== 'string' ||
        cuerpo.direccion.trim().length < 1
      ) {
        return errorApi(
          400,
          'La direccion no puede estar vacia',
          'Bad Request',
        )
      }
      direccion = cuerpo.direccion.trim()
      if (direccion.length > 200) {
        return errorApi(
          400,
          'La direccion no puede exceder 200 caracteres',
          'Bad Request',
        )
      }
    }

    let telefono = sucursal.telefono
    if (cuerpo.telefono !== undefined) {
      if (cuerpo.telefono === null) {
        telefono = null
      } else if (typeof cuerpo.telefono === 'string') {
        telefono = cuerpo.telefono.trim()
        if (telefono.length > 30) {
          return errorApi(
            400,
            'El telefono no puede exceder 30 caracteres',
            'Bad Request',
          )
        }
      } else {
        return errorApi(400, 'El telefono debe ser texto', 'Bad Request')
      }
    }

    if (nombre !== sucursal.nombre && nombreSucursalEnUso(nombre, sucursal.id)) {
      return errorApi(
        409,
        'Ya existe una sucursal con ese nombre',
        'Conflict',
      )
    }

    const actualizado: SucursalApi = { ...sucursal, nombre, direccion, telefono }
    sucursalesEstado = sucursalesEstado.map((s) =>
      s.id === sucursal.id ? actualizado : s,
    )
    return HttpResponse.json({ ...actualizado })
  }),

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

  // ------------------------------------------------------------- insumos

  http.get(`${BASE_API}/insumos`, ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.trim().toLowerCase()
    const presentacion = url.searchParams.get('presentacion')
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '20')
    let items = inventario.insumos
    if (presentacion) {
      items = items.filter((insumo) => insumo.presentacion === presentacion)
    }
    if (q) {
      items = items.filter((insumo) =>
        insumo.nombre.toLowerCase().includes(q),
      )
    }
    return HttpResponse.json(paginar(items, page, limit))
  }),

  http.post(`${BASE_API}/insumos`, async ({ request }) => {
    const cuerpo = (await request.json()) as {
      nombre?: string
      presentacion?: string
    }
    const nombre = (cuerpo.nombre ?? '').trim()
    if (nombre.length < 2 || nombre.length > 100) {
      return errorApi(
        400,
        'El nombre debe tener entre 2 y 100 caracteres',
        'Bad Request',
      )
    }
    if (
      !PRESENTACIONES_INSUMO_PRUEBA.includes(
        cuerpo.presentacion as PresentacionInsumo,
      )
    ) {
      return errorApi(400, 'La presentacion no es valida', 'Bad Request')
    }
    if (
      inventario.insumos.some(
        (insumo) => insumo.nombre.toLowerCase() === nombre.toLowerCase(),
      )
    ) {
      return errorApi(
        409,
        'Ya existe un insumo con ese nombre',
        'Conflict',
      )
    }
    const ahora = new Date().toISOString()
    const insumo: InsumoApi = {
      id: `i-${inventario.insumos.length + 10}`,
      nombre,
      presentacion: cuerpo.presentacion as PresentacionInsumo,
      createdAt: ahora,
      updatedAt: ahora,
    }
    inventario.insumos = [...inventario.insumos, insumo]
    return HttpResponse.json(insumo, { status: 201 })
  }),

  http.patch(`${BASE_API}/insumos/:id`, async ({ request, params }) => {
    const insumo = inventario.insumos.find((item) => item.id === params.id)
    if (!insumo) {
      return errorApi(404, 'El insumo no existe', 'Not Found')
    }
    const cuerpo = (await request.json()) as {
      nombre?: string
      presentacion?: string
    }
    if (cuerpo.nombre !== undefined) {
      const nombre = cuerpo.nombre.trim()
      if (nombre.length < 2 || nombre.length > 100) {
        return errorApi(
          400,
          'El nombre debe tener entre 2 y 100 caracteres',
          'Bad Request',
        )
      }
      if (
        inventario.insumos.some(
          (item) =>
            item.id !== insumo.id &&
            item.nombre.toLowerCase() === nombre.toLowerCase(),
        )
      ) {
        return errorApi(
          409,
          'Ya existe un insumo con ese nombre',
          'Conflict',
        )
      }
      insumo.nombre = nombre
    }
    if (cuerpo.presentacion !== undefined) {
      if (
        !PRESENTACIONES_INSUMO_PRUEBA.includes(
          cuerpo.presentacion as PresentacionInsumo,
        )
      ) {
        return errorApi(400, 'La presentacion no es valida', 'Bad Request')
      }
      insumo.presentacion = cuerpo.presentacion as PresentacionInsumo
    }
    insumo.updatedAt = new Date().toISOString()
    for (const fila of inventario.stock) {
      if (fila.insumoId === insumo.id) fila.insumo = { ...insumo }
    }
    sincronizarAlertas(inventario)
    return HttpResponse.json(insumo)
  }),

  http.delete(`${BASE_API}/insumos/:id`, ({ params }) => {
    const insumo = inventario.insumos.find((item) => item.id === params.id)
    if (!insumo) {
      return errorApi(404, 'El insumo no existe', 'Not Found')
    }
    if (inventario.stock.some((fila) => fila.insumoId === insumo.id)) {
      return errorApi(
        409,
        'No se puede eliminar un insumo con stock',
        'Conflict',
      )
    }
    inventario.insumos = inventario.insumos.filter(
      (item) => item.id !== insumo.id,
    )
    return new HttpResponse(null, { status: 204 })
  }),

  // ----------------------------------------------------------- inventario

  http.get(
    `${BASE_API}/inventario/sucursales/:sucursalId/stock`,
    ({ request, params }) => {
      const sucursalId = String(params.sucursalId)
      if (!sucursalValida(sucursalId)) {
        return errorApi(404, 'La sucursal no existe', 'Not Found')
      }
      const url = new URL(request.url)
      const q = url.searchParams.get('q')?.trim().toLowerCase()
      const estado = url.searchParams.get('estado')
      const soloBajoMinimo = url.searchParams.get('soloBajoMinimo')
      const page = Number(url.searchParams.get('page') ?? '1')
      const limit = Number(url.searchParams.get('limit') ?? '20')

      let items = inventario.stock.filter(
        (fila) => fila.sucursalId === sucursalId,
      )
      if (estado) items = items.filter((fila) => fila.estado === estado)
      if (q) {
        items = items.filter((fila) =>
          fila.insumo.nombre.toLowerCase().includes(q),
        )
      }
      if (soloBajoMinimo === 'true') {
        items = items.filter(
          (fila) =>
            fila.estado === 'activo' &&
            Number(fila.stockActual) <= Number(fila.stockMinimo),
        )
      }
      return HttpResponse.json(paginar(items, page, limit))
    },
  ),

  http.put(
    `${BASE_API}/inventario/sucursales/:sucursalId/insumos/:insumoId`,
    async ({ request, params }) => {
      const sucursalId = String(params.sucursalId)
      if (!sucursalValida(sucursalId)) {
        return errorApi(404, 'La sucursal no existe', 'Not Found')
      }
      const insumoId = String(params.insumoId)
      const insumo = inventario.insumos.find((item) => item.id === insumoId)
      if (!insumo) {
        return errorApi(404, 'El insumo no existe', 'Not Found')
      }
      const cuerpo = (await request.json()) as {
        stockMinimo?: unknown
        estado?: unknown
      }
      const tieneMinimo = cuerpo.stockMinimo !== undefined
      const tieneEstado = cuerpo.estado !== undefined
      if (!tieneMinimo && !tieneEstado) {
        return errorApi(
          400,
          'Debe indicar stockMinimo o estado',
          'Bad Request',
        )
      }
      let stockMinimo = '0.00'
      if (tieneMinimo) {
        const problema = mensajeCantidadInvalida(
          cuerpo.stockMinimo,
          'cantidad',
        )
        if (problema) return errorApi(400, problema, 'Bad Request')
        stockMinimo = (cuerpo.stockMinimo as number).toFixed(2)
      }
      if (
        tieneEstado &&
        cuerpo.estado !== 'activo' &&
        cuerpo.estado !== 'descontinuado'
      ) {
        return errorApi(400, 'El estado no es valido', 'Bad Request')
      }
      let fila = inventario.stock.find(
        (item) => item.sucursalId === sucursalId && item.insumoId === insumoId,
      )
      if (!fila) {
        fila = crearFilaStock(insumo, sucursalId, {
          id: `is-${insumoId}-${sucursalId}`,
        })
        inventario.stock = [...inventario.stock, fila]
      }
      if (tieneMinimo) fila.stockMinimo = stockMinimo
      if (tieneEstado) fila.estado = cuerpo.estado as EstadoStockInsumo
      fila.updatedAt = new Date().toISOString()
      sincronizarAlertas(inventario)
      return HttpResponse.json(fila)
    },
  ),

  http.post(
    `${BASE_API}/inventario/sucursales/:sucursalId/insumos/:insumoId/entradas`,
    async ({ request, params }) => {
      const sucursalId = String(params.sucursalId)
      if (!sucursalValida(sucursalId)) {
        return errorApi(404, 'La sucursal no existe', 'Not Found')
      }
      const fila = inventario.stock.find(
        (item) =>
          item.sucursalId === sucursalId &&
          item.insumoId === String(params.insumoId),
      )
      if (!fila) {
        return errorApi(
          404,
          'El insumo no esta dado de alta en la sucursal',
          'Not Found',
        )
      }
      if (fila.estado === 'descontinuado') {
        return errorApi(
          409,
          'El insumo esta descontinuado en la sucursal',
          'Conflict',
        )
      }
      const cuerpo = (await request.json()) as {
        cantidad?: unknown
        motivo?: string
      }
      const cantidad = cuerpo.cantidad
      if (typeof cantidad !== 'number' || !Number.isFinite(cantidad)) {
        return errorApi(400, 'La cantidad debe ser un numero', 'Bad Request')
      }
      if (cantidad <= 0) {
        return errorApi(
          400,
          'La cantidad debe ser mayor a 0',
          'Bad Request',
        )
      }
      const decimales = (String(cantidad).split('.')[1] ?? '').length
      if (decimales > 2) {
        return errorApi(
          400,
          'La cantidad no puede tener mas de 2 decimales',
          'Bad Request',
        )
      }
      const motivo = (cuerpo.motivo ?? '').trim()
      if (motivo.length > 200) {
        return errorApi(
          400,
          'El motivo no puede superar 200 caracteres',
          'Bad Request',
        )
      }
      const ahora = new Date().toISOString()
      fila.stockActual = (Number(fila.stockActual) + cantidad).toFixed(2)
      fila.updatedAt = ahora
      sincronizarAlertas(inventario)
      const movimiento: MovimientoInventarioApi = {
        id: `mov-${fila.id}-${inventario.stock.length}`,
        insumoSucursalId: fila.id,
        tipo: 'entrada',
        cantidad: cantidad.toFixed(2),
        usuarioId: 'usuario-1',
        motivo: motivo === '' ? 'Entrada de inventario' : motivo,
        createdAt: ahora,
      }
      return HttpResponse.json({ stock: fila, movimiento }, { status: 201 })
    },
  ),

  http.get(
    `${BASE_API}/inventario/sucursales/:sucursalId/movimientos`,
    ({ request, params }) => {
      const sucursalId = String(params.sucursalId)
      if (!sucursalValida(sucursalId)) {
        return errorApi(404, 'La sucursal no existe', 'Not Found')
      }
      const url = new URL(request.url)
      const insumoId = url.searchParams.get('insumoId')
      const tipo = url.searchParams.get('tipo')
      const desde = url.searchParams.get('desde')
      const hasta = url.searchParams.get('hasta')
      const page = Number(url.searchParams.get('page') ?? '1')
      const limit = Number(url.searchParams.get('limit') ?? '20')

      const idsSucursal = new Set(
        inventario.stock
          .filter((fila) => fila.sucursalId === sucursalId)
          .map((fila) => fila.id),
      )
      let items = inventario.movimientos.filter((mov) =>
        idsSucursal.has(mov.insumoSucursalId),
      )
      if (insumoId) {
        const idsInsumo = new Set(
          inventario.stock
            .filter(
              (fila) =>
                fila.sucursalId === sucursalId && fila.insumoId === insumoId,
            )
            .map((fila) => fila.id),
        )
        items = items.filter((mov) => idsInsumo.has(mov.insumoSucursalId))
      }
      if (tipo) items = items.filter((mov) => mov.tipo === tipo)
      if (desde) {
        items = items.filter((mov) => mov.createdAt.slice(0, 10) >= desde)
      }
      if (hasta) {
        items = items.filter((mov) => mov.createdAt.slice(0, 10) <= hasta)
      }
      return HttpResponse.json(paginar(items, page, limit))
    },
  ),

  http.get(`${BASE_API}/inventario/recuentos`, ({ request }) => {
    const url = new URL(request.url)
    const sucursalId = url.searchParams.get('sucursalId')
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '20')
    let items = inventario.recuentos.map((recuento) => ({
      id: recuento.id,
      sucursalId: recuento.sucursalId,
      usuarioId: recuento.usuarioId,
      createdAt: recuento.createdAt,
    }))
    if (sucursalId) items = items.filter((r) => r.sucursalId === sucursalId)
    return HttpResponse.json(paginar(items, page, limit))
  }),

  http.get(`${BASE_API}/inventario/recuentos/:id`, ({ params }) => {
    const recuento = inventario.recuentos.find((r) => r.id === params.id)
    if (!recuento) {
      return errorApi(404, 'El recuento no existe', 'Not Found')
    }
    return HttpResponse.json(recuento)
  }),

  http.post(
    `${BASE_API}/inventario/sucursales/:sucursalId/recuentos`,
    async ({ request, params }) => {
      const sucursalId = String(params.sucursalId)
      if (!sucursalValida(sucursalId)) {
        return errorApi(404, 'La sucursal no existe', 'Not Found')
      }
      const cuerpo = (await request.json()) as { items?: unknown }
      const items = cuerpo.items
      if (!Array.isArray(items) || items.length < 1) {
        return errorApi(
          400,
          'El recuento debe incluir al menos un insumo',
          'Bad Request',
        )
      }
      if (items.length > 500) {
        return errorApi(
          400,
          'El recuento no puede incluir mas de 500 insumos',
          'Bad Request',
        )
      }
      const limpios: { insumoId: string; stockFisico: number }[] = []
      for (const bruto of items as {
        insumoId?: unknown
        stockFisico?: unknown
      }[]) {
        const insumoId = bruto.insumoId
        if (
          typeof insumoId !== 'string' ||
          !inventario.insumos.some((insumo) => insumo.id === insumoId)
        ) {
          return errorApi(404, 'El insumo no existe', 'Not Found')
        }
        const fila = inventario.stock.find(
          (item) =>
            item.sucursalId === sucursalId && item.insumoId === insumoId,
        )
        if (!fila) {
          return errorApi(
            404,
            'El insumo no esta dado de alta en la sucursal',
            'Not Found',
          )
        }
        const problema = mensajeCantidadInvalida(bruto.stockFisico, 'cantidad')
        if (problema) return errorApi(400, problema, 'Bad Request')
        limpios.push({ insumoId, stockFisico: bruto.stockFisico as number })
      }
      const recuento = crearRecuentoDetalle(inventario, sucursalId, limpios)
      return HttpResponse.json(
        {
          id: recuento.id,
          sucursalId: recuento.sucursalId,
          usuarioId: recuento.usuarioId,
          createdAt: recuento.createdAt,
        },
        { status: 201 },
      )
    },
  ),

  http.get(`${BASE_API}/inventario/alertas`, ({ request }) => {
    const url = new URL(request.url)
    const estado = url.searchParams.get('estado')
    const sucursalId = url.searchParams.get('sucursalId')
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '20')
    let alertas = inventario.alertas
    if (estado) alertas = alertas.filter((alerta) => alerta.estado === estado)
    if (sucursalId) {
      alertas = alertas.filter(
        (alerta) => alerta.insumoSucursal.sucursalId === sucursalId,
      )
    }
    return HttpResponse.json(paginar(alertas, page, limit))
  }),

  http.get(`${BASE_API}/attendance/records`, ({ request }) => {
    const url = new URL(request.url)
    const abierta = url.searchParams.get('abierta')
    const empleadoId = url.searchParams.get('empleadoId')
    const desde = url.searchParams.get('desde')
    const hasta = url.searchParams.get('hasta')
    let registros = asistencia.registros.filter(registroVisible)
    if (abierta !== null) {
      registros = registros.filter((r) => String(r.abierta) === abierta)
    }
    if (empleadoId) {
      registros = registros.filter((r) => r.empleadoId === empleadoId)
    }
    if (desde) {
      registros = registros.filter((r) => diaLimaDeIso(r.fechaHora) >= desde)
    }
    if (hasta) {
      registros = registros.filter((r) => diaLimaDeIso(r.fechaHora) <= hasta)
    }
    return HttpResponse.json({
      items: registros,
      total: registros.length,
      page: 1,
      limit: 20,
    })
  }),

  http.get(`${BASE_API}/attendance/records/:id`, ({ params }) => {
    const registro = asistencia.registros.find((r) => r.id === params.id)
    if (!registro || !registroVisible(registro)) {
      return errorApi(
        404,
        'El registro no existe o esta fuera de tu alcance',
        'Not Found',
      )
    }
    return HttpResponse.json({
      ...registro,
      correcciones: asistencia.correcciones.get(registro.id) ?? [],
    })
  }),

  http.get(`${BASE_API}/attendance/terminal/employees`, () => {
    if (sinSucursalParaMarcar()) {
      return errorApi(
        403,
        'Tu cuenta no tiene una sucursal asignada para marcar asistencia',
        'Forbidden',
      )
    }
    const sucursalId = sucursalAsistencia()
    const empleados = sucursalId
      ? EMPLEADOS_TERMINAL_PRUEBA.filter(
          (empleado) => empleado.sucursalId === sucursalId,
        )
      : EMPLEADOS_TERMINAL_PRUEBA
    return HttpResponse.json(
      empleados.map(({ id, nombre }) => ({ id, nombre })),
    )
  }),

  http.post(`${BASE_API}/attendance/mark`, async ({ request }) => {
    if (sinSucursalParaMarcar()) {
      return errorApi(
        403,
        'Tu cuenta no tiene una sucursal asignada para marcar asistencia',
        'Forbidden',
      )
    }
    const cuerpo = (await request.json()) as {
      empleadoId?: string
      tipo?: string
      pin?: string
    }
    if (cuerpo.tipo !== 'entrada' && cuerpo.tipo !== 'salida') {
      return errorApi(
        400,
        'El tipo debe ser uno de: entrada, salida',
        'Bad Request',
      )
    }
    const empleado = EMPLEADOS_TERMINAL_PRUEBA.find(
      (candidato) =>
        candidato.id === cuerpo.empleadoId &&
        (asistenciaEsAdmin() ||
          candidato.sucursalId === sucursalAsistencia()),
    )
    if (!empleado) {
      return errorApi(404, 'Empleado no encontrado', 'Not Found')
    }
    const ahoraMs = Date.now()
    if (pinBloqueado(empleado.id, ahoraMs)) {
      return errorApi(
        429,
        'Demasiados intentos de PIN. Espera un minuto e intentalo de nuevo',
        'Too Many Requests',
      )
    }
    if (cuerpo.pin !== PIN_TERMINAL_VALIDO) {
      registrarFalloPin(empleado.id, ahoraMs)
      return errorApi(403, 'PIN incorrecto', 'Forbidden')
    }
    asistencia.fallosPin.delete(empleado.id)

    const diaHoy = diaNegocioPrueba()
    const entradaAbiertaHoy = asistencia.registros.find(
      (r) =>
        r.empleadoId === empleado.id &&
        r.tipo === 'entrada' &&
        r.abierta &&
        diaLimaDeIso(r.fechaHora) === diaHoy,
    )
    if (cuerpo.tipo === 'entrada' && entradaAbiertaHoy) {
      return errorApi(409, 'Ya hay una entrada abierta de hoy', 'Conflict')
    }
    if (cuerpo.tipo === 'salida' && !entradaAbiertaHoy) {
      return errorApi(
        409,
        'No hay una entrada abierta de hoy para cerrar',
        'Conflict',
      )
    }
    if (cuerpo.tipo === 'salida' && entradaAbiertaHoy) {
      entradaAbiertaHoy.abierta = false
    }

    asistencia.secuencia += 1
    const fechaHora = new Date().toISOString()
    const nuevo: RegistroAsistenciaApi = {
      id: `registro-mark-${asistencia.secuencia}`,
      empleadoId: empleado.id,
      sucursalId: empleado.sucursalId,
      tipo: cuerpo.tipo,
      fechaHora,
      metodo: 'pin',
      abierta: cuerpo.tipo === 'entrada',
      corregido: false,
      empleado: { id: empleado.id, nombre: empleado.nombre },
    }
    asistencia.registros.push(nuevo)
    return HttpResponse.json(
      {
        id: nuevo.id,
        empleadoId: nuevo.empleadoId,
        sucursalId: nuevo.sucursalId,
        tipo: nuevo.tipo,
        fechaHora: nuevo.fechaHora,
        metodo: nuevo.metodo,
        esCorreccion: false,
        registroOriginalId: null,
        motivo: null,
        usuarioCorrectorId: null,
        createdAt: nuevo.fechaHora,
      } satisfies RegistroMarcajeApi,
      { status: 201 },
    )
  }),

  http.post(
    `${BASE_API}/attendance/records/:id/correct`,
    async ({ request, params }) => {
      const original = asistencia.registros.find((r) => r.id === params.id)
      if (!original || !registroVisible(original)) {
        return errorApi(
          404,
          'El registro no existe o esta fuera de tu alcance',
          'Not Found',
        )
      }
      const cuerpo = (await request.json()) as {
        motivo?: unknown
        fechaHora?: unknown
        tipo?: unknown
      }
      const motivo = typeof cuerpo.motivo === 'string' ? cuerpo.motivo.trim() : ''
      if (motivo === '' || motivo.length > 200) {
        return errorApi(
          400,
          'El motivo es obligatorio y no puede superar 200 caracteres',
          'Bad Request',
        )
      }
      const tipo = cuerpo.tipo ?? original.tipo
      if (tipo !== 'entrada' && tipo !== 'salida') {
        return errorApi(
          400,
          'El tipo debe ser uno de: entrada, salida',
          'Bad Request',
        )
      }
      if (
        typeof cuerpo.fechaHora !== 'string' ||
        Number.isNaN(new Date(cuerpo.fechaHora).getTime())
      ) {
        return errorApi(
          400,
          'La fecha y hora debe tener formato ISO 8601',
          'Bad Request',
        )
      }
      const fechaHora = new Date(cuerpo.fechaHora).toISOString()
      // Igual que el backend: nadie corrige sus propios registros. El cliente no
      // puede saberlo de antemano (el registro no expone el usuario dueño), así
      // que la interfaz siempre ofrece la acción y muestra este 403 con su texto.
      if (actorAsistencia && original.empleadoId === actorAsistencia.id) {
        return errorApi(
          403,
          'No puedes corregir tus propios registros',
          'Forbidden',
        )
      }
      asistencia.secuencia += 1
      const correccion: CorreccionAsistenciaApi = {
        id: `correccion-${asistencia.secuencia}`,
        tipo,
        fechaHora,
        metodo: 'manual',
        motivo,
        usuarioCorrectorId: actorAsistencia?.id ?? 'usuario-1',
        createdAt: new Date().toISOString(),
      }
      const historial = asistencia.correcciones.get(original.id) ?? []
      historial.push(correccion)
      asistencia.correcciones.set(original.id, historial)
      original.corregido = true
      return HttpResponse.json(
        {
          id: `registro-correccion-${asistencia.secuencia}`,
          empleadoId: original.empleadoId,
          sucursalId: original.sucursalId,
          tipo,
          fechaHora,
          metodo: 'manual',
          esCorreccion: true,
          registroOriginalId: original.id,
          motivo,
          usuarioCorrectorId: correccion.usuarioCorrectorId,
          createdAt: correccion.createdAt,
        } satisfies RegistroMarcajeApi,
        { status: 201 },
      )
    },
  ),

  http.get(`${BASE_API}/attendance/absences`, ({ request }) => {
    const url = new URL(request.url)
    const desde = url.searchParams.get('desde')
    const hasta = url.searchParams.get('hasta')
    if (!desde || !hasta) {
      return errorApi(400, 'Debes indicar el rango de fechas', 'Bad Request')
    }
    if (desde > hasta) {
      return errorApi(400, 'El rango de fechas es invalido', 'Bad Request')
    }
    const items = FALTAS_PRUEBA.filter((falta) => {
      if (!faltaVisible(falta)) return false
      if (falta.fecha < desde || falta.fecha > hasta) return false
      return !faltaJustificada(falta.empleadoId, falta.fecha)
    })
    return HttpResponse.json({ items, total: items.length })
  }),

  http.post(`${BASE_API}/attendance/absences/justify`, async ({ request }) => {
    const cuerpo = (await request.json()) as {
      empleadoId?: unknown
      fecha?: unknown
      motivo?: unknown
    }
    if (typeof cuerpo.empleadoId !== 'string' || typeof cuerpo.fecha !== 'string') {
      return errorApi(
        400,
        'El empleado y la fecha son obligatorios',
        'Bad Request',
      )
    }
    const motivo = typeof cuerpo.motivo === 'string' ? cuerpo.motivo.trim() : ''
    if (motivo === '' || motivo.length > 200) {
      return errorApi(
        400,
        'El motivo es obligatorio y no puede superar 200 caracteres',
        'Bad Request',
      )
    }
    asistencia.secuencia += 1
    const justificacion: JustificacionFaltaApi = {
      id: `justificacion-${asistencia.secuencia}`,
      empleadoId: cuerpo.empleadoId,
      fecha: new Date(`${cuerpo.fecha}T00:00:00.000Z`).toISOString(),
      motivo,
      usuarioJustificadorId: actorAsistencia?.id ?? 'usuario-1',
      createdAt: new Date().toISOString(),
    }
    asistencia.justificaciones.push(justificacion)
    return HttpResponse.json(justificacion, { status: 201 })
  }),

  http.get(`${BASE_API}/equipment`, ({ request }) => {
    const url = new URL(request.url)
    const estado = url.searchParams.get('estado')
    const busqueda = url.searchParams.get('busqueda')?.trim().toLowerCase()
    const sucursalId = url.searchParams.get('sucursalId')
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '10')

    let items = equipos.equipos
    if (!actorEsAdmin()) {
      items = items.filter(
        (equipo) => equipo.sucursalId === (actorEquipos?.sucursalId ?? null),
      )
    } else if (sucursalId) {
      items = items.filter((equipo) => equipo.sucursalId === sucursalId)
    }
    if (estado) items = items.filter((equipo) => equipo.estado === estado)
    if (busqueda) {
      items = items.filter(
        (equipo) =>
          equipo.nombre.toLowerCase().includes(busqueda) ||
          equipo.tipo.toLowerCase().includes(busqueda),
      )
    }
    return HttpResponse.json(paginar(items, page, limit))
  }),

  http.get(`${BASE_API}/equipment/:id/history`, ({ request, params }) => {
    const equipo = equipos.equipos.find((item) => item.id === params.id)
    if (!equipo || !equipoVisible(equipo)) {
      return equipoFueraDeAlcance()
    }
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '10')
    const items = equipos.historial
      .filter((entrada) => entrada.equipoId === equipo.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return HttpResponse.json(paginar(items, page, limit))
  }),

  http.get(`${BASE_API}/equipment/:id`, ({ params }) => {
    const equipo = equipos.equipos.find((item) => item.id === params.id)
    if (!equipo || !equipoVisible(equipo)) {
      return equipoFueraDeAlcance()
    }
    return HttpResponse.json(equipo)
  }),

  http.post(`${BASE_API}/equipment`, async ({ request }) => {
    const cuerpo = (await request.json()) as {
      sucursalId?: string
      nombre?: string
      tipo?: string
      observaciones?: string | null
    }
    const nombre = (cuerpo.nombre ?? '').trim()
    const tipo = (cuerpo.tipo ?? '').trim()
    if (nombre.length < 2 || nombre.length > 100) {
      return errorApi(
        400,
        'El nombre debe tener entre 2 y 100 caracteres',
        'Bad Request',
      )
    }
    if (tipo.length < 2 || tipo.length > 50) {
      return errorApi(
        400,
        'El tipo debe tener entre 2 y 50 caracteres',
        'Bad Request',
      )
    }
    const observaciones = (cuerpo.observaciones ?? '').trim()
    if (observaciones.length > 500) {
      return errorApi(
        400,
        'Las observaciones no pueden superar 500 caracteres',
        'Bad Request',
      )
    }

    let sucursalId: string
    if (actorEsAdmin()) {
      sucursalId = cuerpo.sucursalId ?? ''
      if (!sucursalValida(sucursalId)) {
        return errorApi(404, 'La sucursal no existe', 'Not Found')
      }
    } else {
      const propia = actorEquipos?.sucursalId ?? null
      if (!propia) {
        return errorApi(403, 'Acceso denegado', 'Forbidden')
      }
      sucursalId = propia
    }

    const ahora = new Date().toISOString()
    const equipo: EquipoApi = {
      id: `equipo-${equipos.equipos.length + 1}`,
      sucursalId,
      nombre,
      tipo,
      estado: 'funcionando',
      observaciones: observaciones === '' ? null : observaciones,
      createdAt: ahora,
      updatedAt: ahora,
    }
    equipos.equipos = [...equipos.equipos, equipo]
    return HttpResponse.json(equipo, { status: 201 })
  }),

  http.patch(`${BASE_API}/equipment/:id`, async ({ request, params }) => {
    const equipo = equipos.equipos.find((item) => item.id === params.id)
    if (!equipo || !equipoVisible(equipo)) {
      return equipoFueraDeAlcance()
    }
    const cuerpo = (await request.json()) as {
      nombre?: string
      tipo?: string
      estado?: string
      observaciones?: string | null
    }

    if (cuerpo.estado !== undefined) {
      if (!ESTADOS_EQUIPO_PRUEBA.includes(cuerpo.estado as EstadoEquipo)) {
        return errorApi(400, 'El estado no es valido', 'Bad Request')
      }
      if (equipo.estado === 'retirado' && cuerpo.estado !== 'retirado') {
        return errorApi(409, 'El equipo ya esta retirado', 'Conflict')
      }
    }

    const estadoAnterior = equipo.estado
    const obsAnterior = equipo.observaciones

    if (cuerpo.nombre !== undefined) {
      const nombre = cuerpo.nombre.trim()
      if (nombre.length < 2 || nombre.length > 100) {
        return errorApi(
          400,
          'El nombre debe tener entre 2 y 100 caracteres',
          'Bad Request',
        )
      }
      equipo.nombre = nombre
    }
    if (cuerpo.tipo !== undefined) {
      const tipo = cuerpo.tipo.trim()
      if (tipo.length < 2 || tipo.length > 50) {
        return errorApi(
          400,
          'El tipo debe tener entre 2 y 50 caracteres',
          'Bad Request',
        )
      }
      equipo.tipo = tipo
    }
    if (cuerpo.estado !== undefined) {
      equipo.estado = cuerpo.estado as EstadoEquipo
    }
    if (cuerpo.observaciones !== undefined) {
      const observaciones = (cuerpo.observaciones ?? '').trim()
      if (observaciones.length > 500) {
        return errorApi(
          400,
          'Las observaciones no pueden superar 500 caracteres',
          'Bad Request',
        )
      }
      equipo.observaciones = observaciones === '' ? null : observaciones
    }
    equipo.updatedAt = new Date().toISOString()

    const estadoCambia = estadoAnterior !== equipo.estado
    const obsCambia = (obsAnterior ?? '') !== (equipo.observaciones ?? '')
    if (estadoCambia || obsCambia) {
      equipos.historial = [
        ...equipos.historial,
        {
          id: `hist-${equipo.id}-${equipos.historial.length + 1}`,
          equipoId: equipo.id,
          estadoAnterior,
          estadoNuevo: equipo.estado,
          observacionesAnterior: obsAnterior,
          observacionesNuevas: equipo.observaciones,
          usuarioId: actorEquipos?.id ?? 'usuario-1',
          createdAt: equipo.updatedAt,
          usuario: actorEquipos
            ? { id: actorEquipos.id, nombre: actorEquipos.nombre }
            : { id: 'usuario-1', nombre: 'Ada Pruebas' },
        },
      ]
    }
    return HttpResponse.json(equipo)
  }),

  http.get(`${BASE_API}/reports/comparativo`, ({ request }) => {
    if (!reportesPermitido()) {
      return errorApi(403, 'Acceso denegado', 'Forbidden')
    }

    const url = new URL(request.url)
    const desde = url.searchParams.get('desde') ?? ''
    const hasta = url.searchParams.get('hasta') ?? ''
    const sucursalId = url.searchParams.get('sucursalId')

    if (!esFechaLocalMock(desde) || !esFechaLocalMock(hasta)) {
      return errorApi(
        400,
        'La fecha debe ser un dia valido en formato YYYY-MM-DD',
        'Bad Request',
      )
    }
    if (hasta < desde) {
      return errorApi(
        400,
        'El filtro hasta no puede ser anterior a desde',
        'Bad Request',
      )
    }
    if (diasDelRangoMock(desde, hasta) > MAXIMO_DIAS_REPORTE_MOCK) {
      return errorApi(
        400,
        `El rango del reporte no puede superar ${MAXIMO_DIAS_REPORTE_MOCK} dias`,
        'Bad Request',
      )
    }

    let seleccionadas = sucursalesEstado
    if (sucursalId !== null) {
      seleccionadas = sucursalesEstado.filter((s) => s.id === sucursalId)
      if (seleccionadas.length === 0) {
        return errorApi(404, 'La sucursal no existe', 'Not Found')
      }
    }

    const ordenadas = [...seleccionadas].sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    )
    const reporte: ReporteComparativoApi = {
      desde,
      hasta,
      generadoEn: '2026-10-11T20:00:00.000Z',
      sucursales: ordenadas.map((sucursal) => ({
        sucursalId: sucursal.id,
        sucursalNombre: sucursal.nombre,
        ...metricasReporteDeSucursal(sucursal.id),
      })),
    }
    return HttpResponse.json(reporte)
  }),

  // ------------------------------------------------------------ empleados

  http.get(`${BASE_API}/employees`, ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.trim().toLowerCase()
    const estado = url.searchParams.get('estado')
    const sucursalId = url.searchParams.get('sucursalId')
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '20')

    let items = empleadosEstado.empleados.filter(empleadoVisible)
    if (sucursalId) {
      items = items.filter((empleado) => empleado.sucursalId === sucursalId)
    }
    if (estado) items = items.filter((empleado) => empleado.estado === estado)
    if (q) {
      items = items.filter(
        (empleado) =>
          empleado.usuario.nombre.toLowerCase().includes(q) ||
          empleado.usuario.nombreUsuario.toLowerCase().includes(q) ||
          empleado.cargo.toLowerCase().includes(q),
      )
    }
    return HttpResponse.json(paginar(items, page, limit))
  }),

  http.get(`${BASE_API}/employees/:id`, ({ params }) => {
    const empleado = empleadosEstado.empleados.find(
      (item) => item.id === params.id,
    )
    if (!empleado || !empleadoVisible(empleado)) return empleadoFueraDeAlcance()
    return HttpResponse.json(empleado)
  }),

  http.post(`${BASE_API}/employees`, async ({ request }) => {
    const cuerpo = (await request.json()) as {
      usuarioId?: string
      cargo?: string
      fechaContratacion?: string
      sucursalId?: string
    }

    const usuario = usuarios.usuarios.find(
      (item) => item.id === cuerpo.usuarioId,
    )
    if (!usuario || !usuarioVisible(usuario)) {
      return errorApi(
        404,
        'El usuario no existe o esta fuera de tu alcance',
        'Not Found',
      )
    }

    const problema = problemaVinculoEmpleado(usuario, cuerpo.sucursalId ?? null)
    if (problema) {
      return errorApi(400, 'El usuario no puede vincularse a un empleado', 'Bad Request')
    }

    const cargo = (cuerpo.cargo ?? '').trim()
    if (cargo.length < 1 || cargo.length > 100) {
      return errorApi(
        400,
        'El cargo no puede exceder 100 caracteres',
        'Bad Request',
      )
    }
    const fechaContratacion = cuerpo.fechaContratacion ?? ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaContratacion)) {
      return errorApi(
        400,
        'La fecha debe ser un dia valido en formato YYYY-MM-DD',
        'Bad Request',
      )
    }

    if (empleadosEstado.empleados.some((item) => item.usuarioId === usuario.id)) {
      return errorApi(
        409,
        'El usuario ya esta registrado como empleado',
        'Conflict',
      )
    }

    const ahora = new Date().toISOString()
    const empleado: EmpleadoApi = {
      id: `empleado-${empleadosEstado.empleados.length + 1}`,
      usuarioId: usuario.id,
      cargo,
      sucursalId: usuario.sucursalId ?? '',
      fechaContratacion: `${fechaContratacion}T00:00:00.000Z`,
      fechaCese: null,
      estado: 'activo',
      createdAt: ahora,
      updatedAt: ahora,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        nombreUsuario: usuario.nombreUsuario,
        rol: usuario.rol,
      },
    }
    empleadosEstado.empleados = [...empleadosEstado.empleados, empleado]
    return HttpResponse.json(empleado, { status: 201 })
  }),

  http.patch(`${BASE_API}/employees/:id`, async ({ request, params }) => {
    const empleado = empleadosEstado.empleados.find(
      (item) => item.id === params.id,
    )
    if (!empleado || !empleadoVisible(empleado)) return empleadoFueraDeAlcance()

    const cuerpo = (await request.json()) as { cargo?: string }
    const cargo = (cuerpo.cargo ?? '').trim()
    if (cargo.length < 1 || cargo.length > 100) {
      return errorApi(
        400,
        'El cargo no puede exceder 100 caracteres',
        'Bad Request',
      )
    }
    empleado.cargo = cargo
    empleado.updatedAt = new Date().toISOString()
    return HttpResponse.json(empleado)
  }),

  http.post(`${BASE_API}/employees/:id/cese`, async ({ request, params }) => {
    const empleado = empleadosEstado.empleados.find(
      (item) => item.id === params.id,
    )
    if (!empleado || !empleadoVisible(empleado)) return empleadoFueraDeAlcance()
    if (empleado.estado === 'inactivo') {
      return errorApi(409, 'El empleado ya esta cesado', 'Conflict')
    }

    const cuerpo = (await request.json().catch(() => ({}))) as {
      fechaCese?: string
    }
    const fechaCese = cuerpo.fechaCese ?? new Date().toISOString().slice(0, 10)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(fechaCese) ||
      fechaCese < empleado.fechaContratacion.slice(0, 10)
    ) {
      return errorApi(400, 'La fecha de cese no es valida', 'Bad Request')
    }

    empleado.estado = 'inactivo'
    empleado.fechaCese = `${fechaCese}T00:00:00.000Z`
    empleado.updatedAt = new Date().toISOString()

    // El cese bloquea la cuenta del usuario vinculado en la misma operación.
    const usuario = usuarios.usuarios.find((item) => item.id === empleado.usuarioId)
    if (usuario) {
      usuario.estado = 'bloqueado'
      usuario.updatedAt = empleado.updatedAt
    }

    return HttpResponse.json(empleado)
  }),

  http.post(`${BASE_API}/employees/:id/pin`, ({ params }) => {
    const empleado = empleadosEstado.empleados.find(
      (item) => item.id === params.id,
    )
    if (!empleado || !empleadoVisible(empleado)) return empleadoFueraDeAlcance()
    if (empleado.estado !== 'activo') {
      return errorApi(
        400,
        'No se puede generar un PIN para un empleado cesado',
        'Bad Request',
      )
    }
    const pin = String(Math.floor(100000 + Math.random() * 900000))
    return HttpResponse.json({ pin })
  }),

  // ------------------------------------------------ turnos y asignaciones

  http.get(`${BASE_API}/shifts`, ({ request }) => {
    const url = new URL(request.url)
    const sucursalId = url.searchParams.get('sucursalId')
    const tipo = url.searchParams.get('tipo')
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '20')
    if (limit > 100) {
      return errorApi(400, 'limit no puede exceder 100', 'Bad Request')
    }
    if (tipo !== null && tipo !== 'fijo' && tipo !== 'variable') {
      return errorApi(
        400,
        'El filtro tipo debe ser uno de: fijo, variable',
        'Bad Request',
      )
    }

    let items = turnosEstado.turnos.filter(turnoVisible)
    if (sucursalId) {
      items = items.filter((turno) => turno.sucursalId === sucursalId)
    }
    if (tipo) items = items.filter((turno) => turno.tipo === tipo)
    return HttpResponse.json(paginar(items, page, limit))
  }),

  http.get(`${BASE_API}/shifts/:id`, ({ params }) => {
    const turno = turnosEstado.turnos.find((item) => item.id === params.id)
    if (!turno || !turnoVisible(turno)) return turnoFueraDeAlcance()
    return HttpResponse.json(turno)
  }),

  http.post(`${BASE_API}/shifts`, async ({ request }) => {
    const cuerpo = (await request.json()) as {
      sucursalId?: string
      tipo?: string
      horaInicio?: string
      horaFin?: string
      diasSemana?: string
    }
    const tipo = cuerpo.tipo
    if (tipo !== 'fijo' && tipo !== 'variable') {
      return errorApi(
        400,
        'El tipo debe ser uno de: fijo, variable',
        'Bad Request',
      )
    }

    const horaInicio = normalizarHoraMock(cuerpo.horaInicio)
    const horaFin = normalizarHoraMock(cuerpo.horaFin)
    const problemasHorario = problemasHorarioMock(tipo, horaInicio, horaFin)
    if (problemasHorario.length > 0) {
      return errorConProblemas('El horario del turno no es valido', problemasHorario)
    }

    const dias = normalizarDiasMock(cuerpo.diasSemana, tipo)
    if (!dias.ok) return errorConProblemas(dias.mensaje, dias.problemas)

    // Sucursal: la del Gerente (la suya siempre), o la que elija el Admin.
    let sucursalId: string
    if (actorTurnos && !actorTurnosEsAdmin()) {
      if (!actorTurnos.sucursalId) {
        return errorApi(
          403,
          'Tu cuenta no tiene una sucursal asignada',
          'Forbidden',
        )
      }
      sucursalId = actorTurnos.sucursalId
    } else {
      if (!cuerpo.sucursalId) {
        return errorApi(
          400,
          'Debes indicar la sucursal del turno',
          'Bad Request',
        )
      }
      if (!sucursalValida(cuerpo.sucursalId)) {
        return errorApi(404, 'Sucursal no encontrada', 'Not Found')
      }
      sucursalId = cuerpo.sucursalId
    }

    const ahora = new Date().toISOString()
    const turno: TurnoApi = {
      id: `turno-${turnosEstado.turnos.length + 1}`,
      sucursalId,
      tipo,
      horaInicio,
      horaFin,
      diasSemana: dias.valor,
      createdAt: ahora,
      updatedAt: ahora,
    }
    turnosEstado.turnos.push(turno)
    return HttpResponse.json(turno, { status: 201 })
  }),

  http.patch(`${BASE_API}/shifts/:id`, async ({ request, params }) => {
    const turno = turnosEstado.turnos.find((item) => item.id === params.id)
    if (!turno || !turnoVisible(turno)) return turnoFueraDeAlcance()

    const cuerpo = (await request.json()) as {
      horaInicio?: string
      horaFin?: string
      diasSemana?: string
    }
    if (
      cuerpo.horaInicio === undefined &&
      cuerpo.horaFin === undefined &&
      cuerpo.diasSemana === undefined
    ) {
      return errorApi(400, 'No hay cambios que aplicar al turno', 'Bad Request')
    }

    // Se valida el resultado completo: cambiar una sola hora no salta la regla.
    const horaInicio =
      cuerpo.horaInicio === undefined
        ? turno.horaInicio
        : normalizarHoraMock(cuerpo.horaInicio)
    const horaFin =
      cuerpo.horaFin === undefined
        ? turno.horaFin
        : normalizarHoraMock(cuerpo.horaFin)
    const problemasHorario = problemasHorarioMock(turno.tipo, horaInicio, horaFin)
    if (problemasHorario.length > 0) {
      return errorConProblemas('El horario del turno no es valido', problemasHorario)
    }

    let diasSemana = turno.diasSemana
    if (cuerpo.diasSemana !== undefined) {
      const dias = normalizarDiasMock(cuerpo.diasSemana, turno.tipo)
      if (!dias.ok) return errorConProblemas(dias.mensaje, dias.problemas)
      diasSemana = dias.valor
    }

    // El cambio no puede dejar a un empleado con dos asignaciones solapadas.
    const candidata = { ...turno, horaInicio, horaFin, diasSemana }
    for (const asignacion of turnosEstado.asignaciones.filter(
      (item) => item.turnoId === turno.id,
    )) {
      for (const otra of turnosEstado.asignaciones.filter(
        (item) =>
          item.empleadoId === asignacion.empleadoId && item.id !== asignacion.id,
      )) {
        if (
          rangosSeCruzanMock(asignacion, otra) &&
          horariosSeCruzanMock(candidata, otra.turno)
        ) {
          return errorApi(
            409,
            'El cambio dejaria asignaciones solapadas del mismo empleado',
            'Conflict',
          )
        }
      }
    }

    turno.horaInicio = horaInicio
    turno.horaFin = horaFin
    turno.diasSemana = diasSemana
    turno.updatedAt = new Date().toISOString()
    return HttpResponse.json(turno)
  }),

  http.get(`${BASE_API}/assignments`, ({ request }) => {
    const url = new URL(request.url)
    const empleadoId = url.searchParams.get('empleadoId')
    const turnoId = url.searchParams.get('turnoId')
    const vigente = url.searchParams.get('vigente')
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '20')
    if (limit > 100) {
      return errorApi(400, 'limit no puede exceder 100', 'Bad Request')
    }

    let items = turnosEstado.asignaciones.filter(asignacionVisible)
    if (empleadoId) items = items.filter((item) => item.empleadoId === empleadoId)
    if (turnoId) items = items.filter((item) => item.turnoId === turnoId)
    if (vigente === 'true') {
      const hoy = diaNegocioPrueba()
      items = items.filter(
        (item) =>
          item.fechaInicio <= hoy &&
          (item.fechaFin === null || item.fechaFin >= hoy),
      )
    }
    return HttpResponse.json(paginar(items, page, limit))
  }),

  http.post(`${BASE_API}/assignments`, async ({ request }) => {
    const cuerpo = (await request.json()) as {
      empleadoId?: string
      turnoId?: string
      fechaInicio?: string
      fechaFin?: string
    }

    const empleado = empleadosEstado.empleados.find(
      (item) => item.id === cuerpo.empleadoId,
    )
    if (!empleado || !empleadoVisible(empleado)) {
      return errorApi(404, 'Empleado no encontrado', 'Not Found')
    }

    const turno = turnosEstado.turnos.find((item) => item.id === cuerpo.turnoId)
    if (!turno || !turnoVisible(turno)) {
      return errorApi(404, 'Turno no encontrado', 'Not Found')
    }
    if (turno.sucursalId !== empleado.sucursalId) {
      return errorApi(
        404,
        'El turno no pertenece a la sucursal del empleado',
        'Not Found',
      )
    }
    if (empleado.estado !== 'activo') {
      return errorApi(
        409,
        'El empleado esta cesado y no se le pueden asignar turnos',
        'Conflict',
      )
    }

    const fechaInicio = cuerpo.fechaInicio ?? ''
    if (!FORMATO_DIA.test(fechaInicio)) {
      return errorApi(
        400,
        'La fecha debe ser un dia valido en formato YYYY-MM-DD',
        'Bad Request',
      )
    }
    const fechaFin = cuerpo.fechaFin ?? null
    if (fechaFin !== null && !FORMATO_DIA.test(fechaFin)) {
      return errorApi(
        400,
        'La fecha debe ser un dia valido en formato YYYY-MM-DD',
        'Bad Request',
      )
    }
    if (fechaInicio < empleado.fechaContratacion.slice(0, 10)) {
      return errorApi(
        400,
        'La fecha de inicio no puede ser anterior a la contratacion del empleado',
        'Bad Request',
      )
    }
    if (fechaFin !== null && fechaFin < fechaInicio) {
      return errorApi(
        400,
        'La fecha de fin no puede ser anterior a la de inicio',
        'Bad Request',
      )
    }

    const candidata = { fechaInicio, fechaFin }
    const delEmpleado = turnosEstado.asignaciones.filter(
      (item) => item.empleadoId === empleado.id,
    )
    if (
      delEmpleado.some(
        (item) =>
          rangosSeCruzanMock(candidata, item) &&
          horariosSeCruzanMock(turno, item.turno),
      )
    ) {
      return errorApi(
        409,
        'El empleado ya tiene una asignacion que se solapa',
        'Conflict',
      )
    }

    const ahora = new Date().toISOString()
    const asignacion: AsignacionApi = {
      id: `asignacion-${turnosEstado.asignaciones.length + 1}`,
      empleadoId: empleado.id,
      turnoId: turno.id,
      fechaInicio,
      fechaFin,
      createdAt: ahora,
      updatedAt: ahora,
      empleado: {
        id: empleado.id,
        cargo: empleado.cargo,
        sucursalId: empleado.sucursalId,
        usuario: {
          id: empleado.usuario.id,
          nombre: empleado.usuario.nombre,
          nombreUsuario: empleado.usuario.nombreUsuario,
        },
      },
      turno: { ...turno },
    }
    turnosEstado.asignaciones.push(asignacion)
    return HttpResponse.json(asignacion, { status: 201 })
  }),

  http.patch(`${BASE_API}/assignments/:id`, async ({ request, params }) => {
    const asignacion = turnosEstado.asignaciones.find(
      (item) => item.id === params.id,
    )
    if (!asignacion || !asignacionVisible(asignacion)) {
      return errorApi(404, 'Asignacion no encontrada', 'Not Found')
    }

    const cuerpo = (await request.json()) as { fechaFin?: string }
    const fechaFin = cuerpo.fechaFin ?? ''
    if (!FORMATO_DIA.test(fechaFin)) {
      return errorApi(
        400,
        'La fecha debe ser un dia valido en formato YYYY-MM-DD',
        'Bad Request',
      )
    }
    if (fechaFin < asignacion.fechaInicio) {
      return errorApi(
        400,
        'La fecha de fin no puede ser anterior a la de inicio',
        'Bad Request',
      )
    }
    if (fechaFin < diaNegocioPrueba()) {
      return errorApi(
        400,
        'La fecha de fin no puede ser anterior a hoy',
        'Bad Request',
      )
    }

    asignacion.fechaFin = fechaFin
    asignacion.updatedAt = new Date().toISOString()
    return HttpResponse.json(asignacion)
  }),

  // ------------------------------------------------------------ usuarios

  http.get(`${BASE_API}/users`, ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.trim().toLowerCase()
    const rol = url.searchParams.get('rol')
    const estado = url.searchParams.get('estado')
    const sucursalId = url.searchParams.get('sucursalId')
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '20')

    let items = usuarios.usuarios.filter(usuarioVisible)
    if (sucursalId) items = items.filter((usuario) => usuario.sucursalId === sucursalId)
    if (rol) items = items.filter((usuario) => usuario.rol === rol)
    if (estado) items = items.filter((usuario) => usuario.estado === estado)
    if (q) {
      items = items.filter(
        (usuario) =>
          usuario.nombre.toLowerCase().includes(q) ||
          usuario.nombreUsuario.toLowerCase().includes(q),
      )
    }
    return HttpResponse.json(paginar(items, page, limit))
  }),

  http.post(`${BASE_API}/users`, async ({ request }) => {
    const cuerpo = (await request.json()) as {
      nombre?: string
      nombreUsuario?: string
      password?: string
      rol?: string
      sucursalId?: string | null
    }
    const nombre = (cuerpo.nombre ?? '').trim()
    if (nombre.length < 3 || nombre.length > 120) {
      return errorApi(
        400,
        'El nombre debe tener entre 3 y 120 caracteres',
        'Bad Request',
      )
    }
    const nombreUsuario = (cuerpo.nombreUsuario ?? '').trim().toLowerCase()
    if (nombreUsuario.length < 3 || nombreUsuario.length > 30) {
      return errorApi(
        400,
        'El nombre de usuario debe tener entre 3 y 30 caracteres',
        'Bad Request',
      )
    }
    if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(nombreUsuario)) {
      return errorApi(400, 'El nombre de usuario no es valido', 'Bad Request')
    }
    const password = cuerpo.password ?? ''
    if (password.length < 12) {
      return errorApi(
        400,
        'La contrasena debe tener al menos 12 caracteres',
        'Bad Request',
      )
    }
    if (new TextEncoder().encode(password).length > 72) {
      return errorApi(
        400,
        'La contrasena no puede superar 72 bytes',
        'Bad Request',
      )
    }

    let rol: string
    let sucursalId: string | null
    if (actorUsuariosEsAdmin()) {
      rol = cuerpo.rol ?? ''
      if (!['Admin', 'Gerente', 'Empleado'].includes(rol)) {
        return errorApi(400, 'El rol no es valido', 'Bad Request')
      }
      sucursalId = rol === 'Admin' ? null : cuerpo.sucursalId ?? null
      if (sucursalId && !sucursalValida(sucursalId)) {
        return errorApi(404, 'La sucursal no existe', 'Not Found')
      }
      if (rol !== 'Admin' && !sucursalId) {
        return errorApi(
          400,
          'Un Gerente o Empleado requiere una sucursal',
          'Bad Request',
        )
      }
    } else {
      // Un Gerente solo crea Empleados en su propia sucursal.
      rol = 'Empleado'
      sucursalId = actorUsuarios?.sucursalId ?? null
      if (!sucursalId) {
        return errorApi(403, 'Tu usuario no tiene sucursal asignada', 'Forbidden')
      }
    }

    if (usuarios.usuarios.some((usuario) => usuario.nombreUsuario === nombreUsuario)) {
      return errorApi(
        409,
        'Ya existe un usuario con ese nombre de usuario',
        'Conflict',
      )
    }

    const ahora = new Date().toISOString()
    const usuario: UsuarioGestionApi = {
      id: `usuario-${usuarios.usuarios.length + 1}`,
      nombre,
      nombreUsuario,
      rol,
      sucursalId,
      estado: 'activo',
      createdAt: ahora,
      updatedAt: ahora,
    }
    usuarios.usuarios = [...usuarios.usuarios, usuario]
    return HttpResponse.json(usuario, { status: 201 })
  }),

  http.get(`${BASE_API}/users/:id`, ({ params }) => {
    const usuario = usuarios.usuarios.find((item) => item.id === params.id)
    if (!usuario || !usuarioVisible(usuario)) return usuarioFueraDeAlcance()
    return HttpResponse.json(usuario)
  }),

  http.patch(`${BASE_API}/users/:id`, async ({ request, params }) => {
    const usuario = usuarios.usuarios.find((item) => item.id === params.id)
    if (!usuario || !usuarioVisible(usuario)) return usuarioFueraDeAlcance()
    const esPropia = usuario.id === (actorUsuarios?.id ?? null)
    const cuerpo = (await request.json()) as {
      nombre?: string
      nombreUsuario?: string
      rol?: string
      sucursalId?: string | null
    }

    if (cuerpo.rol !== undefined && esPropia) {
      return errorApi(400, 'No puedes cambiar tu propio rol', 'Bad Request')
    }
    if (cuerpo.sucursalId !== undefined && esPropia) {
      return errorApi(400, 'No puedes cambiar tu propia sucursal', 'Bad Request')
    }
    if (
      !actorUsuariosEsAdmin() &&
      (cuerpo.rol !== undefined || cuerpo.sucursalId !== undefined)
    ) {
      return errorApi(
        403,
        'Solo el administrador puede cambiar el rol o la sucursal',
        'Forbidden',
      )
    }

    if (cuerpo.nombre !== undefined) {
      const nombre = cuerpo.nombre.trim()
      if (nombre.length < 3 || nombre.length > 120) {
        return errorApi(
          400,
          'El nombre debe tener entre 3 y 120 caracteres',
          'Bad Request',
        )
      }
      usuario.nombre = nombre
    }

    if (cuerpo.nombreUsuario !== undefined) {
      const nombreUsuario = (cuerpo.nombreUsuario ?? '').trim().toLowerCase()
      if (nombreUsuario.length < 3 || nombreUsuario.length > 30) {
        return errorApi(
          400,
          'El nombre de usuario debe tener entre 3 y 30 caracteres',
          'Bad Request',
        )
      }
      if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(nombreUsuario)) {
        return errorApi(400, 'El nombre de usuario no es valido', 'Bad Request')
      }
      if (
        usuarios.usuarios.some(
          (item) => item.id !== usuario.id && item.nombreUsuario === nombreUsuario,
        )
      ) {
        return errorApi(
          409,
          'Ya existe un usuario con ese nombre de usuario',
          'Conflict',
        )
      }
      usuario.nombreUsuario = nombreUsuario
    }

    if (cuerpo.rol !== undefined && actorUsuariosEsAdmin()) {
      if (!['Admin', 'Gerente', 'Empleado'].includes(cuerpo.rol)) {
        return errorApi(400, 'El rol no es valido', 'Bad Request')
      }
      usuario.rol = cuerpo.rol
      if (cuerpo.rol === 'Admin') usuario.sucursalId = null
    }
    if (cuerpo.sucursalId !== undefined && actorUsuariosEsAdmin() && usuario.rol !== 'Admin') {
      if (cuerpo.sucursalId && !sucursalValida(cuerpo.sucursalId)) {
        return errorApi(404, 'La sucursal no existe', 'Not Found')
      }
      if (!cuerpo.sucursalId) {
        return errorApi(
          400,
          'Un Gerente o Empleado requiere una sucursal',
          'Bad Request',
        )
      }
      usuario.sucursalId = cuerpo.sucursalId
    }

    usuario.updatedAt = new Date().toISOString()
    return HttpResponse.json(usuario)
  }),

  http.patch(`${BASE_API}/users/:id/estado`, async ({ request, params }) => {
    const usuario = usuarios.usuarios.find((item) => item.id === params.id)
    if (!usuario || !usuarioVisible(usuario)) return usuarioFueraDeAlcance()
    if (usuario.id === (actorUsuarios?.id ?? null)) {
      return errorApi(400, 'No puedes cambiar el estado de tu propia cuenta', 'Bad Request')
    }
    const cuerpo = (await request.json()) as { estado?: string }
    if (cuerpo.estado !== 'activo' && cuerpo.estado !== 'bloqueado') {
      return errorApi(400, 'El estado no es valido', 'Bad Request')
    }
    if (cuerpo.estado === 'bloqueado' && usuario.rol === 'Admin') {
      const adminsActivos = usuarios.usuarios.filter(
        (item) => item.rol === 'Admin' && item.estado === 'activo',
      ).length
      if (adminsActivos <= 1) {
        return errorApi(
          409,
          'No puedes bloquear al ultimo administrador activo',
          'Conflict',
        )
      }
    }
    usuario.estado = cuerpo.estado as EstadoUsuario
    usuario.updatedAt = new Date().toISOString()
    return HttpResponse.json(usuario)
  }),

  http.get(`${BASE_API}/users/:id/permisos`, ({ params }) => {
    const usuario = usuarios.usuarios.find((item) => item.id === params.id)
    if (!usuario || !usuarioVisible(usuario)) return usuarioFueraDeAlcance()
    return HttpResponse.json(permisosEfectivos(usuario))
  }),

  http.put(`${BASE_API}/users/:id/permisos/:permisoId`, async ({ request, params }) => {
    const usuario = usuarios.usuarios.find((item) => item.id === params.id)
    if (!usuario || !usuarioVisible(usuario)) return usuarioFueraDeAlcance()
    if (usuario.id === (actorUsuarios?.id ?? null)) {
      return errorApi(400, 'No puedes cambiar tus propios permisos', 'Bad Request')
    }
    const permiso = CATALOGO_PERMISOS_PRUEBA.find(
      (item) => item.id === String(params.permisoId),
    )
    if (!permiso) return errorApi(404, 'El permiso no existe', 'Not Found')
    const cuerpo = (await request.json()) as { tipo?: string }
    if (cuerpo.tipo !== 'concedido' && cuerpo.tipo !== 'revocado') {
      return errorApi(400, 'El tipo de asignacion no es valido', 'Bad Request')
    }
    const posee = actorUsuarios?.permisos.includes(permiso.codigo) ?? true
    if (!posee) {
      return errorApi(400, 'No puedes asignar un permiso que no posees', 'Bad Request')
    }
    if (cuerpo.tipo === 'concedido' && usuario.rol === 'Empleado') {
      if (
        !['insumos.ver', 'inventario.registrar', 'ventas.registrar', 'equipo.ver'].includes(
          permiso.codigo,
        )
      ) {
        return errorApi(
          400,
          'A un Empleado solo se le pueden conceder los permisos de la matriz de seguridad',
          'Bad Request',
        )
      }
    }
    if (cuerpo.tipo === 'revocado') {
      if (!(DEFAULT_PERMISOS_POR_ROL[usuario.rol] ?? []).includes(permiso.codigo)) {
        return errorApi(
          400,
          'No se puede revocar un permiso que el rol no otorga por defecto',
          'Bad Request',
        )
      }
    }
    usuarios.individuales.set(
      `${usuario.id}:${String(params.permisoId)}`,
      cuerpo.tipo,
    )
    return new HttpResponse(null, { status: 204 })
  }),

  http.delete(`${BASE_API}/users/:id/permisos/:permisoId`, ({ params }) => {
    const usuario = usuarios.usuarios.find((item) => item.id === params.id)
    if (!usuario || !usuarioVisible(usuario)) return usuarioFueraDeAlcance()
    if (usuario.id === (actorUsuarios?.id ?? null)) {
      return errorApi(400, 'No puedes cambiar tus propios permisos', 'Bad Request')
    }
    const clave = `${usuario.id}:${String(params.permisoId)}`
    if (!usuarios.individuales.has(clave)) {
      return errorApi(
        404,
        'El permiso no tiene una asignacion individual',
        'Not Found',
      )
    }
    usuarios.individuales.delete(clave)
    return new HttpResponse(null, { status: 204 })
  }),

  // ------------------------------------------------------------ auditoría

  http.get(`${BASE_API}/auditoria/usuarios/:usuarioId`, ({ request, params }) => {
    const usuarioId = String(params.usuarioId)
    const usuario = usuarios.usuarios.find((item) => item.id === usuarioId)
    if (!usuario || !usuarioVisible(usuario)) {
      return errorApi(
        404,
        'El usuario no existe o esta fuera de tu alcance',
        'Not Found',
      )
    }
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '10')
    const items = auditoria
      .filter(
        (evento) =>
          evento.usuarioAfectadoId === usuarioId ||
          evento.actor.id === usuarioId,
      )
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
    return HttpResponse.json(paginarAuditoria(items, page, limit))
  }),

  http.get(`${BASE_API}/auditoria`, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '20')
    if (limit > 100) {
      return errorApi(400, 'El limite no puede superar 100', 'Bad Request')
    }

    const desde = url.searchParams.get('desde') ?? undefined
    const hasta = url.searchParams.get('hasta') ?? undefined
    const formatoFecha = /^\d{4}-\d{2}-\d{2}$/
    if (desde && !formatoFecha.test(desde)) {
      return errorApi(400, 'La fecha "desde" no es valida', 'Bad Request')
    }
    if (hasta && !formatoFecha.test(hasta)) {
      return errorApi(400, 'La fecha "hasta" no es valida', 'Bad Request')
    }
    if (desde && hasta) {
      if (hasta <= desde) {
        return errorApi(
          400,
          'La fecha "hasta" no puede ser anterior a "desde"',
          'Bad Request',
        )
      }
      if (diasEntreFechas(desde, hasta) > 92) {
        return errorApi(
          400,
          'El rango de fechas no puede superar 92 dias',
          'Bad Request',
        )
      }
    }

    let items = auditoria
    const entidad = url.searchParams.get('entidad')
    const accion = url.searchParams.get('accion')
    const actorId = url.searchParams.get('actorId')
    const sucursalId = url.searchParams.get('sucursalId')
    if (entidad) items = items.filter((evento) => evento.entidad === entidad)
    if (accion) items = items.filter((evento) => evento.accion === accion)
    if (actorId) items = items.filter((evento) => evento.actor.id === actorId)
    if (sucursalId) {
      items = items.filter(
        (evento) => evento.sucursalAfectadaId === sucursalId,
      )
    }
    if (desde) {
      items = items.filter((evento) => evento.fecha.slice(0, 10) >= desde)
    }
    if (hasta) {
      items = items.filter((evento) => evento.fecha.slice(0, 10) <= hasta)
    }
    items = [...items].sort((a, b) => b.fecha.localeCompare(a.fecha))
    return HttpResponse.json(paginarAuditoria(items, page, limit))
  }),
]
