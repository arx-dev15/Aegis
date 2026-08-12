export interface Project {
  id: string
  name: string
  description: string
  repo: string
  branch: string
  tech_stack: string
  language: string
  status: 'active' | 'paused' | 'archived'
  task_count: number
  completed_tasks: number
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  project_id: string
  description: string
  execution_mode: 'automatic' | 'semi-auto' | 'manual'
  priority: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface AgentRun {
  id: string
  task_id: string
  project_id: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'paused' | 'cancelled'
  current_agent?: string
  execution_mode: 'automatic' | 'semi-auto' | 'manual'
  files_changed: number
  tests_run: number
  tests_passed: number
  started_at: string
  completed_at: string | null
  duration_seconds?: number
  created_at: string
}

export interface RunEvent {
  id: string
  run_id: string
  level: 'info' | 'warn' | 'error' | 'debug'
  agent: string
  message: string
  metadata: Record<string, unknown>
  timestamp: string
}

export interface ProjectFile {
  id: string
  run_id: string
  path: string
  status: 'added' | 'modified' | 'deleted'
  additions: number
  deletions: number
  diff_content: string | null
  created_at: string
}

export interface Approval {
  id: string
  run_id: string
  type: 'code-review' | 'deployment' | 'security-check'
  title: string
  description: string
  requested_by: string
  status: 'pending' | 'approved' | 'rejected'
  resolution: string | null
  requested_at: string
  resolved_at: string | null
}

export interface ActivityItem {
  id: string
  type: string
  description: string
  agent?: string
  metadata: Record<string, unknown>
  project_id: string | null
  run_id: string | null
  timestamp: string
}

export const memProjects: Record<string, Project> = {}
export const memTasks: Record<string, Task> = {}
export const memRuns: Record<string, AgentRun> = {}
export const memEvents: Record<string, RunEvent[]> = {}
export const memFiles: Record<string, ProjectFile[]> = {}
export const memApprovals: Record<string, Approval> = {}
export const memActivity: ActivityItem[] = []
