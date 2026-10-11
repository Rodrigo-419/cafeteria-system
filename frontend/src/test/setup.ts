import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './server'

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))

afterEach(() => {
  server.resetHandlers()
  sessionStorage.clear()
  localStorage.clear()
  window.history.pushState({}, '', '/')
})

afterAll(() => server.close())
