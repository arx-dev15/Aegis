/**
 * seed.ts — populates the in-memory store with demo data on startup.
 *
 * Only runs when SKIP_DB=true (in-memory mode).
 * Call seedDemoData() once after the server starts.
 */

import { v4 as uuidv4 } from 'uuid'
import {
  memProjects,
  memTasks,
  memRuns,
  memEvents,
  memFiles,
  memActivity,
  Project,
  Task,
  AgentRun,
  RunEvent,
  ProjectFile,
  ActivityItem,
} from './services/memoryStore'

export function seedDemoData() {
  // Don't seed if data already exists (e.g. hot-reload)
  if (Object.keys(memProjects).length > 0) return

  const now = new Date()
  const ago = (mins: number) => new Date(now.getTime() - mins * 60_000).toISOString()

  // ── Projects ────────────────────────────────────────────────────────────────

  const p1: Project = {
    id: 'proj-1',
    name: 'aegis-core',
    description: 'Core AI orchestration engine and LangGraph agent workflows.',
    repo: 'arx-dev15/aegis-core',
    branch: 'main',
    tech_stack: JSON.stringify(['TypeScript', 'Node.js', 'LangGraph', 'PostgreSQL']),
    language: 'TypeScript',
    status: 'active',
    task_count: 3,
    completed_tasks: 1,
    created_at: ago(2 * 24 * 60),
    updated_at: ago(20),
  }

  const p2: Project = {
    id: 'proj-2',
    name: 'aegis-tools',
    description: 'Tool integrations: GitHub, web search, file system, shell execution.',
    repo: 'arx-dev15/aegis-tools',
    branch: 'dev',
    tech_stack: JSON.stringify(['TypeScript', 'Python', 'Docker']),
    language: 'TypeScript',
    status: 'active',
    task_count: 2,
    completed_tasks: 1,
    created_at: ago(5 * 24 * 60),
    updated_at: ago(5 * 60),
  }

  const p3: Project = {
    id: 'proj-3',
    name: 'api-gateway',
    description: 'REST API gateway with authentication, rate limiting, and WebSocket support.',
    repo: 'arx-dev15/api-gateway',
    branch: 'feature/auth',
    tech_stack: JSON.stringify(['TypeScript', 'Express', 'Redis', 'JWT']),
    language: 'TypeScript',
    status: 'active',
    task_count: 2,
    completed_tasks: 0,
    created_at: ago(1 * 24 * 60),
    updated_at: ago(2 * 60),
  }

  memProjects['proj-1'] = p1
  memProjects['proj-2'] = p2
  memProjects['proj-3'] = p3

  // ── Tasks ───────────────────────────────────────────────────────────────────

  const t1: Task = {
    id: 'task-1',
    project_id: 'proj-3',
    description: 'Implement rate limiting middleware with Redis backend and sliding window algorithm',
    execution_mode: 'semi-auto',
    priority: 4,
    status: 'running',
    created_at: ago(23),
    updated_at: ago(5),
  }

  const t2: Task = {
    id: 'task-2',
    project_id: 'proj-1',
    description: 'Add vector similarity search to RAG pipeline using pgvector extension',
    execution_mode: 'automatic',
    priority: 3,
    status: 'completed',
    created_at: ago(3 * 60),
    updated_at: ago(2 * 60 + 15),
  }

  const t3: Task = {
    id: 'task-3',
    project_id: 'proj-2',
    description: 'Refactor GitHub tool to support repository search and branch management',
    execution_mode: 'semi-auto',
    priority: 2,
    status: 'failed',
    created_at: ago(18 * 60),
    updated_at: ago(17 * 60 + 36),
  }

  const t4: Task = {
    id: 'task-4',
    project_id: 'proj-1',
    description: 'Add Prometheus metrics exporter and Grafana dashboard templates',
    execution_mode: 'manual',
    priority: 2,
    status: 'pending',
    created_at: ago(5),
    updated_at: ago(5),
  }

  memTasks['task-1'] = t1
  memTasks['task-2'] = t2
  memTasks['task-3'] = t3
  memTasks['task-4'] = t4

  // ── Agent Runs ──────────────────────────────────────────────────────────────

  const r1: AgentRun = {
    id: 'run-1',
    task_id: 'task-1',
    project_id: 'proj-3',
    status: 'running',
    current_agent: 'Developer',
    execution_mode: 'semi-auto',
    files_changed: 4,
    tests_run: 0,
    tests_passed: 0,
    started_at: ago(23),
    completed_at: null,
    created_at: ago(23),
  }

  const r2: AgentRun = {
    id: 'run-2',
    task_id: 'task-2',
    project_id: 'proj-1',
    status: 'success',
    execution_mode: 'automatic',
    files_changed: 9,
    tests_run: 24,
    tests_passed: 24,
    started_at: ago(3 * 60),
    completed_at: ago(2 * 60 + 15),
    duration_seconds: 2820,
    created_at: ago(3 * 60),
  }

  const r3: AgentRun = {
    id: 'run-3',
    task_id: 'task-3',
    project_id: 'proj-2',
    status: 'failed',
    execution_mode: 'semi-auto',
    files_changed: 3,
    tests_run: 12,
    tests_passed: 9,
    started_at: ago(18 * 60),
    completed_at: ago(17 * 60 + 36),
    duration_seconds: 1320,
    created_at: ago(18 * 60),
  }

  memRuns['run-1'] = r1
  memRuns['run-2'] = r2
  memRuns['run-3'] = r3

  // ── Run Events (timeline for run-1) ─────────────────────────────────────────

  const events1: RunEvent[] = [
    { id: uuidv4(), run_id: 'run-1', level: 'info',  agent: 'Planner',    message: 'Task received: Implement rate limiting middleware with Redis backend', metadata: {}, timestamp: ago(23) },
    { id: uuidv4(), run_id: 'run-1', level: 'info',  agent: 'Planner',    message: 'Decomposed into 5 subtasks: schema, middleware, Redis, tests, docs', metadata: {}, timestamp: ago(22.8) },
    { id: uuidv4(), run_id: 'run-1', level: 'info',  agent: 'Researcher', message: 'Searching codebase for existing middleware patterns...', metadata: {}, timestamp: ago(21.5) },
    { id: uuidv4(), run_id: 'run-1', level: 'info',  agent: 'Researcher', message: 'Found 3 existing middleware files: auth.ts, cors.ts, logger.ts', metadata: {}, timestamp: ago(21) },
    { id: uuidv4(), run_id: 'run-1', level: 'info',  agent: 'Architect',  message: 'Designing sliding window algorithm using Redis sorted sets (ZADD/ZRANGEBYSCORE)', metadata: {}, timestamp: ago(19) },
    { id: uuidv4(), run_id: 'run-1', level: 'info',  agent: 'Architect',  message: 'Architecture ready: RateLimiter class + Express middleware adapter', metadata: {}, timestamp: ago(18.5) },
    { id: uuidv4(), run_id: 'run-1', level: 'info',  agent: 'Developer',  message: 'Creating apps/api/middleware/rateLimit.ts...', metadata: {}, timestamp: ago(17.5) },
    { id: uuidv4(), run_id: 'run-1', level: 'warn',  agent: 'Developer',  message: 'REDIS_TIMEOUT_MS not found in env — falling back to 5000ms default', metadata: {}, timestamp: ago(15.2) },
    { id: uuidv4(), run_id: 'run-1', level: 'error', agent: 'Developer',  message: "Type error: Property 'windowMs' is missing in type 'RateLimitConfig' — fixing...", metadata: {}, timestamp: ago(12.5) },
    { id: uuidv4(), run_id: 'run-1', level: 'info',  agent: 'Developer',  message: 'Type error resolved. Updated RateLimitConfig interface.', metadata: {}, timestamp: ago(12) },
    { id: uuidv4(), run_id: 'run-1', level: 'info',  agent: 'Developer',  message: 'Implementation complete. 4 files written, 235 lines added.', metadata: {}, timestamp: ago(6) },
  ]

  memEvents['run-1'] = events1
  memEvents['run-2'] = []
  memEvents['run-3'] = []

  // ── Run Files (for run-1) ───────────────────────────────────────────────────

  const files1: ProjectFile[] = [
    { id: uuidv4(), run_id: 'run-1', path: 'apps/api/middleware/rateLimit.ts',      status: 'added',    additions: 87,  deletions: 0, diff_content: null, created_at: ago(10) },
    { id: uuidv4(), run_id: 'run-1', path: 'apps/api/middleware/rateLimit.test.ts', status: 'added',    additions: 112, deletions: 0, diff_content: null, created_at: ago(9) },
    { id: uuidv4(), run_id: 'run-1', path: 'apps/api/routes/index.ts',              status: 'modified', additions: 12,  deletions: 2, diff_content: null, created_at: ago(8) },
    { id: uuidv4(), run_id: 'run-1', path: '.env.example',                          status: 'modified', additions: 4,   deletions: 0, diff_content: null, created_at: ago(7) },
  ]

  memFiles['run-1'] = files1
  memFiles['run-2'] = []
  memFiles['run-3'] = []

  // ── Activity feed ────────────────────────────────────────────────────────────

  const activity: ActivityItem[] = [
    { id: uuidv4(), type: 'task_started',    description: 'Task started: Implement rate limiting middleware',           agent: 'Planner',    metadata: {}, project_id: 'proj-3', run_id: 'run-1', timestamp: ago(23) },
    { id: uuidv4(), type: 'task_completed',  description: 'Task completed: Add vector similarity search to RAG pipeline', agent: 'Security',  metadata: {}, project_id: 'proj-1', run_id: 'run-2', timestamp: ago(2 * 60 + 15) },
    { id: uuidv4(), type: 'commit',          description: 'Committed: feat: add pgvector similarity search (9 files)',   metadata: { sha: 'a3f9d21', branch: 'main' }, project_id: 'proj-1', run_id: 'run-2', timestamp: ago(2 * 60 + 12) },
    { id: uuidv4(), type: 'agent_ran',       description: 'Security audit passed — no critical vulnerabilities found',   agent: 'Security',  metadata: {}, project_id: 'proj-1', run_id: 'run-2', timestamp: ago(2 * 60 + 20) },
    { id: uuidv4(), type: 'approval_required', description: 'Approval requested: Review rate limiter implementation',   metadata: {}, project_id: 'proj-3', run_id: 'run-1', timestamp: ago(6) },
    { id: uuidv4(), type: 'task_started',    description: 'Task queued: Add Prometheus metrics and Grafana templates',   agent: 'Planner',   metadata: {}, project_id: 'proj-1', run_id: null,    timestamp: ago(5) },
  ]

  memActivity.push(...activity)

  console.log('🌱 Seeded demo data: 3 projects, 4 tasks, 3 runs, 11 events, 4 files, 6 activity items')
}
