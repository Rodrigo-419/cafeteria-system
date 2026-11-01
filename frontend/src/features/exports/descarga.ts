/**
 * Descarga un `Blob` en el navegador y libera la URL temporal al terminar.
 *
 * No se guarda el archivo ni la URL: el enlace vive solo durante el clic. El
 * `Blob` lo conserva el llamador hasta que termine de usarlo.
 */
export function descargarArchivo(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = nombreArchivo
    enlace.rel = 'noopener'
    enlace.hidden = true
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
