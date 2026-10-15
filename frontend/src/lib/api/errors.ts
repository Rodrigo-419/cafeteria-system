// Error normalizado de la API.
//
// Nest devuelve `{ statusCode, message, error }`, donde `message` es una cadena
// o un arreglo de cadenas (cuando falla la validacion). Aqui se unifica en un
// unico tipo para que la interfaz no tenga que distinguir las dos formas.

export class ApiError extends Error {
  readonly status: number
  readonly mensajes: string[]
  readonly cuerpo?: unknown
  /**
   * Segundos sugeridos de espera (`Retry-After`), cuando el servidor los envía
   * (p. ej. el 429 de marcación). `undefined` si no vienen o no son un número.
   */
  readonly retryAfter?: number

  constructor(
    status: number,
    mensajes: string[],
    cuerpo?: unknown,
    retryAfter?: number,
  ) {
    super(mensajes[0] ?? `Error ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.mensajes = mensajes
    this.cuerpo = cuerpo
    this.retryAfter = retryAfter
  }
}

/** Traduce el cuerpo de error de Nest a un `ApiError`. */
export function parsearErrorApi(
  status: number,
  cuerpo: unknown,
  retryAfter?: number,
): ApiError {
  if (cuerpo && typeof cuerpo === 'object') {
    const mensaje = (cuerpo as { message?: unknown }).message
    if (Array.isArray(mensaje)) {
      return new ApiError(status, mensaje.map(String), cuerpo, retryAfter)
    }
    if (typeof mensaje === 'string' && mensaje.length > 0) {
      return new ApiError(status, [mensaje], cuerpo, retryAfter)
    }
  }
  return new ApiError(status, [`Error ${status}`], cuerpo, retryAfter)
}

/** `true` si el error es un 401 (sesion invalida o expirada). */
export function esErrorNoAutorizado(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}
