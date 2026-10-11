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
  className,
}: StatCardProps) {
  const destacado = tone === 'warning'

  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
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
              'flex size-8 shrink-0 items-center justify-center rounded-lg',
              destacado ? 'bg-destructive/10 text-destructive' : 'bg-muted text-primary',
            )}
          >
            <Icon className="size-5" />
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {footer}
      </div>
    </div>
  )
}
