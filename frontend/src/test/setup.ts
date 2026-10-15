import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import {
  reiniciarAsistenciaPrueba,
  reiniciarAuditoriaPrueba,
  reiniciarCatalogoPrueba,
  reiniciarEmpleadosPrueba,
  reiniciarEquiposPrueba,
  reiniciarInventarioPrueba,
  reiniciarTurnosPrueba,
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
  reiniciarAsistenciaPrueba()
  reiniciarCatalogoPrueba()
  reiniciarInventarioPrueba()
  reiniciarEquiposPrueba()
  reiniciarEmpleadosPrueba()
  reiniciarTurnosPrueba()
  reiniciarUsuariosPrueba()
  reiniciarAuditoriaPrueba()
  sessionStorage.clear()
  localStorage.clear()
  window.history.pushState({}, '', '/')
})

afterAll(() => server.close())
