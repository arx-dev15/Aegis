'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { runApi, systemApi, ApiRun, ApiSystemHealth } from '@/lib/api'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface AgentDefinition {
  id: string
  name: string
  role: string
  description: string
  capabilities: string[]
  stage: string
}

const AGENT_DEFS: AgentDefinition[] = [
  {
    id: 'agent_planner',
    name: 'Planner',
    role: 'Planning Agent',
    description: 'Decomposes complex engineering goals into structured execution plans and dependency graphs.',
    capabilities: ['Task Decomposition', 'Dependency Mapping', 'Risk Estimation'],
    stage: 'planning',
  },
  {
    id: 'agent_researcher',
    name: 'Researcher',
    role: 'Research Agent',
    description: 'Investigates repository context, symbols, dependencies, and external documentation.',
    capabilities: ['Symbol Resolution', 'Context Discovery', 'Dependency Analysis'],
    stage: 'investigating',
  },
  {
    id: 'agent_architect',
    name: 'Architect',
    role: 'Architecture Agent',
    description: 'Designs architectural blueprints, system contracts, and module boundaries.',
    capabilities: ['System Design', 'Interface Definition', 'Pattern Enforcement'],
    stage: 'architecting',
  },
  {
    id: 'agent_developer',
    name: 'Developer',
    role: 'Development Agent',
    description: 'Proposes precise code changes, creates safe patch proposals, and fixes verified defects.',
    capabilities: ['Code Generation', 'Patch Synthesis', 'Refactoring'],
    stage: 'developing',
  },
  {
    id: 'agent_tester',
    name: 'Tester',
    role: 'Testing & Verification Agent',
    description: 'Executes test suites and collects authoritative verification evidence from isolated runs.',
    capabilities: ['Test Execution', 'Evidence Collection', 'Regression Checks'],
    stage: 'testing',
  },
  {
    id: 'agent_reviewer',
    name: 'Reviewer',
    role: 'Code Review Agent',
    description: 'Validates code quality, architectural correctness, and human approval compliance.',
    capabilities: ['Diff Inspection', 'Quality Gates', 'Correctness Review'],
    stage: 'reviewing',
  },
  {
    id: 'agent_security',
    name: 'Security',
    role: 'Security & Policy Agent',
    description: 'Enforces tool execution policies, guardrails, and filesystem access boundaries.',
    capabilities: ['Policy Checks', 'Secret Scrubbing', 'Execution Boundaries'],
    stage: 'securing',
  },
]

const agentGradients: Record<string, string> = {
  Planner:    'from-violet-600/10 to-transparent border-violet-500/20',
  Researcher: 'from-blue-600/10 to-transparent border-blue-500/20',
  Architect:  'from-cyan-600/10 to-transparent border-cyan-500/20',
  Developer:  'from-emerald-600/10 to-transparent border-emerald-500/20',
  Tester:     'from-yellow-600/10 to-transparent border-yellow-500/20',
  Reviewer:   'from-orange-600/10 to-transparent border-orange-500/20',
  Security:   'from-red-600/10 to-transparent border-red-500/20',
}

const agentAccent: Record<string, string> = {
  Planner:    'text-violet-400',
  Researcher: 'text-blue-400',
  Architect:  'text-cyan-400',
  Developer:  'text-emerald-400',
  Tester:     'text-yellow-400',
  Reviewer:   'text-orange-400',
  Security:   'text-red-400',
}

export default function AgentsPage() {
  const [runs, setRuns] = useState<ApiRun[]>([])
  const [health, setHealth] = useState<ApiSystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [h, r] = await Promise.all([
        systemApi.health().catch(() => null),
        runApi.list().catch(() => []),
      ])
      if (h) {
        setHealth(h)
        setRuns(r)
        setOffline(false)
      } else {
        setOffline(true)
      }
    } catch {
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Derive agent states from real runs
  const activeRuns = runs.filter((r) => r.status === 'running' || r.status === 'paused')
  const completedRunsCount = runs.filter((r) => r.status === 'success' || (r as any).status === 'completed').length

  const agents = AGENT_DEFS.map((agent) => {
    if (offline) {
      return {
        ...agent,
        status: 'offline' as const,
        runsCompleted: 0,
        lastActive: null,
      }
    }

    // Determine status from active runs
    let status: 'running' | 'idle' | 'paused' = 'idle'
    const matchingActiveRun = activeRuns.find((r) => {
      const canonicalStatus = (r as any).canonical_status || r.status
      return canonicalStatus === agent.stage
    })

    if (matchingActiveRun) {
      status = matchingActiveRun.status === 'paused' ? 'paused' : 'running'
    }

    // Find latest run/activity
    const latestRun = runs[0]
    const lastActive = latestRun?.started_at ?? null

    return {
      ...agent,
      status,
      runsCompleted: completedRunsCount,
      lastActive,
    }
  })

  const runningCount = agents.filter((a) => a.status === 'running').length
  const idleCount = agents.filter((a) => a.status === 'idle').length
  const pausedCount = agents.filter((a) => a.status === 'paused').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Agents</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {offline
              ? 'Backend API offline (http://localhost:4000) · Operational status unavailable'
              : `${runningCount} running · ${idleCount} idle${pausedCount > 0 ? ` · ${pausedCount} paused` : ''} · ${agents.length} registered`}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      {offline && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 text-xs text-yellow-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-400" />
          <span>Backend API is currently offline. Real agent statuses and active runs are unavailable.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => {
          const gradient = agentGradients[agent.name] ?? ''
          const accent   = agentAccent[agent.name]   ?? 'text-zinc-400'

          return (
            <div
              key={agent.id}
              className={`bg-gradient-to-br ${gradient} bg-zinc-900 border rounded-lg p-5 flex flex-col gap-4`}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <StatusDot status={agent.status} animate={agent.status === 'running'} />
                    <h2 className={`text-sm font-semibold ${accent}`}>{agent.name}</h2>
                  </div>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">{agent.role}</p>
                </div>
                <Badge variant={agent.status}>{agent.status}</Badge>
              </div>

              {/* Description */}
              <p className="text-sm text-zinc-400 leading-relaxed flex-1">{agent.description}</p>

              {/* Capabilities */}
              <div>
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Capabilities</p>
                <div className="flex flex-wrap gap-1.5">
                  {agent.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="text-xs text-zinc-500 bg-zinc-800 border border-zinc-700/50 px-2 py-0.5 rounded"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <span className="text-xs text-zinc-600">
                  {offline ? 'Runs: unavailable' : `${agent.runsCompleted} runs recorded`}
                </span>
                {agent.lastActive && (
                  <span className="text-xs text-zinc-600">Active {timeAgo(agent.lastActive)}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
