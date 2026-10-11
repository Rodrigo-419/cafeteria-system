# Frontend — Sistema de Cafetería (Fase 2)
## Visión general
El frontend es independiente (sin workspaces), basado en Vite + React + TypeScript. Usa proxy de Vite `/api` hacia `http://localhost:3000` en desarrollo.
## Stack
- Vite 8.3.x + @vitejs/plugin-react 6.1.x
- React 19.3.0 / React Router DOM 7.18.4 / TanStack Query 5.104.1
- React Hook Form 7.89.0 + @hookform/resolvers 5.9.1 + Zod 4.6.5
- Tailwind CSS v4 + @tailwindcss/vite 4.3.3
- shadcn/ui (new-york, neutral); `cn@0.4.0` importado desde "cn"; `radix-ui@^1.7.0` (paquete unificado)
- Vitest 5.0.3 + jsdom + Testing Library + MSW 3.0.3
- ESLint 10.12.0 + typescript-eslint 8.71.1 + eslint-plugin-react-hooks + react-refresh + prettier
- TypeScript ~6.0.2
Nota: plantilla Vite 9.2.1 traía oxlint; se reemplazó por ESLint+Prettier (desviación documentada).
## Estructura
frontend/src: App, main, components/ui (6), features/auth, lib/{api,auth,format,permissions}, routes, test, types.
## Configuración
- Proxy: `/api` → `http://localhost:3000`. Base URL: `import.meta.env.VITE_API_BASE_URL ?? '/api'`. En tests: `http://localhost/api`.
- `.env.example`: `VITE_API_BASE_URL=/api`. Sin secretos.
## Scripts
`build`: `tsc -b && vite build`. `test`: `vitest run`. `lint`: `eslint .`. `format`: `prettier --write .`.
## Decisiones clave
- Zod solo para formularios y parseo crítico (login, /auth/me). Resto: tipos TS que toleran campos extra.
- Botón de envío deshabilitado mientras petición crítica en curso (sin idempotencia en backend; limitación documentada).
- Menú/guards derivados de `permisosEfectivos`, nunca del rol.
- Token en memoria + respaldo en `sessionStorage` (clave `cafeteria.sesion`); **nunca `localStorage`**. Riesgo XSS documentado.
- Cliente API a mano; Tailwind+shadcn en versiones soportadas hoy (documentadas); ESLint+Prettier; frontend independiente sin workspaces; PEN `es-PE` ("S/ 12.50"); fechas `America/Lima`; idioma español.
## Testing
MSW 3.0.3, helpers `renderConProveedores` + `iniciarSesionDePrueba`, 32 tests pasando (unit + componentes).
