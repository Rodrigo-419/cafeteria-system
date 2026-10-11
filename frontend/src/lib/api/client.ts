// Cliente HTTP minimo sobre `fetch`.
//
// El token y el manejador de 401 se inyectan desde fuera (el proveedor de
// sesion) para que este modulo no dependa de React: asi es reutilizable y
// testeable de forma aislada.
import { parsearErrorApi } from './errors'

/**
 * URL base de la API. Por defecto `'/api'`, que en desarrollo resuelve al
 * proxy de Vite hacia `http://localhost:3000` (ver `vite.config.ts`).
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api'

type TokenProvider = () => string | null
type UnauthorizedHandler = () => void

let obtenerToken: TokenProvider = () => null
let alNoAutorizado: UnauthorizedHandler | null = null

/** Registra de donde se lee el token vigente. Devuelve una funcion para limpiarlo. */
export function configurarToken(provider: TokenProvider): () => void {
  obtenerToken = provider
  return () => {
    obtenerToken = () => null
  }
}

/** Registra el manejador invocado ante un 401 en una peticion autenticada. */
export function configurarManejadorNoAutorizado(
  handler: UnauthorizedHandler | null,
): void {
  alNoAutorizado = handler
}

export interface OpcionesPeticion {
  method?: string
  body?: unknown
  /** Si es `false`, no se adjunta el token ni se dispara el manejador de 401. */
  auth?: boolean
  signal?: AbortSignal
}

export async function peticionApi<T>(
  path: string,
  opciones: OpcionesPeticion = {},
): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = opciones

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (auth) {
    const token = obtenerToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  const respuesta = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    signal,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (respuesta.status === 204) {
    return undefined as T
  }

  const texto = await respuesta.text()
  const datos = texto.length > 0 ? parsearCuerpo(texto) : undefined

  if (!respuesta.ok) {
    if (respuesta.status === 401 && auth) {
      alNoAutorizado?.()
    }
    throw parsearErrorApi(respuesta.status, datos)
  }

  return datos as T
}

function parsearCuerpo(texto: string): unknown {
  try {
    return JSON.parse(texto)
  } catch {
    return texto
  }
}
