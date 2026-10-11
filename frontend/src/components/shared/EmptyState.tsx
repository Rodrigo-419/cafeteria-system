import { cn } from 'cn'
import { Card } from '@/components/ui/card'
import { InboxIcon } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  title = 'Sin datos',
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card
      className={cn(
        'flex flex-col items-center justify-center gap-2 p-8 text-center',
        className,
      )}
    >
      <InboxIcon className="size-8 text-muted-foreground" />
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </Card>
  )
}
