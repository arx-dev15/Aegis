import { clsx } from 'clsx'
import type { RunStatus, ProjectStatus, AgentStatus } from '@/types'

type BadgeVariant = RunStatus | ProjectStatus | AgentStatus | 'online' | 'offline' | 'degraded' | 'default' | 'blue' | 'purple'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variants: Record<string, string> = {
  running: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  success: 'bg-green-500/10 text-green-400 border-green-500/25',
  failed: 'bg-red-500/10 text-red-400 border-red-500/25',
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25',
  paused: 'bg-orange-500/10 text-orange-400 border-orange-500/25',
  active: 'bg-green-500/10 text-green-400 border-green-500/25',
  archived: 'bg-zinc-700/30 text-zinc-500 border-zinc-600/30',
  idle: 'bg-zinc-700/30 text-zinc-400 border-zinc-600/30',
  error: 'bg-red-500/10 text-red-400 border-red-500/25',
  offline: 'bg-zinc-700/30 text-zinc-500 border-zinc-600/30',
  online: 'bg-green-500/10 text-green-400 border-green-500/25',
  degraded: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25',
  default: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  purple: 'bg-violet-500/10 text-violet-400 border-violet-500/25',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        variants[variant] ?? variants.default,
        className,
      )}
    >
      {children}
    </span>
  )
}
