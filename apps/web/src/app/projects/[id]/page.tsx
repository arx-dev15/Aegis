'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { mockProjects, mockAgentRuns, mockActivity } from '@/data/mock'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { Tabs } from '@/components/ui/Tabs'
import type { Tab } from '@/components/ui/Tabs'
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

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  return `${m}m`
}

const tabs: Tab[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'activity', label: 'Activity' },
]

const activityIcons: Record<string, React.ElementType> = {
  task_started: PlayCircle,
  task_completed: CheckCircle2,
  agent_ran: Cpu,
  commit: GitCommit,
  approval_required: AlertCircle,
  file_changed: GitBranch,
}

export default function ProjectPage() {
  const params = useParams()
  const id = params?.id as string
  const [activeTab, setActiveTab] = useState('tasks')

  const project = mockProjects.find((p) => p.id === id) ?? mockProjects[0]!
  const projectRuns = mockAgentRuns.filter((r) => r.projectId === project.id)

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
            <a
              href={`https://github.com/${project.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 truncate"
            >
              {project.repo}
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <GitBranch className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-xs font-mono text-zinc-400">{project.branch}</span>
          </div>
        </Card>

        <Card>
          <div className="text-xs text-zinc-500 mb-1.5 font-medium uppercase tracking-wide">Tech Stack</div>
          <div className="flex flex-wrap gap-1.5">
            {project.techStack.map((tech) => (
              <Badge key={tech} variant="default">{tech}</Badge>
            ))}
          </div>
        </Card>

        <Card>
          <div className="text-xs text-zinc-500 mb-1.5 font-medium uppercase tracking-wide">Progress</div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-semibold text-zinc-100">{project.completedTasks}</span>
            <span className="text-sm text-zinc-500">/ {project.taskCount} tasks</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.round((project.completedTasks / project.taskCount) * 100)}%` }}
            />
          </div>
          <div className="text-xs text-zinc-600 mt-1.5">{timeAgo(project.lastActivity)}</div>
        </Card>
      </div>

      {/* Tabs */}
      <div>
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        <div className="mt-4">
          {activeTab === 'tasks' && (
            <div className="space-y-2">
              {projectRuns.length === 0 ? (
                <EmptyState icon={Clock} title="No tasks yet" description="Start a new task to kick off your first agent run." />
              ) : (
                projectRuns.map((run) => (
                  <Link key={run.id} href={`/tasks/${run.id}`}>
                    <Card hover className="flex items-start gap-3 cursor-pointer">
                      <StatusDot status={run.status} animate className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-zinc-200 leading-snug">{run.taskDescription}</p>
                          <Badge variant={run.status} className="shrink-0">{run.status}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
                          {run.currentAgent && <span className="text-blue-400 font-medium">{run.currentAgent}</span>}
                          {run.filesChanged > 0 && <span>{run.filesChanged} files</span>}
                          {run.testsRun > 0 && (
                            <span className={run.testsPassed === run.testsRun ? 'text-green-400' : 'text-red-400'}>
                              {run.testsPassed}/{run.testsRun} tests
                            </span>
                          )}
                          {run.durationSeconds && <span>{formatDuration(run.durationSeconds)}</span>}
                          <span className="ml-auto">{timeAgo(run.startedAt)}</span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-1">
              {mockActivity.map((item) => {
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
                        {item.metadata?.sha && (
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
