import { describe, expect, it } from 'vitest'
import { filtrarMenu, MENU_ITEMS } from './menu'

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

const etiquetas = (permisos: string[]) =>
  filtrarMenu(permisos).map((item) => item.label)

describe('menú por rol (según permisos efectivos)', () => {
  it('el Admin ve todos los módulos', () => {
    expect(filtrarMenu(PERMISOS_ADMIN)).toHaveLength(MENU_ITEMS.length)
    expect(etiquetas(PERMISOS_ADMIN)).toContain('Reportes')
    expect(etiquetas(PERMISOS_ADMIN)).toContain('Usuarios')
    expect(etiquetas(PERMISOS_ADMIN)).toContain('Equipos')
  })

  it('el Gerente no ve Reportes pero sí Usuarios e Inventario', () => {
    const visibles = etiquetas(PERMISOS_GERENTE)
    expect(visibles).not.toContain('Reportes')
    expect(visibles).toContain('Usuarios')
    expect(visibles).toContain('Inventario')
    expect(visibles).toContain('Alertas')
  })

  it('el Empleado solo ve Inicio, Sucursales, Productos y Asistencia', () => {
    expect(etiquetas(PERMISOS_EMPLEADO)).toEqual([
      'Inicio',
      'Sucursales',
      'Productos',
      'Asistencia',
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
})
