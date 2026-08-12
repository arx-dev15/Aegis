'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import {
  mockAgentRuns,
  mockTimeline,
  mockLogs,
  mockFileChanges,
  mockTestResults,
  mockApprovalRequests,
  mockGeneratedPlan,
} from '@/data/mock'
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

const logLevelColors: Record<string, string> = {
  info: 'text-zinc-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  debug: 'text-zinc-600',
}

const logLevelBg: Record<string, string> = {
  info: '',
  warn: 'bg-yellow-500/5',
  error: 'bg-red-500/5',
  debug: '',
}

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'logs', label: 'Logs', count: mockLogs.length },
  { id: 'files', label: 'Files', count: mockFileChanges.length },
  { id: 'tests', label: 'Tests', count: mockTestResults.length },
  { id: 'plan', label: 'Plan' },
  { id: 'approval', label: 'Approval', count: mockApprovalRequests.filter((r) => r.status === 'pending').length },
]

export default function TaskPage() {
  const params = useParams()
  const id = params?.id as string
  const [activeTab, setActiveTab] = useState('overview')
  const [approvalState, setApprovalState] = useState<'pending' | 'approved' | 'rejected'>('pending')

  const run = mockAgentRuns.find((r) => r.id === id) ?? mockAgentRuns[0]!

  const passedTests = mockTestResults.filter((t) => t.status === 'passed').length
  const failedTests = mockTestResults.filter((t) => t.status === 'failed').length
  const skippedTests = mockTestResults.filter((t) => t.status === 'skipped').length

  return (
    <div className="p-6 space-y-5">
      {/* Task header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
          <span>{run.projectName}</span>
          <span>/</span>
          <span className="text-zinc-400">#{run.id}</span>
        </div>
        <div className="flex items-start gap-3 justify-between flex-wrap gap-y-2">
          <div className="flex items-start gap-3">
            <StatusDot status={run.status} animate className="mt-1.5" />
            <h1 className="text-base font-semibold text-zinc-100 leading-snug max-w-2xl">
              {run.taskDescription}
            </h1>
          </div>
          <Badge variant={run.status}>{run.status}</Badge>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500 ml-5">
          <span>Started {timeAgo(run.startedAt)}</span>
          {run.currentAgent && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-400 font-medium">{run.currentAgent} running</span>
            </span>
          )}
          {run.filesChanged > 0 && <span>{run.filesChanged} files changed</span>}
          {run.durationSeconds && <span>{formatDuration(run.durationSeconds)}</span>}
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div>
        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Timeline */}
            <div className="lg:col-span-2">
              <h2 className="text-sm font-medium text-zinc-300 mb-4">Execution Timeline</h2>
              <div className="relative">
                {mockTimeline.map((step, index) => {
                  const isLast = index === mockTimeline.length - 1
                  const StatusIcon =
                    step.status === 'completed'
                      ? CheckCircle2
                      : step.status === 'running'
                      ? Loader2
                      : step.status === 'failed'
                      ? XCircle
                      : Circle

                  return (
                    <div key={step.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={clsx(
                            'w-7 h-7 rounded-full flex items-center justify-center shrink-0 border',
                            step.status === 'completed'
                              ? 'bg-green-500/10 border-green-500/30 text-green-400'
                              : step.status === 'running'
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                              : step.status === 'failed'
                              ? 'bg-red-500/10 border-red-500/30 text-red-400'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-600',
                          )}
                        >
                          <StatusIcon
                            className={clsx('w-3.5 h-3.5', step.status === 'running' && 'animate-spin')}
                          />
                        </div>
                        {!isLast && <div className="w-px flex-1 bg-zinc-800 my-1" />}
                      </div>
                      <div className={clsx('flex-1 pb-5', isLast && 'pb-0')}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span
                              className={clsx(
                                'text-xs font-semibold uppercase tracking-wide',
                                step.status === 'running'
                                  ? 'text-blue-400'
                                  : step.status === 'completed'
                                  ? 'text-zinc-300'
                                  : 'text-zinc-600',
                              )}
                            >
                              {step.agent}
                            </span>
                            <p
                              className={clsx(
                                'text-sm mt-0.5',
                                step.status === 'pending' ? 'text-zinc-600' : 'text-zinc-300',
                              )}
                            >
                              {step.action}
                            </p>
                            {step.detail && (
                              <p className="text-xs text-zinc-500 mt-0.5">{step.detail}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            {step.durationSeconds && (
                              <span className="text-xs text-zinc-500 font-mono">
                                {formatDuration(step.durationSeconds)}
                              </span>
                            )}
                            {step.status === 'running' && (
                              <span className="text-xs text-blue-400 block">in progress</span>
                            )}
                            {step.status === 'pending' && (
                              <span className="text-xs text-zinc-600">waiting</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Stats sidebar */}
            <div className="space-y-4">
              <Card>
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Run Summary</div>
                <div className="space-y-2.5">
                  {[
                    { label: 'Status', value: <Badge variant={run.status}>{run.status}</Badge> },
                    { label: 'Project', value: <span className="text-zinc-300 text-sm">{run.projectName}</span> },
                    { label: 'Started', value: <span className="text-zinc-400 text-sm">{timeAgo(run.startedAt)}</span> },
                    { label: 'Files', value: <span className="text-zinc-300 text-sm">{run.filesChanged}</span> },
                    { label: 'Tests', value: <span className={`text-sm ${failedTests > 0 ? 'text-red-400' : 'text-green-400'}`}>{passedTests}/{mockTestResults.filter(t => t.status !== 'skipped').length} passed</span> },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">{label}</span>
                      {value}
                    </div>
                  ))}
                </div>
              </Card>

              {run.status === 'running' && run.currentAgent && (
                <Card className="border-blue-500/20 bg-blue-500/5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Active Agent</span>
                  </div>
                  <p className="text-sm font-medium text-zinc-200">{run.currentAgent}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Writing implementation files...</p>
                </Card>
              )}

              {mockApprovalRequests.filter((r) => r.status === 'pending').length > 0 && (
                <Card className="border-yellow-500/20 bg-yellow-500/5">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">Approval Needed</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {mockApprovalRequests[0]?.title}
                  </p>
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

        {/* LOGS */}
        {activeTab === 'logs' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-zinc-300">Agent Logs</h2>
              <span className="text-xs text-zinc-600 font-mono">{mockLogs.length} entries</span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="max-h-[520px] overflow-y-auto">
                {mockLogs.map((log, idx) => (
                  <div
                    key={log.id}
                    className={clsx(
                      'flex gap-3 px-4 py-2 font-mono text-xs border-b border-zinc-800/60 last:border-0',
                      logLevelBg[log.level],
                      idx % 2 === 0 ? '' : 'bg-zinc-800/20',
                    )}
                  >
                    <span className="text-zinc-600 shrink-0 tabular-nums">
                      {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                    </span>
                    <span
                      className={clsx(
                        'w-10 shrink-0 font-semibold uppercase text-[10px] tracking-wide',
                        logLevelColors[log.level],
                      )}
                    >
                      {log.level}
                    </span>
                    <span className="text-blue-400/70 w-20 shrink-0 truncate">{log.agent}</span>
                    <span className={clsx('flex-1', logLevelColors[log.level] !== 'text-zinc-400' ? logLevelColors[log.level] : 'text-zinc-300')}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FILES */}
        {activeTab === 'files' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-zinc-300">Files Changed</h2>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-green-400 flex items-center gap-1"><Plus className="w-3 h-3" />{mockFileChanges.reduce((s, f) => s + f.additions, 0)}</span>
                <span className="text-red-400 flex items-center gap-1"><Minus className="w-3 h-3" />{mockFileChanges.reduce((s, f) => s + f.deletions, 0)}</span>
              </div>
            </div>
            <Card padding={false}>
              {mockFileChanges.map((file, i) => (
                <div
                  key={file.path}
                  className={clsx(
                    'flex items-center gap-3 px-4 py-3',
                    i < mockFileChanges.length - 1 && 'border-b border-zinc-800',
                  )}
                >
                  <FileDiff className="w-4 h-4 text-zinc-600 shrink-0" />
                  <span
                    className={clsx(
                      'text-xs font-mono px-1.5 py-0.5 rounded shrink-0',
                      file.status === 'added'
                        ? 'bg-green-500/10 text-green-400'
                        : file.status === 'deleted'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-yellow-500/10 text-yellow-400',
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
          </div>
        )}

        {/* TESTS */}
        {activeTab === 'tests' && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Passed', count: passedTests, color: 'text-green-400', bg: 'bg-green-500/10' },
                { label: 'Failed', count: failedTests, color: 'text-red-400', bg: 'bg-red-500/10' },
                { label: 'Skipped', count: skippedTests, color: 'text-zinc-400', bg: 'bg-zinc-700/30' },
              ].map(({ label, count, color, bg }) => (
                <Card key={label} className="text-center">
                  <div className={clsx('text-2xl font-semibold mb-0.5', color)}>{count}</div>
                  <div className="text-xs text-zinc-500">{label}</div>
                  <div className={clsx('w-6 h-1 rounded-full mx-auto mt-2', bg.replace('/10', '/40').replace('/30', '/60'))} />
                </Card>
              ))}
            </div>

            {/* Test list */}
            <Card padding={false}>
              {mockTestResults.map((test, i) => (
                <div
                  key={test.id}
                  className={clsx(
                    'flex items-start gap-3 px-4 py-3',
                    i < mockTestResults.length - 1 && 'border-b border-zinc-800',
                  )}
                >
                  {test.status === 'passed' ? (
                    <CheckCheck className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  ) : test.status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xs text-zinc-500 font-mono">{test.suite}</span>
                      <span className="text-sm text-zinc-300">{test.name}</span>
                    </div>
                    {test.errorMessage && (
                      <p className="text-xs text-red-400 mt-1 font-mono bg-red-500/5 px-2 py-1 rounded">
                        {test.errorMessage}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-mono text-zinc-600 shrink-0">{test.durationMs}ms</span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* PLAN */}
        {activeTab === 'plan' && (
          <div>
            <h2 className="text-sm font-medium text-zinc-300 mb-3">Generated Plan</h2>
            <Card padding={false}>
              <pre className="p-5 text-sm text-zinc-300 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
                {mockGeneratedPlan}
              </pre>
            </Card>
          </div>
        )}

        {/* APPROVAL */}
        {activeTab === 'approval' && (
          <div className="max-w-xl space-y-4">
            {mockApprovalRequests.map((req) => (
              <Card key={req.id} className="border-yellow-500/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{req.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Requested by <span className="text-zinc-400">{req.requestedBy}</span> · {timeAgo(req.requestedAt)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={req.status === 'pending' ? 'pending' : req.status === 'approved' ? 'success' : 'failed'}>
                    {approvalState}
                  </Badge>
                </div>

                <p className="text-sm text-zinc-400 mt-3 leading-relaxed">{req.description}</p>

                {approvalState === 'pending' && (
                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => setApprovalState('approved')}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve & Continue
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setApprovalState('rejected')}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </Button>
                  </div>
                )}

                {approvalState === 'approved' && (
                  <div className="flex items-center gap-2 mt-4 text-sm text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Approved — agents will continue execution
                  </div>
                )}

                {approvalState === 'rejected' && (
                  <div className="flex items-center gap-2 mt-4 text-sm text-red-400">
                    <XCircle className="w-4 h-4" />
                    Rejected — task paused for revision
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
