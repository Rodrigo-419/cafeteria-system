export function TerminalLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">{children}</div>
    </div>
  )
}
