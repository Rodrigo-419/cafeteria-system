// Flujo 4: un Gerente registra y anula una venta; el Admin ve las ventas de las
// dos sucursales pero no puede registrar ni anular.
import { expect, test } from '@playwright/test'
import { cuentaAdmin, cuentaGerenteCentro } from '../helpers/credenciales'
import { iniciarSesion } from '../helpers/sesion'

test.describe('ventas', () => {
  test('el Gerente registra una venta y luego la anula', async ({ page }) => {
    await iniciarSesion(page, cuentaGerenteCentro())

    await page.goto('/sales')
    await expect(page.getByRole('heading', { name: 'Ventas' })).toBeVisible()
    await page.getByRole('link', { name: 'Nueva venta' }).click()

    await expect(page.getByRole('heading', { name: 'Nueva venta' })).toBeVisible()
    await page.getByRole('button', { name: /^Agregar / }).first().click()
    await page.getByRole('button', { name: 'Registrar venta' }).click()

    const confirmacion = page.getByRole('status').filter({
      hasText: 'Venta registrada',
    })
    await expect(confirmacion).toBeVisible()

    // Se toma el folio (id) para abrir el detalle sin depender del orden.
    const textoFolio = await confirmacion
      .getByText(/^Folio:/)
      .textContent()
    const folio = (textoFolio ?? '').replace('Folio:', '').trim()
    expect(folio.length).toBeGreaterThan(0)

    await page.goto(`/sales/${folio}`)
    await expect(
      page.getByRole('heading', { name: 'Detalle de venta' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Anular' }).click()
    await page.getByLabel('Motivo de la anulación').fill('Prueba de verificación')
    await page.getByRole('button', { name: 'Anular venta' }).click()

    await expect(page.getByText('Venta anulada').first()).toBeVisible()
  })

  test('el Admin ve las ventas de las dos sucursales sin acciones de venta', async ({
    page,
  }) => {
    await iniciarSesion(page, cuentaAdmin())
    await page.goto('/sales')
    await expect(page.getByRole('heading', { name: 'Ventas' })).toBeVisible()

    // Sin permiso de registrar ni anular.
    await expect(page.getByRole('link', { name: 'Nueva venta' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Anular' })).toHaveCount(0)

    // Filtro de sucursal (solo Admin) y presencia de vendedores de ambas sedes.
    await expect(page.locator('#filtro-sucursal')).toBeVisible()
    await expect(
      page.getByRole('cell', { name: 'Gerente Centro', exact: true }).first(),
    ).toBeVisible()
    await expect(
      page.getByRole('cell', { name: 'Gerente Norte', exact: true }).first(),
    ).toBeVisible()
  })
})
