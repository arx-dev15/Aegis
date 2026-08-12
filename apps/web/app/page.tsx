'use client'

import Link from 'next/link'
import { useProjects } from '@/hooks/useProjects'
import { useActivity } from '@/hooks/useActivity'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { mockSystemStatus } from '@/data/mock'
import {
  FolderKanban,
  Cpu,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  GitBranch,
  GitCommit,
  AlertCircle,
  PlayCircle,
  Loader2,
} from 'lucide-react'
import type { ApiProject, ApiActivity } from '@/lib/api'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// Parse tech_stack JSON string from backend safely
function parseTechStack(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

const activityIcons: Record<string, React.ElementType> = {
  task_started:      PlayCircle,
  task_completed:    CheckCircle2,
  agent_ran:         Cpu,
  commit:            GitCommit,
  approval_required: AlertCircle,
  file_changed:      GitBranch,
}

export default function DashboardPage() {
  const { projects, loading: projLoading, error: projError } = useProjects()
  const { activity, loading: actLoading } = useActivity(10)

  // Derive stats from real project data
  const totalTasks     = projects.reduce((s, p) => s + (p.task_count ?? 0), 0)
  const completedTasks = projects.reduce((s, p) => s + (p.completed_tasks ?? 0), 0)
  const activeProjects = projects.filter((p) => p.status === 'active').length
  const successRate    = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Aegis AI Engineering Operating System</p>
        </div>
        <Link
          href="/new-task"
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Task
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
            <FolderKanban className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-100">
              {projLoading ? '—' : projects.length}
            </div>
            <div className="text-xs text-zinc-500">Projects</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-100">
              {projLoading ? '—' : activeProjects}
            </div>
            <div className="text-xs text-zinc-500">Active Projects</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-100">
              {projLoading ? '—' : `${successRate}%`}
            </div>
            <div className="text-xs text-zinc-500">Success Rate</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-100">
              {projLoading ? '—' : totalTasks}
            </div>
            <div className="text-xs text-zinc-500">Total Tasks</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent projects — main column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-300">Recent Projects</h2>
            <Link href="/new-task" className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Loading */}
          {projLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-zinc-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading projects...
            </div>
          )}

          {/* Error */}
          {!projLoading && projError && (
            <Card>
              <p className="text-sm text-red-400">⚠ {projError}</p>
              <p className="text-xs text-zinc-500 mt-1">Make sure the backend is running on port 4000.</p>
            </Card>
          )}

          {/* Empty */}
          {!projLoading && !projError && projects.length === 0 && (
            <Card>
              <p className="text-sm text-zinc-400">No projects yet.</p>
              <p className="text-xs text-zinc-500 mt-1">Create your first project to get started.</p>
            </Card>
          )}

          {/* Project cards */}
          <div className="space-y-2">
            {!projLoading && !projError && projects.map((project: ApiProject) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card hover className="flex items-start gap-3 cursor-pointer">
                  <StatusDot status={project.status} animate className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-zinc-200 truncate leading-snug">{project.name}</p>
                      <Badge variant={project.status} className="shrink-0">{project.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      {project.branch && (
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          {project.branch}
                        </span>
                      )}
                      {project.language && (
                        <span className="text-xs text-blue-400 font-medium">{project.language}</span>
                      )}
                      <span className="text-xs text-zinc-600">
                        {project.completed_tasks}/{project.task_count} tasks
                      </span>
                      <span className="text-xs text-zinc-600 ml-auto">{timeAgo(project.updated_at)}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* System status */}
          <div>
            <h2 className="text-sm font-medium text-zinc-300 mb-3">System Status</h2>
            <Card padding={false}>
              {mockSystemStatus.map((svc, i) => (
                <div
                  key={svc.name}
                  className={`flex items-center gap-3 px-4 py-3 ${i < mockSystemStatus.length - 1 ? 'border-b border-zinc-800' : ''}`}
                >
                  <StatusDot status={svc.status} />
                  <span className="flex-1 text-sm text-zinc-300">{svc.name}</span>
                  {svc.latencyMs !== undefined ? (
                    <span className={`text-xs font-mono ${svc.status === 'degraded' ? 'text-yellow-400' : 'text-zinc-500'}`}>
                      {svc.latencyMs}ms
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-600">—</span>
                  )}
                </div>
              ))}
            </Card>
          </div>

          {/* Recent activity */}
          <div>
            <h2 className="text-sm font-medium text-zinc-300 mb-3">Activity</h2>

            {actLoading && (
              <div className="flex items-center gap-2 py-4 text-zinc-500 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading...
              </div>
            )}

            {!actLoading && activity.length === 0 && (
              <p className="text-xs text-zinc-500 py-2">No activity yet.</p>
            )}

            <div className="space-y-1">
              {activity.slice(0, 4).map((item: ApiActivity) => {
                const Icon = activityIcons[item.type] ?? Clock
                return (
                  <div key={item.id} className="flex items-start gap-2.5 py-2">
                    <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3 h-3 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-400 leading-snug">{item.description}</p>
                      <span className="text-[10px] text-zinc-600">{timeAgo(item.timestamp)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
