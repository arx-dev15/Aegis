import { mockAgents } from '@/data/mock'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const agentColors: Record<string, string> = {
  Planner: 'from-violet-600/10 to-transparent border-violet-500/20',
  Researcher: 'from-blue-600/10 to-transparent border-blue-500/20',
  Architect: 'from-cyan-600/10 to-transparent border-cyan-500/20',
  Developer: 'from-emerald-600/10 to-transparent border-emerald-500/20',
  Tester: 'from-yellow-600/10 to-transparent border-yellow-500/20',
  Reviewer: 'from-orange-600/10 to-transparent border-orange-500/20',
  Security: 'from-red-600/10 to-transparent border-red-500/20',
}

const agentAccent: Record<string, string> = {
  Planner: 'text-violet-400',
  Researcher: 'text-blue-400',
  Architect: 'text-cyan-400',
  Developer: 'text-emerald-400',
  Tester: 'text-yellow-400',
  Reviewer: 'text-orange-400',
  Security: 'text-red-400',
}

export default function AgentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Agents</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {mockAgents.filter((a) => a.status === 'running').length} running ·{' '}
          {mockAgents.filter((a) => a.status === 'idle').length} idle ·{' '}
          {mockAgents.length} total
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {mockAgents.map((agent) => {
          const gradient = agentColors[agent.name] ?? ''
          const accent = agentAccent[agent.name] ?? 'text-zinc-400'

          return (
            <div
              key={agent.id}
              className={`bg-gradient-to-br ${gradient} bg-zinc-900 border rounded-lg p-5 flex flex-col gap-4`}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <StatusDot status={agent.status} animate />
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
                  {agent.runsCompleted} runs completed
                </span>
                {agent.lastActive && (
                  <span className="text-xs text-zinc-600">
                    Active {timeAgo(agent.lastActive)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
