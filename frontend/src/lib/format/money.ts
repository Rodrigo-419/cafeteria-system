// Formato de dinero.
//
// El backend envia los montos como cadenas decimales (por ejemplo "12.50").
// En el frontend NUNCA se opera con `number` en coma flotante para dinero:
// todo se convierte a centimos enteros, que se suman/restan sin errores de
// redondeo, y solo se formatea al mostrarlo.

/** Convierte un monto ("12.50", "12,50", 12.5) a centimos enteros. */
export function aCentimos(valor: string | number): number {
  const texto = typeof valor === 'number' ? valor.toFixed(2) : valor.trim()
  const coincidencia = /^(-)?(\d+)(?:[.,](\d{1,2}))?$/.exec(texto)
  if (coincidencia === null) {
    throw new Error(`Monto invalido: ${String(valor)}`)
  }

  const signo = coincidencia[1] === '-' ? -1 : 1
  const enteros = Number(coincidencia[2])
  const decimales = (coincidencia[3] ?? '').padEnd(2, '0')
  return signo * (enteros * 100 + Number(decimales))
}

/** Formatea centimos enteros como moneda peruana ("S/ 12.50"). */
export function formatearMoneda(centimos: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centimos / 100)
}
