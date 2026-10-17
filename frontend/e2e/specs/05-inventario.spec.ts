// Flujo 5: con el Gerente, un recuento por debajo del mínimo abre una alerta y
// una entrada por encima del mínimo la cierra sin recargar la página.
import { expect, test } from '@playwright/test'
import { cuentaGerenteCentro } from '../helpers/credenciales'
import { iniciarSesion } from '../helpers/sesion'

test.describe('inventario y alertas', () => {
  test('un recuento abre la alerta y una entrada la cierra sin recargar', async ({
    page,
  }) => {
    await iniciarSesion(page, cuentaGerenteCentro())

    // 1) Recuento a 0 sobre el primer insumo: abre la alerta.
    await page.goto('/inventory/recuentos/nuevo')
    await expect(
      page.getByRole('heading', { name: 'Nuevo recuento' }),
    ).toBeVisible()

    const primerConteo = page.getByLabel(/^Conteo de /).first()
    await expect(primerConteo).toBeVisible()
    const etiqueta = await primerConteo.getAttribute('aria-label')
    const insumo = (etiqueta ?? '').replace('Conteo de ', '').trim()
    expect(insumo.length).toBeGreaterThan(0)

    await primerConteo.fill('0')
    await page.getByRole('button', { name: 'Revisar recuento' }).click()
    await page.getByRole('button', { name: 'Confirmar recuento' }).click()
    await expect(page.getByText('Recuento registrado')).toBeVisible()

    // 2) En inventario el insumo queda "Bajo mínimo".
    await page.goto('/inventory')
    const fila = page.getByRole('row').filter({ hasText: insumo }).first()
    await expect(fila.getByText('Bajo mínimo', { exact: true })).toBeVisible()

    // 3) Entrada grande: sin recargar, el insumo pasa a "Normal".
    await fila.getByRole('button', { name: 'Registrar entrada' }).click()
    await page.getByRole('dialog').locator('#entrada-cantidad').fill('100000')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Registrar entrada' })
      .click()
    await expect(page.getByText('Entrada registrada')).toBeVisible()

    await expect(
      fila.getByText('Normal', { exact: true }),
    ).toBeVisible()

    // 4) La alerta desaparece del listado de alertas abiertas.
    await page.goto('/alerts')
    await expect(
      page.getByRole('cell', { name: insumo, exact: true }),
    ).toHaveCount(0)
  })
})
