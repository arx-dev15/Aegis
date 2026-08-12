'use client'

import { clsx } from 'clsx'

export interface Tab {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={clsx('flex border-b border-zinc-800', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-100',
            active === tab.id
              ? 'border-blue-500 text-zinc-100'
              : 'border-transparent text-zinc-500 hover:text-zinc-300',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={clsx(
                'ml-2 px-1.5 py-0.5 rounded text-xs',
                active === tab.id
                  ? 'bg-blue-500/15 text-blue-300'
                  : 'bg-zinc-800 text-zinc-500',
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
