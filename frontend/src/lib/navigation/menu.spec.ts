import { describe, expect, it } from 'vitest'
import {
  filtrarMenu,
  filtrarMenuAgrupado,
  MENU_ITEMS,
  puedeAccederRuta,
  puedeVerItem,
  subpaginasVisibles,
} from './menu'

const PERMISOS_ADMIN = [
  'sucursales.crear_editar',
  'sucursales.ver',
  'usuarios.crear_editar',
  'permisos.asignar',
  'productos.catalogo.editar',
  'productos.precio.editar',
  'productos.ver',
  'insumos.catalogo.editar',
  'insumos.ver',
  'inventario.registrar',
  'inventario.minimo.editar',
  'inventario.recuento',
  'alertas.ver_resolver',
  'ventas.registrar',
  'ventas.anular',
  'ventas.ver',
  'reportes.comparativos.ver',
  'empleados.crear_editar',
  'turnos.editar',
  'asistencia.marcar',
  'asistencia.corregir',
  'asistencia.ver',
  'equipo.registrar_editar',
  'equipo.ver',
]

const PERMISOS_GERENTE = [
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

const PERMISOS_EMPLEADO = [
  'sucursales.ver',
  'productos.ver',
  'ventas.anular',
  'asistencia.marcar',
  'asistencia.ver',
]

const SUCURSAL_ID = 'sucursal-1'

const grupos = (permisos: string[], sucursalId?: string | null) =>
  filtrarMenuAgrupado(permisos, sucursalId).map((grupo) => ({
    titulo: grupo.titulo,
    items: grupo.items.map((item) => item.label),
  }))

const etiquetas = (permisos: string[], sucursalId?: string | null) =>
  filtrarMenu(permisos, sucursalId).map((item) => item.label)

describe('menú agrupado por permisos efectivos', () => {
  it('el Admin ve todos los módulos excepto Mi horario (no tiene sucursal)', () => {
    expect(grupos(PERMISOS_ADMIN)).toEqual([
      { titulo: undefined, items: ['Inicio'] },
      {
        titulo: 'OPERACIÓN',
        items: ['Ventas', 'Inventario', 'Productos', 'Equipos'],
      },
      {
        titulo: 'PERSONAL',
        items: ['Empleados', 'Turnos', 'Asistencia'],
      },
      {
        titulo: 'ADMINISTRACIÓN',
        items: ['Sucursales', 'Usuarios', 'Reportes', 'Auditoría'],
      },
    ])
    expect(etiquetas(PERMISOS_ADMIN)).not.toContain('Mi horario')
  })

  it('el Gerente ve Mi horario (tiene sucursal) y no ve Reportes', () => {
    const visibles = grupos(PERMISOS_GERENTE, SUCURSAL_ID)
    expect(visibles).toEqual([
      { titulo: undefined, items: ['Inicio'] },
      {
        titulo: 'OPERACIÓN',
        items: ['Ventas', 'Inventario', 'Productos', 'Equipos'],
      },
      {
        titulo: 'PERSONAL',
        items: ['Empleados', 'Turnos', 'Asistencia', 'Mi horario'],
      },
      {
        titulo: 'ADMINISTRACIÓN',
        items: ['Sucursales', 'Usuarios', 'Auditoría'],
      },
    ])
  })

  it('el Empleado ve solo sus módulos agrupados', () => {
    expect(grupos(PERMISOS_EMPLEADO, SUCURSAL_ID)).toEqual([
      { titulo: undefined, items: ['Inicio'] },
      { titulo: 'OPERACIÓN', items: ['Productos'] },
      { titulo: 'PERSONAL', items: ['Asistencia', 'Mi horario'] },
      { titulo: 'ADMINISTRACIÓN', items: ['Sucursales'] },
    ])
  })

  it('un usuario con permisos sueltos ve solo los grupos con entradas', () => {
    expect(
      grupos(['inventario.recuento', 'turnos.editar'], SUCURSAL_ID),
    ).toEqual([
      { titulo: undefined, items: ['Inicio'] },
      { titulo: 'OPERACIÓN', items: ['Inventario'] },
      { titulo: 'PERSONAL', items: ['Turnos', 'Mi horario'] },
    ])
  })

  it('un grupo vacío no se muestra (no queda un título huérfano)', () => {
    const visibles = grupos(['turnos.editar'], SUCURSAL_ID)
    expect(visibles.map((grupo) => grupo.titulo)).toEqual([
      undefined,
      'PERSONAL',
    ])
    expect(visibles.flatMap((grupo) => grupo.items)).not.toContain('Ventas')
    expect(visibles.flatMap((grupo) => grupo.items)).not.toContain('Usuarios')
  })

  it('sin permisos solo se ve Inicio', () => {
    expect(etiquetas([])).toEqual(['Inicio'])
  })

  it('un permiso revocado oculta el módulo aunque el rol sea Admin', () => {
    const sinReportes = PERMISOS_ADMIN.filter(
      (p) => p !== 'reportes.comparativos.ver',
    )
    expect(etiquetas(sinReportes)).not.toContain('Reportes')
  })

  it('Mi horario solo aparece con sucursal', () => {
    expect(etiquetas(PERMISOS_GERENTE, SUCURSAL_ID)).toContain('Mi horario')
    expect(etiquetas(PERMISOS_GERENTE, null)).not.toContain('Mi horario')
    const item = MENU_ITEMS.find((i) => i.to === '/my/schedule')!
    expect(item.requiereSucursal).toBe(true)
    expect(puedeVerItem(item, PERMISOS_ADMIN, null)).toBe(false)
    expect(puedeVerItem(item, PERMISOS_ADMIN, SUCURSAL_ID)).toBe(true)
  })
})

describe('entradas con subpáginas', () => {
  const inventario = () => MENU_ITEMS.find((i) => i.label === 'Inventario')!

  it('la entrada apunta a la primera subpágina accesible', () => {
    const soloAlertas = filtrarMenu(['alertas.ver_resolver']).find(
      (item) => item.label === 'Inventario',
    )
    expect(soloAlertas?.to).toBe('/alerts')

    const soloRecuento = filtrarMenu(['inventario.recuento']).find(
      (item) => item.label === 'Inventario',
    )
    // Stock también admite `inventario.recuento` (misma regla que su ruta).
    expect(soloRecuento?.to).toBe('/inventory')
  })

  it('la entrada se marca activa en cualquiera de sus subpáginas', () => {
    const item = filtrarMenu(PERMISOS_ADMIN).find(
      (entrada) => entrada.label === 'Inventario',
    )!
    expect(item.subpaginasVisibles.map((subpagina) => subpagina.to)).toEqual([
      '/inventory',
      '/supplies',
      '/inventory/recuentos',
      '/inventory/movimientos',
      '/alerts',
    ])
    expect(puedeAccederRuta(PERMISOS_ADMIN, '/inventory/recuentos/nuevo')).toBe(
      true,
    )
    expect(puedeAccederRuta(PERMISOS_ADMIN, '/inventory/movimientos')).toBe(true)
  })

  it('la subnavegación solo contiene las pestañas permitidas', () => {
    const permisos = ['inventario.recuento', 'alertas.ver_resolver']
    expect(
      subpaginasVisibles(inventario(), permisos).map(
        (subpagina) => subpagina.label,
      ),
    ).toEqual(['Stock', 'Recuentos', 'Alertas'])
  })

  it('todas las rutas del inventario siguen accesibles para el Admin', () => {
    const rutas = [
      '/inventory',
      '/supplies',
      '/inventory/recuentos',
      '/inventory/recuentos/nuevo',
      '/inventory/movimientos',
      '/alerts',
    ]
    for (const ruta of rutas) {
      expect(puedeAccederRuta(PERMISOS_ADMIN, ruta), ruta).toBe(true)
    }
  })
})

describe('puedeAccederRuta', () => {
  it('deniega /my/schedule al Admin sin sucursal', () => {
    expect(puedeAccederRuta(PERMISOS_ADMIN, '/my/schedule', null)).toBe(false)
    expect(
      puedeAccederRuta(PERMISOS_GERENTE, '/my/schedule', SUCURSAL_ID),
    ).toBe(true)
  })

  it('resuelve el terminal de marcación con la entrada de asistencia', () => {
    expect(puedeAccederRuta(PERMISOS_EMPLEADO, '/attendance/terminal')).toBe(true)
    expect(puedeAccederRuta(['productos.ver'], '/attendance/terminal')).toBe(
      false,
    )
  })
})
