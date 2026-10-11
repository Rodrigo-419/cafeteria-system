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
