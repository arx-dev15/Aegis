import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-zinc-500" />
      </div>
      <h3 className="text-sm font-medium text-zinc-300 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
