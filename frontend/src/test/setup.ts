import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import {
  reiniciarAuditoriaPrueba,
  reiniciarCatalogoPrueba,
  reiniciarEquiposPrueba,
  reiniciarInventarioPrueba,
  reiniciarUsuariosPrueba,
} from './handlers'
import { server } from './server'

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

// jsdom no implementa la captura de puntero que Radix Select usa para cerrar
// el menú al hacer clic fuera; sin estos stubs el menú no llega a abrirse.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))

afterEach(() => {
  server.resetHandlers()
  reiniciarCatalogoPrueba()
  reiniciarInventarioPrueba()
  reiniciarEquiposPrueba()
  reiniciarUsuariosPrueba()
  reiniciarAuditoriaPrueba()
  sessionStorage.clear()
  localStorage.clear()
  window.history.pushState({}, '', '/')
})

afterAll(() => server.close())
