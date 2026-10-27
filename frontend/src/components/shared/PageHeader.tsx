interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
  /** Ref del titulo; permite llevar el foco al abrir una pantalla. */
  titleRef?: React.Ref<HTMLHeadingElement>
  /** `-1` permite enfocar el titulo por programa sin incluirlo en el tabulador. */
  titleTabIndex?: number
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  titleRef,
  titleTabIndex,
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${className ?? ''}`}
    >
      <div className="space-y-1">
        <h1
          ref={titleRef}
          tabIndex={titleTabIndex}
          className="text-2xl font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
