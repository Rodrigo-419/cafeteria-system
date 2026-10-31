// Flujo 6: el Admin crea una cuenta de verificación con contraseña generada
// (mostrada una sola vez, nunca registrada), ajusta y restablece un permiso, la
// bloquea y comprueba en otra sesión que ya no puede entrar.
import { expect, test } from '@playwright/test'
import { cuentaAdmin } from '../helpers/credenciales'
import { iniciarSesion } from '../helpers/sesion'

test.describe('usuarios y permisos', () => {
  test('alta, permisos, bloqueo y rechazo de acceso', async ({ page, browser }) => {
    // Sufijo único y versionable (nunca datos sensibles).
    const sufijo = Date.now().toString(36)
    const nombreUsuario = `verif-usuario-${sufijo}`
    const nombre = `Verificación ${sufijo}`

    await iniciarSesion(page, cuentaAdmin())
    await page.goto('/users')
    await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible()

    // Alta.
    await page.getByRole('button', { name: 'Crear usuario' }).click()
    const dialogoAlta = page.getByRole('dialog')
    await dialogoAlta.locator('#usuario-nombre').fill(nombre)
    await dialogoAlta.locator('#usuario-nombre-usuario').fill(nombreUsuario)
    await dialogoAlta.getByRole('button', { name: 'Generar contraseña' }).click()

    // La contraseña se guarda SOLO en memoria de la prueba; no se imprime.
    const claveGenerada = await dialogoAlta
      .locator('#usuario-password-generada')
      .inputValue()
    expect(claveGenerada.length).toBeGreaterThanOrEqual(12)

    await dialogoAlta.locator('#usuario-sucursal').click()
    await page.getByRole('option', { name: 'Sucursal Centro' }).click()
    await dialogoAlta.getByRole('button', { name: 'Crear usuario' }).click()
    await expect(page.getByText('Usuario creado')).toBeVisible()

    // Permisos: revocar y restablecer un permiso del rol.
    await page.locator('#usuario-busqueda').fill(nombreUsuario)
    const fila = page.getByRole('row').filter({ hasText: nombreUsuario }).first()
    await expect(fila).toBeVisible()
    await fila.getByRole('button', { name: 'Más acciones' }).click()
    await page.getByRole('menuitem', { name: 'Permisos' }).click()

    const dialogoPermisos = page.getByRole('dialog')
    await expect(
      dialogoPermisos.getByRole('heading', { name: new RegExp(`Permisos de`) }),
    ).toBeVisible()
    await dialogoPermisos.getByRole('button', { name: 'Revocar' }).first().click()
    await expect(page.getByText(/Permiso revocado/)).toBeVisible()
    await dialogoPermisos
      .getByRole('button', { name: 'Restablecer' })
      .first()
      .click()
    await expect(
      page.getByText('Permiso restablecido al valor del rol'),
    ).toBeVisible()
    await dialogoPermisos.getByRole('button', { name: 'Cerrar' }).first().click()

    // Bloqueo.
    await fila.getByRole('button', { name: 'Más acciones' }).click()
    await page.getByRole('menuitem', { name: 'Bloquear' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Bloquear' })
      .click()
    await expect(page.getByText('Usuario bloqueado')).toBeVisible()

    // Otra sesión: el usuario bloqueado ya no puede entrar.
    const origen = new URL(page.url()).origin
    const contexto = await browser.newContext()
    try {
      const paginaBloqueada = await contexto.newPage()
      await paginaBloqueada.goto(`${origen}/login`)
      await paginaBloqueada
        .getByLabel('Usuario', { exact: true })
        .fill(nombreUsuario)
      await paginaBloqueada
        .getByLabel('Contraseña', { exact: true })
        .fill(claveGenerada)
      await paginaBloqueada.getByRole('button', { name: 'Ingresar' }).click()
      await expect(
        paginaBloqueada.getByText(
          'Tu cuenta está bloqueada. Contacta al administrador.',
        ),
      ).toBeVisible()
    } finally {
      await contexto.close()
    }
  })
})
