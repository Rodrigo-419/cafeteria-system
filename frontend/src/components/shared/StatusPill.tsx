import { cn } from 'cn'

const VARIANTES = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/15 text-warning-800 dark:text-warning-300',
  error: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
} as const

const PUNTOS = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-destructive',
  info: 'bg-info',
} as const

export type TonoStatusPill = keyof typeof VARIANTES

interface StatusPillProps {
  tono?: TonoStatusPill
  children: React.ReactNode
  className?: string
}

/** Etiqueta de estado en forma de píldora con punto de color. */
export function StatusPill({
  tono = 'neutral',
  children,
  className,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        VARIANTES[tono],
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', PUNTOS[tono])} />
      {children}
    </span>
  )
}
