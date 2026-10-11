import { cn } from 'cn'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangleIcon } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Ocurrió un error',
  description,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <Card
      className={cn(
        'flex flex-col items-center justify-center gap-2 p-8 text-center',
        className,
      )}
    >
      <AlertTriangleIcon className="size-8 text-destructive" />
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </Card>
  )
}
