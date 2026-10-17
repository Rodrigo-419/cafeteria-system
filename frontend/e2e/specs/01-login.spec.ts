// Flujo 1: inicio de sesión de las cinco cuentas y mensaje de credenciales
// incorrectas que no revela qué dato falló.
import { expect, test } from '@playwright/test'
import {
  cuentaAdmin,
  cuentaEmpleadoCentro,
  cuentaEmpleadoNorte,
  cuentaGerenteCentro,
  cuentaGerenteNorte,
  type CuentaVerificacion,
} from '../helpers/credenciales'
import { cerrarSesion, iniciarSesion } from '../helpers/sesion'

const CUENTAS: readonly CuentaVerificacion[] = [
  cuentaAdmin(),
  cuentaGerenteCentro(),
  cuentaEmpleadoCentro(),
  cuentaGerenteNorte(),
  cuentaEmpleadoNorte(),
]

test.describe('inicio de sesión', () => {
  test('las cinco cuentas inician sesión y llegan al panel', async ({ page }) => {
    for (const cuenta of CUENTAS) {
      await iniciarSesion(page, cuenta)
      await expect(
        page.getByRole('heading', { name: 'Panel de control' }),
      ).toBeVisible()
      await expect(page.locator('button[aria-haspopup="menu"]')).toContainText(
        cuenta.nombre,
      )
      await cerrarSesion(page)
    }
  })

  test('una contraseña incorrecta muestra el mensaje genérico', async ({ page }) => {
    await page.goto('/login')
    await page
      .getByLabel('Usuario', { exact: true })
      .fill(cuentaAdmin().usuario)
    await page
      .getByLabel('Contraseña', { exact: true })
      .fill('clave-deliberadamente-incorrecta')
    await page.getByRole('button', { name: 'Ingresar' }).click()

    await expect(page.getByText('Usuario o contraseña incorrectos.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('un usuario inexistente muestra el mismo mensaje genérico', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Usuario', { exact: true }).fill('usuario.inexistente')
    await page
      .getByLabel('Contraseña', { exact: true })
      .fill('clave-deliberadamente-incorrecta')
    await page.getByRole('button', { name: 'Ingresar' }).click()

    await expect(page.getByText('Usuario o contraseña incorrectos.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })
})
