import { describe, expect, it } from 'vitest'

/**
 * Reglas del sistema de diseño. Se apoyan en `import.meta.glob` de Vite para
 * leer los archivos fuente en tiempo de compilacion (sin depender de Node).
 * Complementan a las reglas ESLint `@local/no-inline-style` y
 * `@local/no-hardcoded-color`.
 */
const hojasCss = import.meta.glob('./**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const fuentes = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const esTest = (ruta: string) =>
  ruta.includes('.test.') || ruta.includes('.spec.')
const normalizar = (ruta: string) => ruta.replace(/^\.\//, '')

describe('Sistema de diseño: reglas', () => {
  it('solo existe una hoja de estilos global (index.css)', () => {
    const css = Object.keys(hojasCss).map(normalizar)
    expect(css).toEqual(['index.css'])
  })

  it('no hay estilos inline style={{}} en el codigo de la app', () => {
    const infractores = Object.entries(fuentes)
      .filter(([ruta]) => !esTest(ruta))
      .filter(([, contenido]) => /style=\{\{/.test(contenido))
      .map(([ruta]) => normalizar(ruta))
    expect(infractores).toEqual([])
  })

  it('las páginas usan tokens del tema (sin colores hex/rgb crudos)', () => {
    const infractores = Object.entries(fuentes)
      .filter(([ruta]) => !esTest(ruta) && !ruta.includes('components/ui/'))
      .filter(
        ([, contenido]) =>
          /#[0-9a-fA-F]{3,8}\b/.test(contenido) || /rgba?\(/.test(contenido),
      )
      .map(([ruta]) => normalizar(ruta))
    expect(infractores).toEqual([])
  })
})
