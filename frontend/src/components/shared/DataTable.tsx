import type { ReactNode } from 'react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  cell: (item: T, index: number) => ReactNode
  className?: string
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  error?: string | null
  emptyTitle?: string
  emptyDescription?: string
  onRetry?: () => void
  page?: number
  pageSize?: number
  total?: number
  onPageChange?: (page: number) => void
  className?: string
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  error,
  emptyTitle = 'Sin datos',
  emptyDescription,
  onRetry,
  page = 1,
  pageSize = 10,
  total,
  onPageChange,
  className,
}: DataTableProps<T>) {
  const totalPages =
    total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : undefined
  const canPrev = page > 1
  const canNext =
    totalPages !== undefined ? page < totalPages : data.length >= pageSize

  if (error) {
    return (
      <ErrorState
        title="Error al cargar datos"
        description={error}
        onRetry={onRetry}
      />
    )
  }

  if (isLoading) {
    return (
      <Card className={cn('p-4', className)}>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </Card>
    )
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className={cn('space-y-3', className)}>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, idx) => (
              <TableRow key={idx}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.className}>
                    {c.cell(item, idx)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {(onPageChange || totalPages !== undefined) && (
        <div className="flex items-center justify-end gap-2">
          <div className="text-sm text-muted-foreground">
            {total !== undefined
              ? `Página ${page} de ${totalPages}`
              : `Página ${page}`}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(page - 1)}
            disabled={!canPrev}
          >
            <ChevronLeftIcon className="mr-1 size-4" /> Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(page + 1)}
            disabled={!canNext}
          >
            Siguiente <ChevronRightIcon className="ml-1 size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
