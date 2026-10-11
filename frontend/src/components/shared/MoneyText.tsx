import { formatearMoneda } from '@/lib/format/money'

interface MoneyTextProps {
  amountCents: number
  className?: string
}

export function MoneyText({ amountCents, className }: MoneyTextProps) {
  return <span className={className}>{formatearMoneda(amountCents)}</span>
}
