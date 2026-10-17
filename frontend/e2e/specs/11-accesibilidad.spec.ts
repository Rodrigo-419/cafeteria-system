// PARTE 2 — Auditoría de accesibilidad con axe-core (WCAG 2.1 A/AA).
//
// Recorre las pantallas principales con varios roles y ejecuta axe sobre el
// documento completo (incluido el menú lateral). Falla solo cuando hay
// violaciones `critical` o `serious`: esas son las que hay que corregir. Las de
// impacto `moderate`/`minor` se publican en el informe de la prueba sin romper
// la suite, para poder listarse en el reporte final.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import {
  cuentaAdmin,
  cuentaEmpleadoCentro,
  cuentaGerenteCentro,
  type CuentaVerificacion,
} from '../helpers/credenciales'
import { iniciarSesion } from '../helpers/sesion'

interface PantallaAuditable {
  ruta: string
  nombre: string
}

interface Hallazgo {
  pantalla: string
  regla: string
  impacto: string
  ayuda: string
  nodos: number
  html: string
}

const PANTALLAS_ADMIN: readonly PantallaAuditable[] = [
  { ruta: '/', nombre: 'Panel' },
  { ruta: '/sales', nombre: 'Ventas' },
  { ruta: '/inventory', nombre: 'Inventario' },
  { ruta: '/inventory/recuentos/nuevo', nombre: 'Recuento' },
  { ruta: '/alerts', nombre: 'Alertas' },
  { ruta: '/products', nombre: 'Productos' },
  { ruta: '/supplies', nombre: 'Insumos' },
  { ruta: '/branches', nombre: 'Sucursales' },
  { ruta: '/users', nombre: 'Usuarios' },
  { ruta: '/auditoria', nombre: 'Auditoría' },
  { ruta: '/reports', nombre: 'Reportes' },
  { ruta: '/employees', nombre: 'Empleados' },
  { ruta: '/attendance', nombre: 'Asistencia' },
  { ruta: '/equipment', nombre: 'Equipos' },
  { ruta: '/attendance/terminal', nombre: 'Terminal de marcación' },
]

const PANTALLAS_GERENTE: readonly PantallaAuditable[] = [
  { ruta: '/', nombre: 'Panel' },
  { ruta: '/sales', nombre: 'Ventas' },
  { ruta: '/users', nombre: 'Usuarios' },
  { ruta: '/auditoria', nombre: 'Auditoría' },
  { ruta: '/attendance/terminal', nombre: 'Terminal de marcación' },
]

const PANTALLAS_EMPLEADO: readonly PantallaAuditable[] = [
  { ruta: '/', nombre: 'Panel' },
  { ruta: '/branches', nombre: 'Sucursales' },
  { ruta: '/products', nombre: 'Productos' },
  { ruta: '/attendance', nombre: 'Asistencia' },
  { ruta: '/attendance/terminal', nombre: 'Terminal de marcación' },
]

async function auditarPantalla(
  page: Page,
  pantalla: PantallaAuditable,
): Promise<Hallazgo[]> {
  await page.goto(pantalla.ruta)
  await page.waitForLoadState('networkidle')
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return violations.map((violacion) => ({
    pantalla: pantalla.nombre,
    regla: violacion.id,
    impacto: violacion.impact ?? 'sin impacto',
    ayuda: violacion.help,
    nodos: violacion.nodes.length,
    html: (violacion.nodes[0]?.html ?? '').slice(0, 200),
  }))
}

async function auditarRol(
  page: Page,
  cuenta: CuentaVerificacion,
  pantallas: readonly PantallaAuditable[],
): Promise<Hallazgo[]> {
  await iniciarSesion(page, cuenta)
  const hallazgos: Hallazgo[] = []
  for (const pantalla of pantallas) {
    hallazgos.push(...(await auditarPantalla(page, pantalla)))
  }
  return hallazgos
}

function publicar(hallazgos: readonly Hallazgo[], testInfo: TestInfo): void {
  for (const hallazgo of hallazgos) {
    console.log(
      `A11Y ${hallazgo.impacto} | ${hallazgo.pantalla} | ${hallazgo.regla} | ${hallazgo.ayuda} | ${hallazgo.nodos} nodo(s)`,
    )
  }
  if (hallazgos.length > 0) {
    void testInfo.attach('hallazgos-accesibilidad', {
      body: JSON.stringify(hallazgos, null, 2),
      contentType: 'application/json',
    })
  }
}

function resumen(hallazgos: readonly Hallazgo[]): string {
  if (hallazgos.length === 0) return 'Sin violaciones graves.'
  return hallazgos
    .map(
      (h) =>
        `[${h.impacto}] ${h.pantalla} → ${h.regla}: ${h.ayuda} (${h.nodos} nodo(s))\n  ${h.html}`,
    )
    .join('\n')
}

function graves(hallazgos: readonly Hallazgo[]): Hallazgo[] {
  return hallazgos.filter(
    (h) => h.impacto === 'critical' || h.impacto === 'serious',
  )
}

test.describe('accesibilidad con axe-core', () => {
  test('Administrador: sin violaciones graves', async ({ page }, testInfo) => {
    const hallazgos = await auditarRol(page, cuentaAdmin(), PANTALLAS_ADMIN)
    publicar(hallazgos, testInfo)
    const fallos = graves(hallazgos)
    expect(fallos, resumen(fallos)).toEqual([])
  })

  test('Gerente: sin violaciones graves', async ({ page }, testInfo) => {
    const hallazgos = await auditarRol(page, cuentaGerenteCentro(), PANTALLAS_GERENTE)
    publicar(hallazgos, testInfo)
    const fallos = graves(hallazgos)
    expect(fallos, resumen(fallos)).toEqual([])
  })

  test('Empleado: sin violaciones graves', async ({ page }, testInfo) => {
    const hallazgos = await auditarRol(page, cuentaEmpleadoCentro(), PANTALLAS_EMPLEADO)
    publicar(hallazgos, testInfo)
    const fallos = graves(hallazgos)
    expect(fallos, resumen(fallos)).toEqual([])
  })
})
