// Flujo 2: alternar cuenta (cerrando sesión desde una ruta protegida) no deja
// datos del usuario anterior, aterriza siempre en el panel y nunca aparece la
// pantalla de acceso denegado ni el aviso de demasiados intentos.
import { expect, test } from '@playwright/test'
import { cuentaAdmin, cuentaEmpleadoCentro } from '../helpers/credenciales'
import { cerrarSesion, iniciarSesion } from '../helpers/sesion'

test.describe('cambio de cuenta', () => {
  test('diez cambios seguidos aterrizan en el panel sin datos cruzados', async ({
    page,
  }) => {
    for (let i = 0; i < 10; i += 1) {
      if (i % 2 === 0) {
        await iniciarSesion(page, cuentaAdmin())
        await expect(page.locator('button[aria-haspopup="menu"]')).toContainText(
          'Administrador',
        )
        // Se cierra sesión desde una ruta sensible para probar la limpieza.
        await page.goto('/auditoria')
        await expect(
          page.getByRole('heading', { name: 'Bitácora de auditoría' }),
        ).toBeVisible()
        await cerrarSesion(page)
      } else {
        await iniciarSesion(page, cuentaEmpleadoCentro())
        // Aterriza en el panel, no en la ruta anterior ni en "acceso denegado".
        await expect(page).toHaveURL('/')
        await expect(
          page.getByRole('heading', { name: 'Panel de control' }),
        ).toBeVisible()
        await expect(page.getByText('Acceso denegado')).toHaveCount(0)
        // Sin restos del usuario anterior en la cabecera.
        await expect(page.locator('button[aria-haspopup="menu"]')).not.toContainText(
          'Administrador',
        )
        await expect(page.locator('button[aria-haspopup="menu"]')).toContainText(
          'Empleado Centro',
        )
        // Sin menús técnicos que no le corresponden.
        await expect(
          page
            .getByRole('navigation', { name: 'Navegación principal' })
            .getByRole('link', { name: 'Auditoría' }),
        ).toHaveCount(0)
        await cerrarSesion(page)
      }
    }

    await expect(page.getByText(/Demasiados intentos/i)).toHaveCount(0)
  })
})
