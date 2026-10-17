// Configuración de Playwright para las pruebas de extremo a extremo (E2E).
//
// Estas pruebas corren contra la aplicación REAL en desarrollo: el frontend en
// http://localhost:5173 y el backend en http://localhost:3000 (a través del
// proxy `/api` de Vite). No se levantan servidores automáticamente: hay que
// tener ambos corriendo. Las contraseñas NUNCA viven aquí; se leen de las
// variables de entorno VERIF_ADMIN_PASSWORD y VERIF_DEMO_PASSWORD.
//
// No se ejecuta en CI todavía (el flujo de trabajo no las invoca).
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Un solo trabajador: las pruebas comparten la misma base de datos real y
  // crean/consumen datos, así que se ejecutan en serie para ser deterministas.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
})
