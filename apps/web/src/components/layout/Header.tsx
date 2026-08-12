'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Bell, Plus } from 'lucide-react'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/agents': 'Agents',
  '/settings': 'Settings',
  '/new-task': 'New Task',
}

function getTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  if (pathname.startsWith('/projects/')) return 'Project'
  if (pathname.startsWith('/tasks/')) return 'Task Run'
  return 'Aegis'
}

export function Header() {
  const pathname = usePathname()

  return (
    <header className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 gap-4 sticky top-0 z-10 shrink-0">
      <div className="flex-1">
        <span className="text-sm font-medium text-zinc-300">{getTitle(pathname ?? '/')}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tasks, projects..."
            className="pl-8 pr-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 w-52 transition-colors"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
        </button>

        {/* New Task */}
        <Link
          href="/new-task"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Task
        </Link>
      </div>
    </header>
  )
}
