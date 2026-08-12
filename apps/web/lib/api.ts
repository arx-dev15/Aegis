/**
 * Aegis API Client
 *
 * A simple fetch-based client that talks to the Express backend.
 * All functions return the inner `data` from the response envelope: { data: T }
 * On error, they throw an Error with the server's message (or a fallback).
 */

// Base URL can be overridden via NEXT_PUBLIC_API_URL env var.
// Default: http://localhost:4000/api
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000') + '/api'

// ── Shared helper ──────────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // 204 No Content — nothing to parse
  if (res.status === 204) return undefined as unknown as T

  const json = await res.json()

  if (!res.ok) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`
    throw new Error(msg)
  }

  return json.data as T
}

const get  = <T>(path: string)              => request<T>('GET', path)
const post = <T>(path: string, body: unknown) => request<T>('POST', path, body)
const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body)
const del  = <T>(path: string)              => request<T>('DELETE', path)

// ── Types that mirror the backend memoryStore / DB shape ────────────────────

export interface ApiProject {
  id: string
  name: string
  description: string
  repo: string
  branch: string
  tech_stack: string       // JSON string e.g. '["TypeScript","Node.js"]'
  language: string
  status: 'active' | 'paused' | 'archived'
  task_count: number
  completed_tasks: number
  created_at: string
  updated_at: string
}

export interface ApiTask {
  id: string
  project_id: string
  description: string
  execution_mode: 'automatic' | 'semi-auto' | 'manual'
  priority: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface ApiRunEvent {
  id: string
  run_id: string
  level: 'info' | 'warn' | 'error' | 'debug'
  agent: string
  message: string
  metadata: Record<string, unknown>
  timestamp: string
}

export interface ApiProjectFile {
  id: string
  run_id: string
  path: string
  status: 'added' | 'modified' | 'deleted'
  additions: number
  deletions: number
  diff_content: string | null
  created_at: string
}

export interface ApiRun {
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
  // Included in GET /runs/:id (SKIP_DB mode)
  events?: ApiRunEvent[]
  files?: ApiProjectFile[]
}

export interface ApiApproval {
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

export interface ApiActivity {
  id: string
  type: string
  description: string
  agent?: string
  metadata: Record<string, unknown>
  project_id: string | null
  run_id: string | null
  timestamp: string
}

// ── Project API ─────────────────────────────────────────────────────────────

export const projectApi = {
  /** GET /api/projects */
  list: () => get<ApiProject[]>('/projects'),

  /** GET /api/projects/:id */
  get: (id: string) => get<ApiProject>(`/projects/${id}`),

  /** POST /api/projects */
  create: (body: {
    name: string
    description?: string
    repo?: string
    branch?: string
    techStack?: string[]
    language?: string
  }) => post<ApiProject>('/projects', body),

  /** PATCH /api/projects/:id */
  update: (id: string, body: Partial<{
    name: string
    description: string
    repo: string
    branch: string
    techStack: string[]
    language: string
    status: 'active' | 'paused' | 'archived'
  }>) => patch<ApiProject>(`/projects/${id}`, body),

  /** DELETE /api/projects/:id */
  delete: (id: string) => del<void>(`/projects/${id}`),

  /** GET /api/projects/:projectId/tasks */
  tasks: (projectId: string) => get<ApiTask[]>(`/projects/${projectId}/tasks`),
}

// ── Task API ─────────────────────────────────────────────────────────────────

export const taskApi = {
  /** GET /api/tasks/:id */
  get: (id: string) => get<ApiTask>(`/tasks/${id}`),

  /** POST /api/tasks */
  create: (body: {
    projectId: string
    description: string
    executionMode?: 'automatic' | 'semi-auto' | 'manual'
    priority?: number
  }) => post<ApiTask>('/tasks', body),

  /** PATCH /api/tasks/:id/status */
  updateStatus: (id: string, status: ApiTask['status']) =>
    patch<ApiTask>(`/tasks/${id}/status`, { status }),

  /** POST /api/tasks/:taskId/runs */
  createRun: (taskId: string, executionMode?: ApiRun['execution_mode']) =>
    post<ApiRun>(`/tasks/${taskId}/runs`, { executionMode: executionMode ?? 'semi-auto' }),
}

// ── Run API ──────────────────────────────────────────────────────────────────

export const runApi = {
  /** GET /api/runs/:id — includes events[] and files[] in SKIP_DB mode */
  get: (id: string) => get<ApiRun>(`/runs/${id}`),

  /** GET /api/runs/:id/status */
  status: (id: string) =>
    get<{ id: string; status: string; currentAgent?: string }>(`/runs/${id}/status`),

  /** GET /api/runs/:runId/files */
  files: (runId: string) => get<ApiProjectFile[]>(`/runs/${runId}/files`),

  /** GET /api/tasks/:taskId/runs — all runs for a task (most recent first) */
  listForTask: (taskId: string) => get<ApiRun[]>(`/tasks/${taskId}/runs`),
}

// ── Approval API ─────────────────────────────────────────────────────────────

export const approvalApi = {
  /** GET /api/approvals/:id */
  get: (id: string) => get<ApiApproval>(`/approvals/${id}`),

  /** PATCH /api/approvals/:id — approve or reject */
  resolve: (id: string, action: 'approve' | 'reject', reason?: string) =>
    patch<ApiApproval>(`/approvals/${id}`, { action, reason }),
}

// ── Activity API ──────────────────────────────────────────────────────────────

export const activityApi = {
  /** GET /api/activity?limit=N */
  list: (limit = 50) => get<ApiActivity[]>(`/activity?limit=${limit}`),
}
