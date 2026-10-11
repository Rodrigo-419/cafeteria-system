// Tipos del contrato de la API. Se declaran solo los campos que el frontend
// consume: la tipacion estructural de TypeScript tolera los campos extra que el
// backend pueda anadir, de modo que no hay que duplicar cada DTO.

/** Usuario autenticado tal como lo devuelven `POST /auth/login` y `GET /auth/me`. */
export interface UsuarioApi {
  id: string
  nombre: string
  email: string
  rol: string | null
  sucursalId: string | null
  /** Permisos efectivos (rol + concedidos - revocados). */
  permisos: string[]
}

/** Respuesta de `POST /api/auth/login`. */
export interface RespuestaLogin {
  accessToken: string
  tokenType: string
  /** Segundos de vigencia del token. */
  expiresIn: number
  user: UsuarioApi
}
