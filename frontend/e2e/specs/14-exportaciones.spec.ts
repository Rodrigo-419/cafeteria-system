// Flujo 14: exportaciones reales en Excel y CSV desde la pantalla central,
// más el 403 de un Empleado que intenta entrar por URL. No se ejecuta en CI.
import { expect, test } from '@playwright/test'
import { cuentaAdmin, cuentaEmpleadoCentro } from '../helpers/credenciales'
import { iniciarSesion } from '../helpers/sesion'

/** Día de negocio en America/Lima, desplazado en días. */
function diaDeNegocioLima(desplazamiento = 0): string {
  const fecha = new Date(Date.now() + desplazamiento * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha)
}

test.describe('exportaciones', () => {
  test('el Admin descarga Excel con un rango de actividad', async ({
    page,
  }) => {
    await iniciarSesion(page, cuentaAdmin())
    await page.goto('/exports')
    await expect(
      page.getByRole('heading', { name: 'Exportaciones' }),
    ).toBeVisible()

    // Ventas exige rango: seis días atrás hasta hoy, ambos incluidos.
    await page.locator('#exportacion-desde').fill(diaDeNegocioLima(-6))
    await page.locator('#exportacion-hasta').fill(diaDeNegocioLima())

    const descarga = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar Ventas a Excel' }).click()
    const archivo = await descarga

    expect(archivo.suggestedFilename()).toMatch(/^ventas-.*\.xlsx$/)
    await expect(
      page.getByText(/Archivo ventas-.*\.xlsx descargado\./),
    ).toBeVisible()
  })

  test('el Admin descarga CSV de un conjunto sin rango', async ({ page }) => {
    await iniciarSesion(page, cuentaAdmin())
    await page.goto('/exports')

    const descarga = page.waitForEvent('download')
    await page
      .getByRole('button', { name: 'Exportar Carta y precios a CSV' })
      .click()
    const archivo = await descarga

    expect(archivo.suggestedFilename()).toMatch(/^carta-.*\.csv$/)
    await expect(
      page.getByText(/Archivo carta-.*\.csv descargado\./),
    ).toBeVisible()
  })

  test('el Empleado no ve el menú y recibe 403 por URL', async ({ page }) => {
    await iniciarSesion(page, cuentaEmpleadoCentro())

    await expect(
      page
        .getByRole('navigation')
        .getByRole('link', { name: 'Exportaciones' }),
    ).toHaveCount(0)

    await page.goto('/exports')
    await expect(
      page.getByRole('heading', { name: 'Acceso denegado' }),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/exports$/)
  })
})
