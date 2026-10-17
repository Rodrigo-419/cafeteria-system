// Flujo 7: la bitácora de auditoría muestra etiquetas en español, sin códigos
// técnicos ni JSON crudo, y el Gerente solo ve su alcance.
import { expect, test, type Page } from '@playwright/test'
import { cuentaAdmin, cuentaGerenteCentro } from '../helpers/credenciales'
import { iniciarSesion } from '../helpers/sesion'

// Códigos técnicos que NUNCA deben verse en la interfaz.
const CODIGOS_TECNICOS: readonly string[] = [
  'ventas.ver',
  'ventas.registrar',
  'ventas.anular',
  'usuarios.crear_editar',
  'permisos.asignar',
  'reportes.comparativos.ver',
  'asistencia.marcar',
  'inventario.registrar',
  'alertas.ver_resolver',
  'usuario_bloqueado',
  'usuario_creado',
  'activo_',
  '[object Object]',
  'undefined',
  'NaN',
]

async function sinRuidoTecnico(page: Page, ambito: string) {
  const texto = await page.locator(ambito).innerText()
  for (const codigo of CODIGOS_TECNICOS) {
    expect(texto, `no debe contener "${codigo}"`).not.toContain(codigo)
  }
  expect(texto, 'sin JSON crudo').not.toContain('":')
}

test.describe('auditoría', () => {
  test('el Admin ve eventos con etiquetas y sin códigos técnicos', async ({
    page,
  }) => {
    await iniciarSesion(page, cuentaAdmin())
    await page.goto('/auditoria')
    await expect(
      page.getByRole('heading', { name: 'Bitácora de auditoría' }),
    ).toBeVisible()

    for (const columna of ['Fecha', 'Quién', 'Acción', 'Entidad', 'Detalle']) {
      await expect(
        page.getByRole('columnheader', { name: columna }),
      ).toBeVisible()
    }

    await expect(
      page.getByRole('button', { name: 'Ver detalle' }).first(),
    ).toBeVisible()
    await sinRuidoTecnico(page, 'body')

    await page.getByRole('button', { name: 'Ver detalle' }).first().click()
    const detalle = page.getByRole('dialog')
    await expect(detalle).toBeVisible()
    await expect(detalle.getByRole('button', { name: 'Cerrar' }).first()).toBeVisible()
    await sinRuidoTecnico(page, '[role="dialog"]')
  })

  test('el Gerente solo ve eventos de su alcance', async ({ page }) => {
    await iniciarSesion(page, cuentaGerenteCentro())
    await page.goto('/auditoria')
    await expect(
      page.getByRole('heading', { name: 'Bitácora de auditoría' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Ver detalle' }).first(),
    ).toBeVisible()
    // Su ámbito es la Sucursal Centro: no debería listar la Sucursal Norte.
    await expect(page.getByText('Sucursal Norte')).toHaveCount(0)
    await sinRuidoTecnico(page, 'body')
  })
})
