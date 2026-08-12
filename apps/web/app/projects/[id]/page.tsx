'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useProject } from '@/hooks/useProject'
import { useActivity } from '@/hooks/useActivity'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tabs } from '@/components/ui/Tabs'
import type { Tab } from '@/components/ui/Tabs'
import type { ApiTask, ApiActivity } from '@/lib/api'
import {
  GitBranch,
  ExternalLink,
  CheckCircle2,
  Clock,
  FolderKanban,
  PlayCircle,
  GitCommit,
  Cpu,
  AlertCircle,
  Plus,
  Loader2,
} from 'lucide-react'

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

const tabs: Tab[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'activity', label: 'Activity' },
]

const activityIcons: Record<string, React.ElementType> = {
  task_started:      PlayCircle,
  task_completed:    CheckCircle2,
  agent_ran:         Cpu,
  commit:            GitCommit,
  approval_required: AlertCircle,
  file_changed:      GitBranch,
}

// Map backend task status to the variant tokens Badge/StatusDot understand
function taskStatusVariant(status: ApiTask['status']): string {
  const map: Record<string, string> = {
    pending:   'pending',
    running:   'running',
    completed: 'success',
    failed:    'failed',
    paused:    'paused',
    cancelled: 'offline',
  }
  return map[status] ?? 'default'
}

export default function ProjectPage() {
  const params = useParams()
  const id = params?.id as string
  const [activeTab, setActiveTab] = useState('tasks')

  const { project, tasks, loading, error } = useProject(id)
  const { activity, loading: actLoading } = useActivity(50)

  // Filter activity to just this project
  const projectActivity = activity.filter((a: ApiActivity) => a.project_id === id)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-zinc-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading project...
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="p-6">
        <Card>
          <p className="text-sm text-red-400">⚠ {error ?? 'Project not found'}</p>
          <p className="text-xs text-zinc-500 mt-1">
            Make sure the backend is running and the project ID is valid.
          </p>
          <Link href="/" className="text-xs text-blue-400 hover:text-blue-300 mt-3 inline-block">
            ← Back to Dashboard
          </Link>
        </Card>
      </div>
    )
  }

  const techStack = parseTechStack(project.tech_stack)
  const progressPct = project.task_count > 0
    ? Math.round((project.completed_tasks / project.task_count) * 100)
    : 0

  return (
    <div className="p-6 space-y-6">
      {/* Project header */}
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
          <FolderKanban className="w-5 h-5 text-zinc-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-semibold text-zinc-100">{project.name}</h1>
            <Badge variant={project.status}>{project.status}</Badge>
          </div>
          <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{project.description}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-xs text-zinc-500 mb-1.5 font-medium uppercase tracking-wide">Repository</div>
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-zinc-500 shrink-0" />
            {project.repo ? (
              <a
                href={`https://github.com/${project.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 truncate"
              >
                {project.repo}
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ) : (
              <span className="text-sm text-zinc-500">—</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <GitBranch className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-xs font-mono text-zinc-400">{project.branch || 'main'}</span>
          </div>
        </Card>

        <Card>
          <div className="text-xs text-zinc-500 mb-1.5 font-medium uppercase tracking-wide">Tech Stack</div>
          <div className="flex flex-wrap gap-1.5">
            {techStack.length > 0
              ? techStack.map((tech) => <Badge key={tech} variant="default">{tech}</Badge>)
              : <span className="text-sm text-zinc-500">—</span>
            }
          </div>
        </Card>

        <Card>
          <div className="text-xs text-zinc-500 mb-1.5 font-medium uppercase tracking-wide">Progress</div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-semibold text-zinc-100">{project.completed_tasks}</span>
            <span className="text-sm text-zinc-500">/ {project.task_count} tasks</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-xs text-zinc-600 mt-1.5">{timeAgo(project.updated_at)}</div>
        </Card>
      </div>

      {/* Tabs */}
      <div>
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        <div className="mt-4">
          {/* TASKS tab */}
          {activeTab === 'tasks' && (
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No tasks yet"
                  description="Start a new task to kick off your first agent run."
                  action={
                    <Link href="/new-task" className="flex items-center gap-1.5 px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors">
                      <Plus className="w-3.5 h-3.5" /> New Task
                    </Link>
                  }
                />
              ) : (
                tasks.map((task: ApiTask) => (
                  <Link key={task.id} href={`/tasks/${task.id}`}>
                    <Card hover className="flex items-start gap-3 cursor-pointer">
                      <StatusDot status={taskStatusVariant(task.status)} animate className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-zinc-200 leading-snug">{task.description}</p>
                          <Badge variant={taskStatusVariant(task.status) as any} className="shrink-0">
                            {task.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
                          <span className="capitalize">{task.execution_mode}</span>
                          <span className="text-zinc-600">Priority {task.priority}</span>
                          <span className="ml-auto">{timeAgo(task.created_at)}</span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          )}

          {/* ACTIVITY tab */}
          {activeTab === 'activity' && (
            <div className="space-y-1">
              {actLoading && (
                <div className="flex items-center gap-2 py-6 text-zinc-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading activity...
                </div>
              )}
              {!actLoading && projectActivity.length === 0 && (
                <EmptyState
                  icon={Clock}
                  title="No activity yet"
                  description="Activity will appear here as tasks run."
                />
              )}
              {!actLoading && projectActivity.map((item: ApiActivity) => {
                const Icon = activityIcons[item.type] ?? Clock
                return (
                  <div key={item.id} className="flex items-start gap-3 py-3 border-b border-zinc-800/50 last:border-0">
                    <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 leading-snug">{item.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.agent && <span className="text-xs text-zinc-500">{item.agent}</span>}
                        {typeof item.metadata?.sha === 'string' && (
                          <span className="text-xs font-mono text-zinc-600">{item.metadata.sha}</span>
                        )}
                        <span className="text-xs text-zinc-600 ml-auto">{timeAgo(item.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
