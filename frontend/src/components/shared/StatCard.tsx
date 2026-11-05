import type { LucideIcon } from 'lucide-react'
import { cn } from 'cn'

interface StatCardProps {
  title: string
  value: React.ReactNode
  icon?: LucideIcon
  hint?: string
  footer?: React.ReactNode
  /** `warning` resalta la métrica con el color de error. */
  tone?: 'default' | 'warning'
  /** Reduce padding y tamaño de texto en pantallas pequeñas. */
  compacto?: boolean
  className?: string
}

/**
 * Tarjeta de métrica (KPI): título, valor destacado y una pista opcional.
 * Se compone solo con tokens del tema, sin colores sueltos.
 */
export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  footer,
  tone = 'default',
  compacto = false,
  className,
}: StatCardProps) {
  const destacado = tone === 'warning'

  return (
    <div
      className={cn(
        'flex flex-col justify-between rounded-xl border bg-card text-card-foreground shadow-sm',
        compacto ? 'gap-1.5 p-3 sm:gap-4 sm:p-6' : 'gap-4 p-6',
        className,
      )}
    >
      <div className={cn('flex items-start justify-between gap-3', compacto && 'gap-1.5 sm:gap-3')}>
        <span
          className={cn(
            'text-xs font-medium tracking-wide uppercase',
            destacado ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {title}
        </span>
        {Icon && (
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-lg',
              compacto ? 'size-6 sm:size-8' : 'size-8',
              destacado ? 'bg-destructive/10 text-destructive' : 'bg-muted text-primary',
            )}
          >
            <Icon className={compacto ? 'size-4 sm:size-5' : 'size-5'} />
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div
          className={cn(
            'font-bold tracking-tight',
            compacto ? 'text-sm sm:text-2xl' : 'text-2xl',
          )}
        >
          {value}
        </div>
        {hint && (
          <p
            className={cn(
              'text-xs text-muted-foreground',
              compacto && 'hidden sm:block',
            )}
          >
            {hint}
          </p>
        )}
        {footer}
      </div>
    </div>
  )
}
