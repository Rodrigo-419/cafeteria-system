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

export interface RespuestaArchivo {
  blob: Blob
  /** Nombre indicado por `Content-Disposition`, ya saneado; `null` si falta. */
  nombreArchivo: string | null
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
    throw parsearErrorApi(
      respuesta.status,
      datos,
      leerRetryAfter(respuesta.headers.get('Retry-After')),
    )
  }

  return datos as T
}

/**
 * Peticion autenticada que devuelve un archivo binario.
 *
 * No guarda nada: usa `cache: 'no-store'` y entrega el `Blob` al llamador para
 * que lo descargue y lo libere. Un 401 dispara el mismo manejador de sesion que
 * el resto de peticiones. El nombre del archivo se toma de `Content-Disposition`
 * y se sanea antes de exponerlo.
 */
export async function peticionArchivo(
  path: string,
  opciones: OpcionesPeticion = {},
): Promise<RespuestaArchivo> {
  const { method = 'GET', body, auth = true, signal } = opciones

  // Se acepta el binario y, si algo falla, el JSON de error del backend.
  const headers: Record<string, string> = {
    Accept: 'application/octet-stream, application/json',
  }
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
    cache: 'no-store',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!respuesta.ok) {
    const texto = await respuesta.text()
    const datos = texto.length > 0 ? parsearCuerpo(texto) : undefined

    if (respuesta.status === 401 && auth) {
      alNoAutorizado?.()
    }

    throw parsearErrorApi(
      respuesta.status,
      datos,
      leerRetryAfter(respuesta.headers.get('Retry-After')),
    )
  }

  return {
    blob: await respuesta.blob(),
    nombreArchivo: nombreDesdeContentDisposition(
      respuesta.headers.get('Content-Disposition'),
    ),
  }
}

/**
 * Nombre de archivo seguro a partir de `Content-Disposition`.
 *
 * Admite `filename="..."`, `filename=...` y la forma extendida
 * `filename*=UTF-8''...`. Elimina rutas, caracteres de control y reservados de
 * Windows, y limita el tamaño. Devuelve `null` si no hay un nombre utilizable.
 */
export function nombreDesdeContentDisposition(
  valor: string | null,
): string | null {
  if (!valor) return null

  const extendido = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(valor)
  if (extendido?.[1]) {
    let texto = extendido[1].trim().replace(/^"|"$/g, '')
    try {
      texto = decodeURIComponent(texto)
    } catch {
      // Si la codificacion es invalida, se conserva el texto tal cual y el
      // saneado posterior se encarga de dejarlo seguro.
    }
    return sanearNombreArchivo(texto)
  }

  const simple = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(valor)
  if (!simple) return null
  return sanearNombreArchivo((simple[1] ?? simple[2] ?? '').trim())
}

/** Deja un nombre de archivo sin rutas ni caracteres problematicos. */
export function sanearNombreArchivo(valor: string | null): string | null {
  if (!valor) return null

  const sinRuta = valor.replace(/^.*[\\/]/, '')
  const sinControles = Array.from(sinRuta)
    .filter((caracter) => {
      const codigo = caracter.charCodeAt(0)
      return codigo >= 32 && codigo !== 127
    })
    .join('')
  const sinReservados = sinControles.replace(/[<>:"|?*\\/]/g, '-')
  const compacto = sinReservados.replace(/\s+/g, ' ').trim()
  const sinPuntosIniciales = compacto.replace(/^\.+/, '')

  if (sinPuntosIniciales === '') return null

  const partes = /^(.*?)(\.[A-Za-z0-9]{1,8})?$/.exec(sinPuntosIniciales)
  const base = (partes?.[1] ?? sinPuntosIniciales).replace(/[. ]+$/, '')
  const extension = partes?.[2] ?? ''
  const baseFinal = base === '' ? 'exportacion' : base.slice(0, 100)

  const nombre = `${baseFinal}${extension}`
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(nombre)) {
    return `archivo-${nombre}`
  }
  return nombre
}

/** Lee `Retry-After` como segundos; `undefined` si falta o no es un número. */
function leerRetryAfter(valor: string | null): number | undefined {
  if (valor === null) return undefined
  const segundos = Number(valor)
  return Number.isFinite(segundos) && segundos >= 0 ? segundos : undefined
}

function parsearCuerpo(texto: string): unknown {
  try {
    return JSON.parse(texto)
  } catch {
    return texto
  }
}
