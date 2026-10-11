// Persistencia de la sesion.
//
// La sesion vive en memoria (el estado del proveedor de React) con un respaldo
// en `sessionStorage` para sobrevivir a una recarga. Se usa `sessionStorage` y
// NUNCA `localStorage`: el primero se borra al cerrar la pestana, lo que reduce
// la ventana de exposicion ante XSS. Aun asi, documentar que cualquier script
// inyectado podria leer el token mientras la pestana este abierta.
import type { UsuarioApi } from '@/types/api'

export interface Sesion {
  accessToken: string
  user: UsuarioApi
  /** Marca de tiempo (ms) en la que vence el token. */
  expiresAt: number
}

const CLAVE_ALMACENAMIENTO = 'cafeteria.sesion'

export interface CargaSesionInicial {
  sesion: Sesion | null
  /** `true` si habia una sesion guardada pero ya estaba vencida. */
  expirada: boolean
}

/** Construye una sesion a partir de la respuesta de login. */
export function crearSesion(
  accessToken: string,
  user: UsuarioApi,
  expiresInSegundos: number,
): Sesion {
  return {
    accessToken,
    user,
    expiresAt: Date.now() + expiresInSegundos * 1000,
  }
}

/**
 * Recupera la sesion guardada validando su vigencia. Descarta (y borra) la
 * sesion si esta vencida o mal formada, e informa si habia una vencida para
 * poder avisar en el login.
 */
export function cargarSesionInicial(
  ahora: number = Date.now(),
): CargaSesionInicial {
  const crudo = leerCrudo()
  if (crudo === null) {
    return { sesion: null, expirada: false }
  }

  const sesion = parsearSesion(crudo)
  if (sesion === null) {
    eliminarSesion()
    return { sesion: null, expirada: false }
  }

  if (sesion.expiresAt <= ahora) {
    eliminarSesion()
    return { sesion: null, expirada: true }
  }

  return { sesion, expirada: false }
}

export function guardarSesion(sesion: Sesion): void {
  try {
    sessionStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(sesion))
  } catch {
    // sessionStorage puede fallar (modo privado, cuota). La sesion sigue en
    // memoria; se pierde el respaldo ante recarga, que es aceptable.
  }
}

export function eliminarSesion(): void {
  try {
    sessionStorage.removeItem(CLAVE_ALMACENAMIENTO)
  } catch {
    // Sin respaldo que borrar.
  }
}

function leerCrudo(): string | null {
  try {
    return sessionStorage.getItem(CLAVE_ALMACENAMIENTO)
  } catch {
    return null
  }
}

function parsearSesion(crudo: string): Sesion | null {
  let valor: unknown
  try {
    valor = JSON.parse(crudo)
  } catch {
    return null
  }

  if (typeof valor !== 'object' || valor === null) {
    return null
  }

  const candidata = valor as Record<string, unknown>
  const user = candidata.user
  if (
    typeof candidata.accessToken !== 'string' ||
    typeof candidata.expiresAt !== 'number' ||
    typeof user !== 'object' ||
    user === null
  ) {
    return null
  }

  const usuario = user as Record<string, unknown>
  if (
    typeof usuario.id !== 'string' ||
    typeof usuario.nombre !== 'string' ||
    typeof usuario.email !== 'string' ||
    !Array.isArray(usuario.permisos)
  ) {
    return null
  }

  return {
    accessToken: candidata.accessToken,
    expiresAt: candidata.expiresAt,
    user: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: typeof usuario.rol === 'string' ? usuario.rol : null,
      sucursalId:
        typeof usuario.sucursalId === 'string' ? usuario.sucursalId : null,
      permisos: usuario.permisos.filter(
        (permiso): permiso is string => typeof permiso === 'string',
      ),
    },
  }
}
