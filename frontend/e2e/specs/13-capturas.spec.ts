// PARTE 3 — Capturas de pantalla para el portafolio.
//
// Genera PNG en 1440×900 (tema claro, datos `verif-`) en `docs/capturas/`.
// Nunca captura contraseñas ni PIN: los formularios se toman vacíos y los
// códigos de acceso se escriben fuera de la captura.
import { expect, test, type Page } from '@playwright/test'
import { mkdir, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cuentaAdmin,
  cuentaEmpleadoCentro,
  cuentaGerenteCentro,
} from '../helpers/credenciales'
import { iniciarSesion } from '../helpers/sesion'

const CARPETA_CAPTURAS = fileURLToPath(
  new URL('../../../docs/capturas/', import.meta.url),
)

async function capturar(page: Page, nombre: string): Promise<void> {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  await page.screenshot({
    path: join(CARPETA_CAPTURAS, `${nombre}.png`),
    animations: 'disabled',
  })
}

async function abrirDialogoDetalle(page: Page): Promise<void> {
  const botones = page.getByRole('button', { name: 'Ver detalle' })
  await expect(botones.first()).toBeVisible()
  await botones.first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.waitForTimeout(300)
}

test.beforeAll(async () => {
  await mkdir(CARPETA_CAPTURAS, { recursive: true })
})

test.describe('capturas del portafolio', () => {
  test('pantalla de acceso', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('Usuario', { exact: true })).toBeVisible()
    await capturar(page, '01-login')
  })

  test('pantallas del administrador', async ({ page }) => {
    await iniciarSesion(page, cuentaAdmin())
    await capturar(page, '02-dashboard-admin')

    await page.goto('/sales')
    await capturar(page, '03-ventas')

    await page.goto('/inventory')
    await capturar(page, '04-inventario')

    await page.goto('/alerts')
    await capturar(page, '05-alertas')

    await page.goto('/inventory/recuentos/nuevo')
    await capturar(page, '06-recuento-nuevo')

    await page.goto('/products')
    await capturar(page, '07-productos')

    await page.goto('/supplies')
    await capturar(page, '08-insumos')

    await page.goto('/branches')
    await capturar(page, '09-sucursales')

    await page.goto('/users')
    await capturar(page, '10-usuarios')

    await page.locator('#usuario-busqueda').fill('empleado.centro')
    const fila = page
      .getByRole('row')
      .filter({ hasText: 'empleado.centro' })
      .first()
    await expect(fila).toBeVisible()
    await fila.getByRole('button', { name: 'Permisos' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.waitForTimeout(300)
    await capturar(page, '11-permisos-usuario')

    await page.goto('/auditoria')
    await capturar(page, '12-auditoria')
    await abrirDialogoDetalle(page)
    await capturar(page, '13-auditoria-detalle')
    await page.keyboard.press('Escape')

    await page.goto('/reports')
    await page.getByRole('button', { name: '7 días' }).click()
    await page.getByRole('button', { name: 'Generar reporte' }).click()
    await expect(
      page.getByRole('heading', { name: 'Comparativo del periodo' }),
    ).toBeVisible()
    await capturar(page, '14-reporte-comparativo')

    await page.goto('/employees')
    await capturar(page, '15-empleados')

    await page.goto('/attendance')
    await capturar(page, '16-asistencia')
  })

  test('pantallas del gerente', async ({ page }) => {
    await iniciarSesion(page, cuentaGerenteCentro())
    await capturar(page, '17-dashboard-gerente')
  })

  test('pantallas del empleado y la terminal de marcación', async ({ page }) => {
    await iniciarSesion(page, cuentaEmpleadoCentro())
    await capturar(page, '18-dashboard-empleado')

    await page.goto('/attendance/terminal')
    await capturar(page, '19-terminal-marcacion')
  })

  test('vista móvil', async ({ page }) => {
    await iniciarSesion(page, cuentaAdmin())
    await page.setViewportSize({ width: 390, height: 844 })
    await capturar(page, '20-movil-panel')

    await page.getByRole('button', { name: 'Abrir menú' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.waitForTimeout(300)
    await capturar(page, '21-movil-menu')
  })

  test('informe de peso de las capturas', async () => {
    const archivos = (await readdir(CARPETA_CAPTURAS)).filter((archivo) =>
      archivo.endsWith('.png'),
    )
    expect(archivos.length).toBeGreaterThanOrEqual(20)

    const detalles = await Promise.all(
      archivos.map(async (archivo) => ({
        archivo,
        bytes: (await stat(join(CARPETA_CAPTURAS, archivo))).size,
      })),
    )
    detalles.sort((a, b) => a.archivo.localeCompare(b.archivo))

    let total = 0
    for (const detalle of detalles) {
      total += detalle.bytes
      const kb = Math.round(detalle.bytes / 102.4) / 10
      console.log(`CAPTURA ${detalle.archivo}: ${kb} KB`)
    }
    console.log(`CAPTURA TOTAL: ${archivos.length} archivos, ${Math.round(total / 102.4) / 10} KB`)
    expect(total).toBeGreaterThan(0)
  })
})
