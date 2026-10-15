import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // En desarrollo el frontend habla con el backend a traves del proxy:
    // asi no depende de CORS ni de una URL absoluta en el navegador.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // Cada archivo de pruebas levanta su propio entorno jsdom con MSW y
    // navegacion (React Router + React Query). En paralelo, el CI dispone de
    // menos nucleos que una maquina local y esas suites tardan mas de los 5 s
    // por defecto, produciendo falsos positivos ("Test timed out"). No se toca
    // para relentizar pruebas: es el suelo para que la carga no decida. Ver
    // docs/estrategia-de-pruebas.md.
    testTimeout: 15000,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // En pruebas el cliente debe usar una URL absoluta: fetch de Node/undici
    // no acepta rutas relativas y MSW necesita un origen concreto para casar
    // los handlers.
    env: {
      VITE_API_BASE_URL: 'http://localhost/api',
    },
  },
})
