import { clsx } from 'clsx'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
  hover?: boolean
}

export function Card({ children, className, padding = true, hover = false }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-zinc-900 border border-zinc-800 rounded-lg',
        padding && 'p-4',
        hover && 'transition-colors hover:border-zinc-700',
        className,
      )}
    >
      {children}
    </div>
  )
}
