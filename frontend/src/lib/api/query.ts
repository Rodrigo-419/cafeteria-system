// Utilidad para construir cadenas de consulta de los endpoints GET.
//
// Se omiten los valores `undefined`, `null` y el texto vacío para no enviar
// filtros sin contenido; los booleanos se serializan como "true"/"false". El
// parámetro se acepta como `object` para poder pasar interfaces con nombre
// (una interfaz no es asignable a `Record<string, unknown>` sin índice).
export function construirQueryString(filtros: object): string {
  const params = new URLSearchParams()
  const entradas = Object.entries(filtros) as [string, unknown][]
  for (const [clave, valor] of entradas) {
    if (valor !== undefined && valor !== null && valor !== '') {
      params.set(clave, String(valor))
    }
  }
  const cadena = params.toString()
  return cadena.length > 0 ? `?${cadena}` : ''
}
