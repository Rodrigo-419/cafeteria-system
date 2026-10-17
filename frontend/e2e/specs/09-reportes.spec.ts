// Flujo 9: el Admin genera un reporte comparativo en un rango válido y recibe
// un mensaje claro cuando el rango supera el máximo de 92 días.
import { expect, test } from '@playwright/test'
import { cuentaAdmin } from '../helpers/credenciales'
import { iniciarSesion } from '../helpers/sesion'

test.describe('reportes', () => {
  test('rango válido genera el comparativo y el rango excesivo avisa', async ({
    page,
  }) => {
    await iniciarSesion(page, cuentaAdmin())
    await page.goto('/reports')
    await expect(
      page.getByRole('heading', { name: 'Reporte comparativo de sucursales' }),
    ).toBeVisible()

    // Rango válido (7 días) y generación.
    await page.getByRole('button', { name: '7 días' }).click()
    await page.getByRole('button', { name: 'Generar reporte' }).click()
    await expect(
      page.getByRole('heading', { name: 'Comparativo del periodo' }),
    ).toBeVisible()
    await expect(page.getByText('Ventas de la red')).toBeVisible()

    // Rango excesivo (> 92 días): mensaje claro y no se genera.
    const hasta = await page.locator('#reporte-hasta').inputValue()
    await page.locator('#reporte-desde').fill('2024-01-01')
    await page.locator('#reporte-hasta').fill(hasta)
    await page.getByRole('button', { name: 'Generar reporte' }).click()
    await expect(
      page.getByText('El rango no puede superar 92 días.'),
    ).toBeVisible()
  })
})
