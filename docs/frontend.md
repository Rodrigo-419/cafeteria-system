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
frontend/src: App, main; components/{ui,shared,layout,design}; features/{auth,system}; lib/{api,auth,format,permissions,navigation}; routes; test; types; tools/eslint-rules (reglas locales del sistema de diseño).
## Configuración
- Proxy: `/api` → `http://localhost:3000`. Base URL: `import.meta.env.VITE_API_BASE_URL ?? '/api'`. En tests: `http://localhost/api`.
- `.env.example`: `VITE_API_BASE_URL=/api`. Sin secretos.
## Sistema de diseño (E2)
- Tokens en `src/index.css` (`:root` y `.dark`), en OKLCH y con contraste orientado a WCAG AA. Semánticos: `success`, `warning`, `info`, `destructive` (+ foregrounds). `@theme inline` expone `--color-*`.
- Componentes shadcn: button, card, input, label, checkbox, select, textarea, table, tabs, badge, skeleton, dialog, alert-dialog, dropdown-menu, sheet, sonner.
- Componentes de composición en `components/shared`: `PageHeader`, `MoneyText`, `DataTable` (carga/vacío/error/paginación), `FormField`, `ConfirmDialog`, `EmptyState`, `ErrorState`.
- Layout: `components/layout/AppLayout` (sidebar filtrado por permisos, toggle móvil con `Sheet`, menú de cuenta) y `TerminalLayout`. Catálogo de componentes en `/design-system` (solo `import.meta.env.DEV`).
- Reglas de estilo forzadas por ESLint local (`tools/eslint-rules`): `@local/no-inline-style` (error) prohíbe `style={{}}`; `@local/no-hardcoded-color` (warn) prohíbe hex/rgb. Pruebas de reglas en `src/design-rules.test.ts` (una sola hoja CSS, sin estilos inline, sin colores crudos).
## Navegación y permisos
- `lib/navigation/menu.ts` define `MENU_ITEMS` con los 24 códigos de permiso reales; `filtrarMenu(permisos)` deriva el menú de los permisos efectivos.
- `lib/permissions/RequirePermission` es el guard por permiso (`modo: 'all' | 'any'`), redirige a `/login` sin sesión y muestra 403 sin permiso.
## Scripts
`build`: `tsc -b && vite build`. `test`: `vitest run`. `lint`: `eslint .`. `format`: `prettier --write .`.
## Decisiones clave
- Zod solo para formularios y parseo crítico (login, /auth/me). Resto: tipos TS que toleran campos extra.
- Botón de envío deshabilitado mientras petición crítica en curso (sin idempotencia en backend; limitación documentada).
- Menú/guards derivados de `permisosEfectivos`, nunca del rol.
- Token en memoria + respaldo en `sessionStorage` (clave `cafeteria.sesion`); **nunca `localStorage`**. Riesgo XSS documentado.
- Cliente API a mano; Tailwind+shadcn en versiones soportadas hoy (documentadas); ESLint+Prettier; frontend independiente sin workspaces; PEN `es-PE` ("S/ 12.50"); fechas `America/Lima`; idioma español.
## Testing
MSW 3.0.3, helpers `renderConProveedores` + `iniciarSesionDePrueba`, **55 tests pasando** (13 archivos: api, sesión, formatos, permisos, guards, menú por rol, DataTable, ConfirmDialog, reglas de diseño).
