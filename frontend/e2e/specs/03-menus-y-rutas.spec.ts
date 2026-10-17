// Flujo 3: cada rol ve solo sus menús y, al escribir a mano una URL no
// permitida, aparece la pantalla de acceso denegado sin cambiar la URL.
import { expect, test } from '@playwright/test'
import {
  cuentaAdmin,
  cuentaEmpleadoCentro,
  cuentaGerenteCentro,
} from '../helpers/credenciales'
import { iniciarSesion } from '../helpers/sesion'

function nav(page: import('@playwright/test').Page) {
  return page.getByRole('navigation')
}

test.describe('menús y rutas por rol', () => {
  test('el Admin ve todos los módulos', async ({ page }) => {
    await iniciarSesion(page, cuentaAdmin())
    for (const etiqueta of [
      'Auditoría',
      'Reportes',
      'Usuarios',
      'Ventas',
      'Inventario',
      'Alertas',
      'Equipos',
    ]) {
      await expect(
        nav(page).getByRole('link', { name: etiqueta }),
      ).toBeVisible()
    }
  })

  test('el Gerente ve Auditoría pero no Reportes', async ({ page }) => {
    await iniciarSesion(page, cuentaGerenteCentro())
    await expect(nav(page).getByRole('link', { name: 'Auditoría' })).toBeVisible()
    await expect(nav(page).getByRole('link', { name: 'Ventas' })).toBeVisible()
    await expect(nav(page).getByRole('link', { name: 'Reportes' })).toHaveCount(0)
  })

  test('el Empleado solo ve sus cuatro módulos', async ({ page }) => {
    await iniciarSesion(page, cuentaEmpleadoCentro())
    for (const etiqueta of ['Inicio', 'Sucursales', 'Productos', 'Asistencia']) {
      await expect(
        nav(page).getByRole('link', { name: etiqueta }),
      ).toBeVisible()
    }
    for (const etiqueta of [
      'Auditoría',
      'Reportes',
      'Usuarios',
      'Ventas',
      'Inventario',
      'Alertas',
    ]) {
      await expect(nav(page).getByRole('link', { name: etiqueta })).toHaveCount(0)
    }
  })

  test('una URL no permitida muestra acceso denegado sin cambiar la URL', async ({
    page,
  }) => {
    await iniciarSesion(page, cuentaEmpleadoCentro())
    for (const ruta of ['/auditoria', '/reports', '/users']) {
      await page.goto(ruta)
      await expect(
        page.getByRole('heading', { name: 'Acceso denegado' }),
      ).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`${ruta}$`))
    }
  })
})
