// Llamadas de autenticacion contra el backend.
import { peticionApi } from './client'
import type { RespuestaLogin, UsuarioApi } from '@/types/api'

/** `POST /api/auth/login`. No adjunta token (es la peticion que lo obtiene). */
export function iniciarSesion(
  nombreUsuario: string,
  password: string,
): Promise<RespuestaLogin> {
  return peticionApi<RespuestaLogin>('/auth/login', {
    method: 'POST',
    body: { nombreUsuario, password },
    auth: false,
  })
}

/** `GET /api/auth/me`: refresca los permisos efectivos del token vigente. */
export function obtenerPerfil(signal?: AbortSignal): Promise<UsuarioApi> {
  return peticionApi<UsuarioApi>('/auth/me', { signal })
}
