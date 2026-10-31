// PARTE 2 — Comprobación en pantalla móvil (390 px, iPhone 12 mini).
//
// Verifica que las pantallas clave no produzcan desplazamiento horizontal de la
// página y que el menú lateral, oculto en móvil, se abra desde el botón de la
// cabecera y cierre al navegar.
import { expect, test, type Page } from '@playwright/test'
import {
  cuentaAdmin,
  cuentaEmpleadoCentro,
} from '../helpers/credenciales'
import { iniciarSesion } from '../helpers/sesion'

test.use({ viewport: { width: 390, height: 844 } })

/** Cuántos píxeles se desborda horizontalmente el documento (< 1 = sin scroll). */
async function desbordeHorizontal(page: Page): Promise<number> {
  return page.evaluate(() => {
    const documento = document.documentElement
    return documento.scrollWidth - documento.clientWidth
  })
}

async function sinDesplazamientoHorizontal(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
  const desborde = await desbordeHorizontal(page)
  expect(desborde, 'la página genera scroll horizontal en móvil').toBeLessThan(1)
}

test.describe('móvil a 390 px', () => {
  test('el panel no tiene desplazamiento horizontal', async ({ page }) => {
    await iniciarSesion(page, cuentaAdmin())
    await sinDesplazamientoHorizontal(page)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('la pantalla de ventas no desborda', async ({ page }) => {
    await iniciarSesion(page, cuentaAdmin())
    await page.goto('/sales')
    await sinDesplazamientoHorizontal(page)
    await page.getByRole('button', { name: /Filtros/ }).click()
    await expect(page.locator('#filtro-sucursal')).toBeVisible()
  })

  test('la terminal de marcación es usable', async ({ page }) => {
    await iniciarSesion(page, cuentaEmpleadoCentro())
    await page.goto('/attendance/terminal')
    await sinDesplazamientoHorizontal(page)
    await expect(page.getByLabel('Buscar colaborador')).toBeVisible()
    await page.locator('ul > li > button').first().click()
    await expect(page.getByLabel('PIN: 0 de 6 dígitos')).toBeVisible()
    await sinDesplazamientoHorizontal(page)
  })

  test('el menú lateral se colapsa y se abre con el botón', async ({ page }) => {
    await iniciarSesion(page, cuentaAdmin())

    // En móvil la barra lateral fija no está en el árbol de accesibilidad.
    await expect(page.getByRole('complementary')).toHaveCount(0)
    await sinDesplazamientoHorizontal(page)

    await page.getByRole('button', { name: 'Abrir menú' }).click()
    const menu = page.getByRole('dialog')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Ventas' })).toBeVisible()
    await sinDesplazamientoHorizontal(page)

    await menu.getByRole('link', { name: 'Ventas' }).click()
    await expect(page).toHaveURL(/\/sales$/)
    await expect(menu).toBeHidden()
    await expect(page.getByRole('complementary')).toHaveCount(0)
    await sinDesplazamientoHorizontal(page)
  })
})
