'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  Cpu,
  Settings,
  Plus,
  Zap,
  FolderKanban,
  GitBranch,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Agents', href: '/agents', icon: Cpu },
  { label: 'Settings', href: '/settings', icon: Settings },
]

const projectLinks = [
  { label: 'aegis-core', href: '/projects/1', branch: 'main' },
  { label: 'aegis-tools', href: '/projects/2', branch: 'dev' },
  { label: 'api-gateway', href: '/projects/3', branch: 'feat/auth' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col h-screen fixed left-0 top-0 z-20">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-zinc-800">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-zinc-100 text-sm tracking-tight">Aegis</span>
          <span className="ml-auto text-[10px] text-zinc-600 font-mono">v0.1</span>
        </Link>
      </div>

      {/* New Task shortcut */}
      <div className="px-3 py-3">
        <Link
          href="/new-task"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/20 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Task
        </Link>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-blue-600/10 text-blue-400 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800',
              )}
            >
              <item.icon className="w-4 h-4 shrink-0 text-current" />
              {item.label}
            </Link>
          )
        })}

        {/* Projects section */}
        <div className="pt-5">
          <div className="flex items-center justify-between px-3 mb-1.5">
            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
              Projects
            </span>
            <Link href="/new-task">
              <Plus className="w-3 h-3 text-zinc-600 hover:text-zinc-400 transition-colors" />
            </Link>
          </div>

          <div className="space-y-0.5">
            {projectLinks.map((project) => {
              const isActive = (pathname ?? '').startsWith(project.href)
              return (
                <Link
                  key={project.href}
                  href={project.href}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors',
                    isActive
                      ? 'bg-zinc-800 text-zinc-200'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60',
                  )}
                >
                  <FolderKanban className="w-3.5 h-3.5 shrink-0 text-zinc-600" />
                  <span className="flex-1 truncate text-xs">{project.label}</span>
                  <span className="flex items-center gap-0.5 text-[10px] text-zinc-700 font-mono shrink-0">
                    <GitBranch className="w-2.5 h-2.5" />
                    {project.branch}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-medium text-zinc-300">A</span>
          </div>
          <span className="text-xs text-zinc-500 truncate">Aegis OS</span>
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
        </div>
      </div>
    </aside>
  )
}
