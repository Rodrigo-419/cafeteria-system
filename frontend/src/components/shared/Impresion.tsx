// Impresión reutilizable: cabecera de metadatos y botón "Imprimir".
//
// La cabecera es `print-show`: no ocupa nada en pantalla y solo aparece al
// imprimir. El botón dispara `window.print()` y desaparece en la impresión.
import { PrinterIcon, UserIcon, UsersIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatearFechaHora } from '@/lib/format/dates'

export interface DatosCabeceraImpresion {
  titulo: string
  /** Sucursal o "Todas las sucursales" (grupo). */
  sucursal?: string
  /** Empleado en modo individual. Se omite en el grupo. */
  empleado?: string
  /** Rango visible ("12 oct 2026 – 18 oct 2026"). */
  rango?: string
}

export function CabeceraImpresion({
  datos,
  ahora = new Date(),
}: {
  datos: DatosCabeceraImpresion
  ahora?: Date
}) {
  return (
    <div className="print-show hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b-2 border-neutral-900 pb-3">
        <div>
          <p className="text-xs uppercase tracking-wide">
            Cafetería — Sistema de gestión
          </p>
          <h1 className="text-xl font-bold">{datos.titulo}</h1>
        </div>
        <div className="text-right text-xs">
          <p>
            <span className="font-semibold">Sucursal:</span>{' '}
            {datos.sucursal ?? '—'}
          </p>
          {datos.empleado && (
            <p>
              <span className="font-semibold">Empleado:</span> {datos.empleado}
            </p>
          )}
          {datos.rango && (
            <p>
              <span className="font-semibold">Semana:</span> {datos.rango}
            </p>
          )}
          <p>
            <span className="font-semibold">Generado:</span>{' '}
            {formatearFechaHora(ahora)}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Botón "Imprimir" que dispara la impresión del navegador. */
export function BotonImprimir() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="no-print"
      onClick={() => window.print()}
    >
      <PrinterIcon className="size-4" />
      Imprimir
    </Button>
  )
}

/** Modo de impresión de un horario: grupo (toda la sucursal) o individual. */
export type ModoImpresion = 'grupo' | 'individual'

/**
 * Menú de impresión con los dos modos. El consumidor fija el modo y dispara la
 * impresión (normalmente en un `useEffect` para que el DOM ya refleje el modo).
 */
export function MenuImprimir({
  onImprimir,
}: {
  onImprimir: (modo: ModoImpresion) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="no-print">
          <PrinterIcon className="size-4" />
          Imprimir
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onImprimir('grupo')}>
          <UsersIcon className="size-4" />
          Grupo (sucursal)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onImprimir('individual')}>
          <UserIcon className="size-4" />
          Individual (empleado)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
