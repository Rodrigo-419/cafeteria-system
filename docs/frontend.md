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
## Sistema de diseño — tema "Artisan Ops" (E2)
- **Paleta.** Escalas 50–900 derivadas de las bases Primary `#A76D3A`, Secondary `#5C4033`, Tertiary `#785338`, Neutral `#2B1E16`, más semánticas Success `#2E7D32`, Warning `#B45309`, Error `#C62828`, Info `#2563EB`. Todas definidas como tokens en `src/index.css` y expuestas en `@theme inline` (`--color-<escala>-<paso>`). Ningún color crudo en `.ts/.tsx` fuera de `components/ui`.
- **Semántica (tema claro).** Fondo = `primary-100` (canvas cálido), tarjeta/popover = `primary-50`, texto = `neutral-900`, primario de acción = `primary-600`, bordes = `primary-200`, anillo = `primary-500`. **Tema oscuro:** fondo `neutral-900`, tarjeta `neutral-800`, primario `primary-400` con texto `neutral-900`, texto `neutral-50`.
- **Tipografía.** Plus Jakarta Sans self-hosted vía `@fontsource-variable/plus-jakarta-sans` (import en `index.css`, sin CDN); `--font-sans` en `@theme`. Título `font-bold`, cuerpo `font-normal`, etiqueta `text-xs font-medium uppercase tracking-wide`.
- **Botones** (`ui/button.tsx`): `default` (café `primary-600` + texto blanco), `secondary` (crema `primary-50` + texto `primary-800`), `inverted` (`neutral-900` + texto claro), `outline` (borde `outline-border`, fondo transparente, texto `outline-foreground`), `destructive` (rojo `error-600`), `ghost` y `link`. Radios generosos (`rounded-lg`). Campo de búsqueda: `input` con fondo `bg-card`, borde `border-input` y `rounded-lg`.
- **Navegación.** Nav activo con círculo primario (`size-2 rounded-full bg-primary`) + `bg-primary/10 text-primary`; inactivo con punto `bg-muted-foreground/40`.
- **Contraste AA (verificado por cálculo real, no a ojo).** Prueba `src/theme-contrast.test.ts` recalcula ratios WCAG y falla si un token se degrada. Pares clave (claro): primario 5.94, secundario 11.10, texto/fondo 13.35, texto/tarjeta 15.27, destructivo 5.62, enlace 7.85, badges success/warning/error/info 9.65/13.87/9.99/9.75. (oscuro): primario 5.40, secundario 7.12, texto/tarjeta 10.44, destructivo 5.10, enlace 5.35. **Regla:** `#A76D3A` con texto blanco queda por debajo de 4.5:1 (≈4.0) → se reserva para acentos y elementos grandes (AA-large ≥3:1); los botones con texto blanco usan `primary-600`. Estados deshabilitados ≥3:1 (exentos de 1.4.3; suelo interno documentado en la prueba).
- **Componentes shadcn:** button, card, input, label, checkbox, select, textarea, table, tabs, badge (con variantes `success`/`warning`/`info` soft), skeleton, dialog, alert-dialog, dropdown-menu, sheet, sonner.
- **Composición en `components/shared`:** `PageHeader`, `MoneyText`, `DataTable` (carga/vacío/error/paginación), `FormField`, `ConfirmDialog`, `EmptyState`, `ErrorState`.
- **Layout:** `components/layout/AppLayout` (sidebar filtrado por permisos, toggle móvil con `Sheet`, menú de cuenta) y `TerminalLayout`. Catálogo de tokens/componentes en `/design-system` (solo `import.meta.env.DEV`): escalas, tipografía, botones, búsqueda, nav, badges, toasts, formularios, tablas y diálogos. `<Toaster />` montado en `App.tsx`.
- **Reglas de estilo forzadas por ESLint local** (`tools/eslint-rules`): `@local/no-inline-style` (error) prohíbe `style={{}}`; `@local/no-hardcoded-color` (warn) prohíbe hex/rgb. Pruebas de reglas en `src/design-rules.test.ts` (una sola hoja CSS, sin estilos inline, sin colores crudos).
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
MSW 3.0.3, helpers `renderConProveedores` + `iniciarSesionDePrueba`, **86 tests pasando** (14 archivos: api, sesión, formatos, permisos, guards, menú por rol, DataTable, ConfirmDialog, reglas de diseño, contraste AA del tema). `src/test/setup.ts` incluye un polyfill de `window.matchMedia` para jsdom (requerido por `sonner`).
