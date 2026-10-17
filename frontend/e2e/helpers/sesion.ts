// Utilidades de sesión para las pruebas E2E: iniciar y cerrar sesión por la UI.
import { expect, type Page } from '@playwright/test'
import type { CuentaVerificacion } from './credenciales'

/** Rellena el formulario de login y espera al panel de control. */
export async function iniciarSesion(
  page: Page,
  cuenta: CuentaVerificacion,
): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Usuario', { exact: true }).fill(cuenta.usuario)
  await page.getByLabel('Contraseña', { exact: true }).fill(cuenta.clave)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(
    page.getByRole('heading', { name: 'Panel de control' }),
  ).toBeVisible()
}

/** Cierra la sesión desde el menú de cuenta y espera a `/login`. */
export async function cerrarSesion(page: Page): Promise<void> {
  await page.locator('button[aria-haspopup="menu"]').click()
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
}
