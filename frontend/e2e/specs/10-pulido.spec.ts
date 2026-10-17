// PARTE 2 — Pasada de pulido automática.
//
// Entra con cada rol, recorre TODAS las rutas que su menú expone y comprueba
// que el texto visible no filtra códigos técnicos, JSON crudo, valores
// indefinidos ni UUIDs, y que no hay errores de consola. Acumula todos los
// problemas y falla con la lista completa para poder corregirlos.
import { expect, test, type Page } from '@playwright/test'
import {
  cuentaAdmin,
  cuentaEmpleadoCentro,
  cuentaGerenteCentro,
  type CuentaVerificacion,
} from '../helpers/credenciales'
import { vigilarConsola, sinErrores } from '../helpers/consola'
import { iniciarSesion } from '../helpers/sesion'

// Códigos técnicos (permisos y enums) que nunca deben mostrarse.
const CODIGOS_TECNICOS: readonly string[] = [
  'ventas.ver',
  'ventas.registrar',
  'ventas.anular',
  'productos.ver',
  'productos.catalogo.editar',
  'productos.precio.editar',
  'insumos.ver',
  'insumos.catalogo.editar',
  'inventario.registrar',
  'inventario.minimo.editar',
  'inventario.recuento',
  'alertas.ver_resolver',
  'reportes.comparativos.ver',
  'usuarios.crear_editar',
  'permisos.asignar',
  'empleados.crear_editar',
  'turnos.editar',
  'asistencia.ver',
  'asistencia.marcar',
  'asistencia.corregir',
  'equipo.ver',
  'equipo.registrar_editar',
  'sucursales.ver',
  'sucursales.crear_editar',
  'usuario_bloqueado',
  'usuario_creado',
  'sucursal_creada',
  'categoria_producto',
  'insumo_sucursal',
  'producto_sucursal_variante',
]

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i

// Etiquetas en inglés que jamás deben aparecer en la interfaz.
const ETIQUETAS_EN_INGLES: readonly string[] = [
  'Loading',
  'Submit',
  'Save',
  'Delete',
  'Cancel',
  'Close',
  'Search',
  'Select',
  'Options',
  'Required',
  'No data',
]

function analizarTexto(texto: string): string[] {
  const problemas: string[] = []
  for (const codigo of CODIGOS_TECNICOS) {
    if (texto.includes(codigo)) {
      problemas.push(`expone el código técnico "${codigo}"`)
    }
  }
  for (const palabra of ETIQUETAS_EN_INGLES) {
    const patron = new RegExp(`\\b${palabra.replace(' ', '\\s+')}\\b`)
    if (patron.test(texto)) {
      problemas.push(`muestra la etiqueta en inglés "${palabra}"`)
    }
  }
  if (texto.includes('[object Object]')) problemas.push('muestra "[object Object]"')
  if (/\bundefined\b/.test(texto)) problemas.push('muestra "undefined"')
  if (/\bNaN\b/.test(texto)) problemas.push('muestra "NaN"')
  if (/\bnull\b/.test(texto)) problemas.push('muestra "null"')
  if (texto.includes('{"') || texto.includes('":')) problemas.push('muestra JSON crudo')
  if (UUID.test(texto)) problemas.push('muestra un UUID crudo')
  return problemas
}

async function rutasDelMenu(page: Page): Promise<string[]> {
  return page
    .getByRole('navigation')
    .getByRole('link')
    .evaluateAll((enlaces) =>
      enlaces
        .map((enlace) => enlace.getAttribute('href'))
        .filter((href): href is string => href !== null),
    )
}

async function recorrerRol(
  page: Page,
  cuenta: CuentaVerificacion,
  extras: readonly string[],
) {
  const recolector = vigilarConsola(page)
  await iniciarSesion(page, cuenta)
  const rutas = [...new Set([...((await rutasDelMenu(page))), ...extras])]
  const problemas: string[] = []

  for (const ruta of rutas) {
    await page.goto(ruta)
    await page.waitForLoadState('networkidle')
    const texto = await page.locator('body').innerText()
    for (const problema of analizarTexto(texto)) {
      problemas.push(`${cuenta.usuario} ${ruta}: ${problema}`)
    }
    if (await page.getByRole('heading', { name: 'Acceso denegado' }).count()) {
      problemas.push(`${cuenta.usuario} ${ruta}: acceso denegado inesperado`)
    }
  }

  const erroresConsola = sinErrores(recolector)
  if (erroresConsola !== null) {
    problemas.push(`${cuenta.usuario} errores de consola:\n${erroresConsola}`)
  }
  return problemas
}

test.describe('pulido de pantallas', () => {
  test('Admin recorre todas sus pantallas sin códigos técnicos', async ({ page }) => {
    const problemas = await recorrerRol(page, cuentaAdmin(), ['/attendance/terminal'])
    expect(problemas, problemas.join('\n')).toEqual([])
  })

  test('Gerente recorre todas sus pantallas sin códigos técnicos', async ({ page }) => {
    const problemas = await recorrerRol(page, cuentaGerenteCentro(), [
      '/attendance/terminal',
    ])
    expect(problemas, problemas.join('\n')).toEqual([])
  })

  test('Empleado recorre todas sus pantallas sin códigos técnicos', async ({ page }) => {
    const problemas = await recorrerRol(page, cuentaEmpleadoCentro(), [
      '/attendance/terminal',
    ])
    expect(problemas, problemas.join('\n')).toEqual([])
  })

  test('el diálogo de permisos no expone el UUID de la sucursal', async ({
    page,
  }) => {
    await iniciarSesion(page, cuentaAdmin())
    await page.goto('/users')
    await page.locator('#usuario-busqueda').fill('empleado.centro')
    const fila = page.getByRole('row').filter({ hasText: 'empleado.centro' }).first()
    await expect(fila).toBeVisible()
    await fila.getByRole('button', { name: 'Permisos' }).click()
    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toBeVisible()
    const texto = await dialogo.innerText()
    expect(analizarTexto(texto), texto).toEqual([])
  })

  test('el detalle de auditoría no expone identificadores ni códigos', async ({
    page,
  }) => {
    await iniciarSesion(page, cuentaAdmin())
    await page.goto('/auditoria')
    const botones = page.getByRole('button', { name: 'Ver detalle' })
    await expect(botones.first()).toBeVisible()
    const total = await botones.count()
    expect(total).toBeGreaterThan(0)
    for (let i = 0; i < Math.min(total, 12); i += 1) {
      await botones.nth(i).click()
      const dialogo = page.getByRole('dialog')
      await expect(dialogo).toBeVisible()
      const texto = await dialogo.innerText()
      expect(analizarTexto(texto), `detalle #${i}: ${texto}`).toEqual([])
      await dialogo.getByRole('button', { name: 'Cerrar' }).first().click()
      await expect(dialogo).toBeHidden()
    }
  })
})
