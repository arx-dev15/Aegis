'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useTask } from '@/hooks/useTask'
import { useRun } from '@/hooks/useRun'
import { approvalApi } from '@/lib/api'
import type { ApiRunEvent, ApiProjectFile } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { StatusDot } from '@/components/ui/StatusDot'
import { Tabs } from '@/components/ui/Tabs'
import type { Tab } from '@/components/ui/Tabs'
import { clsx } from 'clsx'
import {
  CheckCircle2,
  XCircle,
  Circle,
  Loader2,
  FileDiff,
  CheckCheck,
  ShieldAlert,
  ExternalLink,
  Plus,
  Minus,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
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

const logLevelColors: Record<string, string> = {
  info:  'text-zinc-400',
  warn:  'text-yellow-400',
  error: 'text-red-400',
  debug: 'text-zinc-600',
}

const logLevelBg: Record<string, string> = {
  info:  '',
  warn:  'bg-yellow-500/5',
  error: 'bg-red-500/5',
  debug: '',
}

function statusVariant(status: string): string {
  const map: Record<string, string> = {
    pending:   'pending',
    running:   'running',
    completed: 'success',
    failed:    'failed',
    paused:    'paused',
    cancelled: 'offline',
    success:   'success',
  }
  return map[status] ?? 'default'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TaskPage() {
  const params = useParams()
  const id = params?.id as string

  // id is the task ID — useRun fetches the most recent run for this task
  const { task, loading: taskLoading } = useTask(id)
  const { run, loading: runLoading, refetch: refetchRun } = useRun(id)

  const [activeTab, setActiveTab] = useState('overview')

  // Per-approval action state
  const [approvalActions, setApprovalActions] = useState<
    Record<string, 'pending' | 'submitting' | 'approved' | 'rejected'>
  >({})

  const loading = taskLoading || runLoading

  // Events and files embedded in the run (SKIP_DB mode)
  const events: ApiRunEvent[]    = run?.events ?? []
  const files:  ApiProjectFile[] = run?.files  ?? []

  // Pending approvals derived from run events that carry approval metadata
  const pendingApprovals = events.filter(
    (e) =>
      typeof e.metadata?.approvalId === 'string' &&
      (approvalActions[e.metadata.approvalId as string] ?? 'pending') === 'pending'
  )

  async function handleApproval(approvalId: string, action: 'approve' | 'reject') {
    setApprovalActions((prev) => ({ ...prev, [approvalId]: 'submitting' }))
    try {
      await approvalApi.resolve(approvalId, action)
      setApprovalActions((prev) => ({
        ...prev,
        [approvalId]: action === 'approve' ? 'approved' : 'rejected',
      }))
      refetchRun()
    } catch {
      // Revert to pending on error so user can retry
      setApprovalActions((prev) => ({ ...prev, [approvalId]: 'pending' }))
    }
  }

  const tabs: Tab[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'logs',     label: 'Logs',     count: events.length },
    { id: 'files',    label: 'Files',    count: files.length  },
    { id: 'approval', label: 'Approval', count: pendingApprovals.length || undefined },
  ]

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-zinc-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading task...
      </div>
    )
  }

  if (!task && !run) {
    return (
      <div className="p-6">
        <Card>
          <p className="text-sm text-zinc-400">Task not found.</p>
          <p className="text-xs text-zinc-500 mt-1">
            The task ID <code className="font-mono text-zinc-400">{id}</code> does not exist.
          </p>
        </Card>
      </div>
    )
  }

  // Derive display values — prefer run, fall back to task
  const status       = run?.status       ?? task?.status    ?? 'pending'
  const description  = task?.description ?? ''
  const currentAgent = run?.current_agent
  const filesChanged = run?.files_changed ?? 0
  const duration     = run?.duration_seconds
  const startedAt    = run?.started_at   ?? task?.created_at ?? ''
  const projectId    = run?.project_id   ?? task?.project_id ?? ''

  const passedTests = run?.tests_passed ?? 0
  const totalTests  = run?.tests_run    ?? 0
  const failedTests = totalTests - passedTests

  const statusVar = statusVariant(status)

  return (
    <div className="p-6 space-y-5">
      {/* Task header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
          <span>{projectId}</span>
          <span>/</span>
          <span className="text-zinc-400">#{id.slice(0, 8)}</span>
        </div>
        <div className="flex items-start gap-3 justify-between flex-wrap gap-y-2">
          <div className="flex items-start gap-3">
            <StatusDot status={statusVar} animate className="mt-1.5" />
            <h1 className="text-base font-semibold text-zinc-100 leading-snug max-w-2xl">
              {description || id}
            </h1>
          </div>
          <Badge variant={statusVar as any}>{status}</Badge>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500 ml-5">
          {startedAt && <span>Started {timeAgo(startedAt)}</span>}
          {currentAgent && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-400 font-medium">{currentAgent} running</span>
            </span>
          )}
          {filesChanged > 0 && <span>{filesChanged} files changed</span>}
          {duration != null && <span>{formatDuration(duration)}</span>}
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* ── OVERVIEW ─────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Execution timeline */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-medium text-zinc-300 mb-4">Execution Timeline</h2>
            {events.length === 0 ? (
              <Card>
                <p className="text-sm text-zinc-500">
                  {run ? 'No events recorded yet.' : 'This task has not been run yet.'}
                </p>
              </Card>
            ) : (
              <div className="relative">
                {events.map((event, index) => {
                  const isLast  = index === events.length - 1
                  const isError = event.level === 'error'
                  const isWarn  = event.level === 'warn'
                  const StatusIcon = isError ? XCircle : event.level === 'info' ? CheckCircle2 : Circle

                  return (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={clsx(
                            'w-7 h-7 rounded-full flex items-center justify-center shrink-0 border',
                            isError
                              ? 'bg-red-500/10 border-red-500/30 text-red-400'
                              : isWarn
                                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                                : 'bg-green-500/10 border-green-500/30 text-green-400',
                          )}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                        </div>
                        {!isLast && <div className="w-px flex-1 bg-zinc-800 my-1" />}
                      </div>
                      <div className={clsx('flex-1 pb-5', isLast && 'pb-0')}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
                              {event.agent}
                            </span>
                            <p className="text-sm mt-0.5 text-zinc-300">{event.message}</p>
                            {event.metadata && Object.keys(event.metadata).length > 0 && (
                              <p className="text-xs text-zinc-500 mt-0.5">
                                {Object.entries(event.metadata)
                                  .filter(([k]) => k !== 'approvalId')
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(' · ')}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs text-zinc-500 font-mono">
                              {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Stats sidebar */}
          <div className="space-y-4">
            <Card>
              <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Run Summary</div>
              <div className="space-y-2.5">
                {[
                  { label: 'Status',  value: <Badge variant={statusVar as any}>{status}</Badge> },
                  { label: 'Project', value: <span className="text-zinc-300 text-sm">{projectId || '—'}</span> },
                  { label: 'Started', value: <span className="text-zinc-400 text-sm">{startedAt ? timeAgo(startedAt) : '—'}</span> },
                  { label: 'Files',   value: <span className="text-zinc-300 text-sm">{filesChanged}</span> },
                  { label: 'Tests',   value: (
                    <span className={`text-sm ${failedTests > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {passedTests}/{totalTests} passed
                    </span>
                  )},
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">{label}</span>
                    {value}
                  </div>
                ))}
              </div>
            </Card>

            {status === 'running' && currentAgent && (
              <Card className="border-blue-500/20 bg-blue-500/5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Active Agent</span>
                </div>
                <p className="text-sm font-medium text-zinc-200">{currentAgent}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Processing...</p>
              </Card>
            )}

            {pendingApprovals.length > 0 && (
              <Card className="border-yellow-500/20 bg-yellow-500/5">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">Approval Needed</span>
                </div>
                <p className="text-xs text-zinc-400">{pendingApprovals[0]?.message}</p>
                <button
                  onClick={() => setActiveTab('approval')}
                  className="mt-2 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  Review →
                </button>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── LOGS ─────────────────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-zinc-300">Agent Logs</h2>
            <span className="text-xs text-zinc-600 font-mono">{events.length} entries</span>
          </div>
          {events.length === 0 ? (
            <Card><p className="text-sm text-zinc-500">No log entries yet.</p></Card>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="max-h-[520px] overflow-y-auto">
                {events.map((event, idx) => (
                  <div
                    key={event.id}
                    className={clsx(
                      'flex gap-3 px-4 py-2 font-mono text-xs border-b border-zinc-800/60 last:border-0',
                      logLevelBg[event.level],
                      idx % 2 !== 0 && 'bg-zinc-800/20',
                    )}
                  >
                    <span className="text-zinc-600 shrink-0 tabular-nums">
                      {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                    </span>
                    <span className={clsx('w-10 shrink-0 font-semibold uppercase text-[10px] tracking-wide', logLevelColors[event.level])}>
                      {event.level}
                    </span>
                    <span className="text-blue-400/70 w-20 shrink-0 truncate">{event.agent}</span>
                    <span className={clsx('flex-1', logLevelColors[event.level] !== 'text-zinc-400' ? logLevelColors[event.level] : 'text-zinc-300')}>
                      {event.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FILES ────────────────────────────────────────────────────────────── */}
      {activeTab === 'files' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-zinc-300">Files Changed</h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-green-400 flex items-center gap-1">
                <Plus className="w-3 h-3" />{files.reduce((s, f) => s + (f.additions ?? 0), 0)}
              </span>
              <span className="text-red-400 flex items-center gap-1">
                <Minus className="w-3 h-3" />{files.reduce((s, f) => s + (f.deletions ?? 0), 0)}
              </span>
            </div>
          </div>
          {files.length === 0 ? (
            <Card><p className="text-sm text-zinc-500">No file changes recorded yet.</p></Card>
          ) : (
            <Card padding={false}>
              {files.map((file, i) => (
                <div
                  key={file.id ?? file.path}
                  className={clsx('flex items-center gap-3 px-4 py-3', i < files.length - 1 && 'border-b border-zinc-800')}
                >
                  <FileDiff className="w-4 h-4 text-zinc-600 shrink-0" />
                  <span
                    className={clsx(
                      'text-xs font-mono px-1.5 py-0.5 rounded shrink-0',
                      file.status === 'added'   ? 'bg-green-500/10 text-green-400' :
                      file.status === 'deleted' ? 'bg-red-500/10 text-red-400'    :
                      'bg-yellow-500/10 text-yellow-400',
                    )}
                  >
                    {file.status === 'added' ? 'A' : file.status === 'deleted' ? 'D' : 'M'}
                  </span>
                  <span className="flex-1 text-sm font-mono text-zinc-300 truncate">{file.path}</span>
                  <div className="flex items-center gap-2 shrink-0 text-xs font-mono">
                    {file.additions > 0 && <span className="text-green-400">+{file.additions}</span>}
                    {file.deletions > 0 && <span className="text-red-400">-{file.deletions}</span>}
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors shrink-0" />
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* ── APPROVAL ─────────────────────────────────────────────────────────── */}
      {activeTab === 'approval' && (
        <div className="max-w-xl space-y-4">
          {events
            .filter((e) => typeof e.metadata?.approvalId === 'string')
            .length === 0 ? (
            <Card>
              <p className="text-sm text-zinc-500">No approval requests for this run.</p>
            </Card>
          ) : (
            events
              .filter((e) => typeof e.metadata?.approvalId === 'string')
              .map((event) => {
                const approvalId = event.metadata.approvalId as string
                const state = approvalActions[approvalId] ?? 'pending'
                return (
                  <Card key={approvalId} className="border-yellow-500/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                          <ShieldAlert className="w-4 h-4 text-yellow-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-200">{event.message}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Requested by <span className="text-zinc-400">{event.agent}</span> · {timeAgo(event.timestamp)}
                          </p>
                        </div>
                      </div>
                      <Badge variant={state === 'approved' ? 'success' : state === 'rejected' ? 'failed' : 'pending'}>
                        {state === 'submitting' ? 'saving…' : state}
                      </Badge>
                    </div>

                    {(state === 'pending' || state === 'submitting') && (
                      <div className="flex items-center gap-2 mt-4">
                        <Button
                          variant="success"
                          size="sm"
                          isLoading={state === 'submitting'}
                          disabled={state === 'submitting'}
                          onClick={() => handleApproval(approvalId, 'approve')}
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          Approve &amp; Continue
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleApproval(approvalId, 'reject')}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </Button>
                      </div>
                    )}
                    {state === 'approved' && (
                      <div className="flex items-center gap-2 mt-4 text-sm text-green-400">
                        <CheckCircle2 className="w-4 h-4" /> Approved — agents will continue execution
                      </div>
                    )}
                    {state === 'rejected' && (
                      <div className="flex items-center gap-2 mt-4 text-sm text-red-400">
                        <XCircle className="w-4 h-4" /> Rejected — task paused for revision
                      </div>
                    )}
                  </Card>
                )
              })
          )}
        </div>
      )}
    </div>
  )
}
