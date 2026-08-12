import { clsx } from 'clsx'

interface StatusDotProps {
  status: string
  animate?: boolean
  className?: string
}

const colorMap: Record<string, string> = {
  running: 'bg-blue-400',
  success: 'bg-green-400',
  active: 'bg-green-400',
  online: 'bg-green-400',
  failed: 'bg-red-400',
  error: 'bg-red-400',
  offline: 'bg-zinc-600',
  pending: 'bg-yellow-400',
  degraded: 'bg-yellow-400',
  paused: 'bg-orange-400',
  idle: 'bg-zinc-500',
  archived: 'bg-zinc-600',
}

export function StatusDot({ status, animate = false, className }: StatusDotProps) {
  const color = colorMap[status] ?? 'bg-zinc-500'
  const shouldPulse = animate && status === 'running'

  return (
    <span className={clsx('relative inline-flex h-2 w-2 shrink-0', className)}>
      {shouldPulse && (
        <span className={clsx('animate-ping absolute inline-flex h-full w-full rounded-full opacity-50', color)} />
      )}
      <span className={clsx('relative inline-flex rounded-full h-2 w-2', color)} />
    </span>
  )
}
