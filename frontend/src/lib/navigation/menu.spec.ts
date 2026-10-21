import { describe, expect, it } from 'vitest'
import { filtrarMenu, MENU_ITEMS, puedeAccederRuta, puedeVerItem } from './menu'

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

const etiquetas = (permisos: string[], sucursalId?: string | null) =>
  filtrarMenu(permisos, sucursalId).map((item) => item.label)

describe('menú por rol (según permisos efectivos)', () => {
  it('el Admin ve todos los módulos excepto Mi horario (no tiene sucursal)', () => {
    expect(filtrarMenu(PERMISOS_ADMIN)).toHaveLength(MENU_ITEMS.length - 1)
    const visibles = etiquetas(PERMISOS_ADMIN)
    expect(visibles).toContain('Reportes')
    expect(visibles).toContain('Usuarios')
    expect(visibles).toContain('Equipos')
    expect(visibles).not.toContain('Mi horario')
  })

  it('el Gerente ve Mi horario (tiene sucursal)', () => {
    const visibles = etiquetas(PERMISOS_GERENTE, SUCURSAL_ID)
    expect(visibles).not.toContain('Reportes')
    expect(visibles).toContain('Usuarios')
    expect(visibles).toContain('Inventario')
    expect(visibles).toContain('Alertas')
    expect(visibles).toContain('Mi horario')
  })

  it('el Empleado ve Inicio, Sucursales, Productos, Asistencia y Mi horario', () => {
    expect(etiquetas(PERMISOS_EMPLEADO, SUCURSAL_ID)).toEqual([
      'Inicio',
      'Sucursales',
      'Productos',
      'Asistencia',
      'Mi horario',
    ])
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

  it('puedeVerItem respeta requiereSucursal', () => {
    const item = MENU_ITEMS.find((i) => i.to === '/my/schedule')!
    expect(item.requiereSucursal).toBe(true)
    expect(puedeVerItem(item, PERMISOS_ADMIN, null)).toBe(false)
    expect(puedeVerItem(item, PERMISOS_ADMIN, SUCURSAL_ID)).toBe(true)
  })

  it('puedeAccederRuta deniega /my/schedule al Admin', () => {
    expect(puedeAccederRuta(PERMISOS_ADMIN, '/my/schedule', null)).toBe(false)
    expect(
      puedeAccederRuta(PERMISOS_GERENTE, '/my/schedule', SUCURSAL_ID),
    ).toBe(true)
  })
})
