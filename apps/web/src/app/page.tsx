import Link from 'next/link'
import { mockProjects, mockAgentRuns, mockSystemStatus, mockActivity } from '@/data/mock'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
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
  const s = secs % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

const activeRuns = mockAgentRuns.filter((r) => r.status === 'running').length
const successRate = Math.round(
  (mockAgentRuns.filter((r) => r.status === 'success').length / mockAgentRuns.filter((r) => r.completedAt).length) * 100,
)

const activityIcons: Record<string, React.ElementType> = {
  task_started: PlayCircle,
  task_completed: CheckCircle2,
  agent_ran: Cpu,
  commit: GitCommit,
  approval_required: AlertCircle,
  file_changed: GitBranch,
}

export default function DashboardPage() {
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
            <FolderKanban className="w-4.5 h-4.5 text-zinc-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-100">{mockProjects.length}</div>
            <div className="text-xs text-zinc-500">Projects</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Cpu className="w-4.5 h-4.5 text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-100">{activeRuns}</div>
            <div className="text-xs text-zinc-500">Active Runs</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4.5 h-4.5 text-green-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-100">{successRate}%</div>
            <div className="text-xs text-zinc-500">Success Rate</div>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
            <Clock className="w-4.5 h-4.5 text-zinc-400" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-100">{mockAgentRuns.length}</div>
            <div className="text-xs text-zinc-500">Total Runs</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent agent runs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-300">Recent Agent Runs</h2>
            <Link href="/agents" className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2">
            {mockAgentRuns.map((run) => (
              <Link key={run.id} href={`/tasks/${run.id}`}>
                <Card hover className="flex items-start gap-3 cursor-pointer">
                  <StatusDot status={run.status} animate className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-zinc-200 truncate leading-snug">{run.taskDescription}</p>
                      <Badge variant={run.status} className="shrink-0">{run.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-zinc-500">{run.projectName}</span>
                      {run.currentAgent && (
                        <span className="text-xs text-blue-400 font-medium">{run.currentAgent} agent</span>
                      )}
                      {run.durationSeconds && (
                        <span className="text-xs text-zinc-600">{formatDuration(run.durationSeconds)}</span>
                      )}
                      <span className="text-xs text-zinc-600 ml-auto">{timeAgo(run.startedAt)}</span>
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

          {/* Recent projects */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-zinc-300">Projects</h2>
              <Link href="/new-task" className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
                <Plus className="w-3 h-3" /> New
              </Link>
            </div>
            <div className="space-y-2">
              {mockProjects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card hover className="cursor-pointer">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-zinc-200">{project.name}</span>
                      <Badge variant={project.status}>{project.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-zinc-500">
                        <GitBranch className="w-3 h-3" />
                        {project.branch}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {project.completedTasks}/{project.taskCount} tasks
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div>
            <h2 className="text-sm font-medium text-zinc-300 mb-3">Activity</h2>
            <div className="space-y-1">
              {mockActivity.slice(0, 4).map((item) => {
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
