// Flujo 8: marcación en el terminal con PIN demo. Un PIN incorrecto muestra el
// mensaje correcto y vacía el campo; con el PIN correcto se marca entrada y salida.
import { expect, test, type Page } from '@playwright/test'
import { cuentaEmpleadoNorte } from '../helpers/credenciales'
import { iniciarSesion } from '../helpers/sesion'

const PIN_DEMO = '246810'
const EMPLEADO = 'Empleado Norte'

async function marcarPin(page: Page, pin: string) {
  for (const digito of pin) {
    await page.getByRole('button', { name: digito, exact: true }).click()
  }
}

test.describe('asistencia en el terminal', () => {
  test('PIN incorrecto y marcación de entrada y salida', async ({ page }) => {
    await iniciarSesion(page, cuentaEmpleadoNorte())
    await page.goto('/attendance/terminal')
    await expect(
      page.getByRole('heading', { name: 'Registrar asistencia' }),
    ).toBeVisible()

    await page.getByRole('button', { name: EMPLEADO, exact: true }).click()
    await page.getByRole('button', { name: 'Entrada', exact: true }).click()

    // PIN incorrecto: mensaje correcto y campo vaciado.
    await marcarPin(page, '111111')
    await page.getByRole('button', { name: 'Registrar entrada' }).click()
    await expect(page.getByText('PIN incorrecto')).toBeVisible()
    await expect(page.getByLabel('PIN: 0 de 6 dígitos')).toBeVisible()

    // PIN correcto: entrada.
    await marcarPin(page, PIN_DEMO)
    await page.getByRole('button', { name: 'Registrar entrada' }).click()
    await expect(page.getByRole('button', { name: 'Listo' })).toBeVisible()
    await page.getByRole('button', { name: 'Listo' }).click()

    // PIN correcto: salida.
    await page.getByRole('button', { name: EMPLEADO, exact: true }).click()
    await page.getByRole('button', { name: 'Salida', exact: true }).click()
    await marcarPin(page, PIN_DEMO)
    await page.getByRole('button', { name: 'Registrar salida' }).click()
    await expect(page.getByRole('button', { name: 'Listo' })).toBeVisible()
    await page.getByRole('button', { name: 'Listo' }).click()
  })
})
