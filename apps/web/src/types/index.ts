export type ProjectStatus = 'active' | 'paused' | 'archived'
export type RunStatus = 'running' | 'success' | 'failed' | 'pending' | 'paused'
export type AgentStatus = 'running' | 'idle' | 'error' | 'offline'
export type AgentName = 'Planner' | 'Researcher' | 'Architect' | 'Developer' | 'Tester' | 'Reviewer' | 'Security'
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'
export type FileChangeStatus = 'added' | 'modified' | 'deleted'
export type TestStatus = 'passed' | 'failed' | 'skipped'
export type TimelineStepStatus = 'completed' | 'running' | 'pending' | 'failed'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  repo: string
  branch: string
  techStack: string[]
  lastActivity: string
  taskCount: number
  completedTasks: number
  language: string
}

export interface AgentRun {
  id: string
  taskDescription: string
  projectId: string
  projectName: string
  status: RunStatus
  currentAgent: AgentName | null
  startedAt: string
  completedAt: string | null
  durationSeconds: number | null
  filesChanged: number
  testsRun: number
  testsPassed: number
}

export interface Agent {
  id: string
  name: AgentName
  role: string
  description: string
  capabilities: string[]
  status: AgentStatus
  lastActive: string | null
  runsCompleted: number
}

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  agent: AgentName
  message: string
}

export interface FileChange {
  path: string
  status: FileChangeStatus
  additions: number
  deletions: number
}

export interface TestResult {
  id: string
  name: string
  suite: string
  status: TestStatus
  durationMs: number
  errorMessage?: string
}

export interface TimelineStep {
  id: string
  agent: AgentName
  action: string
  status: TimelineStepStatus
  startedAt: string
  completedAt: string | null
  durationSeconds: number | null
  detail?: string
}

export interface ApprovalRequest {
  id: string
  type: 'code-review' | 'deployment' | 'security-check'
  title: string
  description: string
  requestedAt: string
  status: ApprovalStatus
  requestedBy: AgentName
}

export interface ActivityItem {
  id: string
  type: 'task_started' | 'task_completed' | 'agent_ran' | 'file_changed' | 'commit' | 'approval_required'
  description: string
  timestamp: string
  agent?: AgentName
  metadata?: Record<string, string>
}

export interface SystemService {
  name: string
  status: 'online' | 'offline' | 'degraded'
  latencyMs?: number
  detail?: string
}
