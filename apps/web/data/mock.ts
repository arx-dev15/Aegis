import type {
  Project, AgentRun, Agent, LogEntry, FileChange,
  TestResult, TimelineStep, ApprovalRequest, ActivityItem, SystemService,
} from '@/types'

export const mockProjects: Project[] = [
  {
    id: '1',
    name: 'aegis-core',
    description: 'Core AI orchestration engine and LangGraph agent workflows for autonomous code generation.',
    status: 'active',
    repo: 'arx-dev15/aegis-core',
    branch: 'main',
    techStack: ['TypeScript', 'Node.js', 'LangGraph', 'PostgreSQL'],
    lastActivity: new Date(Date.now() - 20 * 60000).toISOString(),
    taskCount: 12,
    completedTasks: 8,
    language: 'TypeScript',
  },
  {
    id: '2',
    name: 'aegis-tools',
    description: 'Tool integrations: GitHub, web search, file system, shell execution, and external APIs.',
    status: 'active',
    repo: 'arx-dev15/aegis-tools',
    branch: 'dev',
    techStack: ['TypeScript', 'Python', 'Docker'],
    lastActivity: new Date(Date.now() - 5.5 * 3600000).toISOString(),
    taskCount: 7,
    completedTasks: 5,
    language: 'TypeScript',
  },
  {
    id: '3',
    name: 'api-gateway',
    description: 'REST API gateway with authentication, rate limiting, and WebSocket support.',
    status: 'active',
    repo: 'arx-dev15/api-gateway',
    branch: 'feature/auth',
    techStack: ['TypeScript', 'Express', 'Redis', 'JWT'],
    lastActivity: new Date(Date.now() - 2 * 3600000).toISOString(),
    taskCount: 4,
    completedTasks: 2,
    language: 'TypeScript',
  },
]

export const mockAgentRuns: AgentRun[] = [
  {
    id: 'run-001',
    taskDescription: 'Implement rate limiting middleware with Redis backend and sliding window algorithm',
    projectId: '3',
    projectName: 'api-gateway',
    status: 'running',
    currentAgent: 'Developer',
    startedAt: new Date(Date.now() - 23 * 60000).toISOString(),
    completedAt: null,
    durationSeconds: null,
    filesChanged: 4,
    testsRun: 0,
    testsPassed: 0,
  },
  {
    id: 'run-002',
    taskDescription: 'Add vector similarity search to RAG pipeline using pgvector extension',
    projectId: '1',
    projectName: 'aegis-core',
    status: 'success',
    currentAgent: null,
    startedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    completedAt: new Date(Date.now() - 2.25 * 3600000).toISOString(),
    durationSeconds: 2820,
    filesChanged: 9,
    testsRun: 24,
    testsPassed: 24,
  },
  {
    id: 'run-003',
    taskDescription: 'Refactor GitHub tool to support repository search and branch management',
    projectId: '2',
    projectName: 'aegis-tools',
    status: 'failed',
    currentAgent: null,
    startedAt: new Date(Date.now() - 18 * 3600000).toISOString(),
    completedAt: new Date(Date.now() - 17.6 * 3600000).toISOString(),
    durationSeconds: 1320,
    filesChanged: 3,
    testsRun: 12,
    testsPassed: 9,
  },
  {
    id: 'run-004',
    taskDescription: 'Add Prometheus metrics exporter and Grafana dashboard templates for agent observability',
    projectId: '1',
    projectName: 'aegis-core',
    status: 'pending',
    currentAgent: null,
    startedAt: new Date(Date.now() - 5 * 60000).toISOString(),
    completedAt: null,
    durationSeconds: null,
    filesChanged: 0,
    testsRun: 0,
    testsPassed: 0,
  },
]

export const mockAgents: Agent[] = [
  {
    id: 'agent-planner',
    name: 'Planner',
    role: 'Task Decomposition',
    description: 'Analyzes user requirements and decomposes complex tasks into a structured execution plan with clear milestones and agent assignments.',
    capabilities: ['Task analysis', 'Subtask generation', 'Dependency mapping', 'Priority ordering'],
    status: 'idle',
    lastActive: new Date(Date.now() - 3 * 3600000).toISOString(),
    runsCompleted: 47,
  },
  {
    id: 'agent-researcher',
    name: 'Researcher',
    role: 'Context Gathering',
    description: 'Gathers relevant context by searching documentation, codebases, and web resources to inform the implementation strategy.',
    capabilities: ['Web search', 'Code analysis', 'Documentation parsing', 'Dependency research'],
    status: 'idle',
    lastActive: new Date(Date.now() - 2.9 * 3600000).toISOString(),
    runsCompleted: 39,
  },
  {
    id: 'agent-architect',
    name: 'Architect',
    role: 'System Design',
    description: 'Designs the technical architecture, selects patterns, and creates detailed implementation blueprints for the developer agent.',
    capabilities: ['Architecture design', 'API design', 'Schema modeling', 'Pattern selection'],
    status: 'idle',
    lastActive: new Date(Date.now() - 2.8 * 3600000).toISOString(),
    runsCompleted: 34,
  },
  {
    id: 'agent-developer',
    name: 'Developer',
    role: 'Implementation',
    description: 'Implements features and fixes according to the architecture plan, writing clean, typed, and well-structured code.',
    capabilities: ['Code generation', 'Refactoring', 'Bug fixing', 'File management'],
    status: 'running',
    lastActive: new Date(Date.now() - 2 * 60000).toISOString(),
    runsCompleted: 61,
  },
  {
    id: 'agent-tester',
    name: 'Tester',
    role: 'Quality Assurance',
    description: 'Writes and executes unit, integration, and end-to-end tests to validate the correctness of implemented code.',
    capabilities: ['Unit testing', 'Integration testing', 'Coverage analysis', 'Test generation'],
    status: 'idle',
    lastActive: new Date(Date.now() - 2.3 * 3600000).toISOString(),
    runsCompleted: 58,
  },
  {
    id: 'agent-reviewer',
    name: 'Reviewer',
    role: 'Code Review',
    description: 'Reviews generated code for quality, adherence to best practices, performance issues, and architectural consistency.',
    capabilities: ['Code review', 'Style checking', 'Performance analysis', 'Refactoring suggestions'],
    status: 'idle',
    lastActive: new Date(Date.now() - 2.2 * 3600000).toISOString(),
    runsCompleted: 52,
  },
  {
    id: 'agent-security',
    name: 'Security',
    role: 'Security Auditing',
    description: 'Performs security analysis to identify vulnerabilities, insecure patterns, and potential attack vectors in generated code.',
    capabilities: ['Vulnerability scanning', 'OWASP checks', 'Secret detection', 'Dependency audit'],
    status: 'idle',
    lastActive: new Date(Date.now() - 2.15 * 3600000).toISOString(),
    runsCompleted: 41,
  },
]

export const mockLogs: LogEntry[] = [
  { id: 'log-1', timestamp: new Date(Date.now() - 23 * 60000).toISOString(), level: 'info', agent: 'Planner', message: 'Task received: Implement rate limiting middleware with Redis backend' },
  { id: 'log-2', timestamp: new Date(Date.now() - 22.8 * 60000).toISOString(), level: 'info', agent: 'Planner', message: 'Decomposing task into 5 subtasks: schema design, middleware, Redis integration, tests, docs' },
  { id: 'log-3', timestamp: new Date(Date.now() - 21.5 * 60000).toISOString(), level: 'info', agent: 'Researcher', message: 'Searching codebase for existing middleware patterns...' },
  { id: 'log-4', timestamp: new Date(Date.now() - 21.0 * 60000).toISOString(), level: 'info', agent: 'Researcher', message: 'Found 3 existing middleware files: auth.ts, cors.ts, logger.ts' },
  { id: 'log-5', timestamp: new Date(Date.now() - 20.0 * 60000).toISOString(), level: 'info', agent: 'Researcher', message: 'Scanning npm registry for Redis client packages — selecting ioredis@5.x' },
  { id: 'log-6', timestamp: new Date(Date.now() - 19.0 * 60000).toISOString(), level: 'info', agent: 'Architect', message: 'Designing sliding window algorithm using Redis sorted sets (ZADD/ZRANGEBYSCORE)' },
  { id: 'log-7', timestamp: new Date(Date.now() - 18.5 * 60000).toISOString(), level: 'info', agent: 'Architect', message: 'Architecture ready: RateLimiter class + Express middleware adapter + config types' },
  { id: 'log-8', timestamp: new Date(Date.now() - 17.5 * 60000).toISOString(), level: 'info', agent: 'Developer', message: 'Creating apps/api/middleware/rateLimit.ts...' },
  { id: 'log-9', timestamp: new Date(Date.now() - 16.8 * 60000).toISOString(), level: 'info', agent: 'Developer', message: 'Implementing RedisRateLimiter class with configurable window and max requests' },
  { id: 'log-10', timestamp: new Date(Date.now() - 15.2 * 60000).toISOString(), level: 'warn', agent: 'Developer', message: 'REDIS_TIMEOUT_MS not found in env — falling back to 5000ms default' },
  { id: 'log-11', timestamp: new Date(Date.now() - 14.0 * 60000).toISOString(), level: 'info', agent: 'Developer', message: 'Writing route integration in apps/api/routes/index.ts...' },
  { id: 'log-12', timestamp: new Date(Date.now() - 12.5 * 60000).toISOString(), level: 'error', agent: 'Developer', message: "Type error: Property 'windowMs' is missing in type 'RateLimitConfig' — fixing..." },
  { id: 'log-13', timestamp: new Date(Date.now() - 12.0 * 60000).toISOString(), level: 'info', agent: 'Developer', message: 'Type error resolved. Updated RateLimitConfig interface.' },
  { id: 'log-14', timestamp: new Date(Date.now() - 10.0 * 60000).toISOString(), level: 'info', agent: 'Developer', message: 'Writing apps/api/middleware/rateLimit.test.ts skeleton...' },
  { id: 'log-15', timestamp: new Date(Date.now() - 8.0 * 60000).toISOString(), level: 'info', agent: 'Developer', message: 'Updating .env.example with REDIS_URL, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX...' },
  { id: 'log-16', timestamp: new Date(Date.now() - 6.0 * 60000).toISOString(), level: 'info', agent: 'Developer', message: 'Implementation complete. 4 files written, 235 lines added.' },
]

export const mockFileChanges: FileChange[] = [
  { path: 'apps/api/middleware/rateLimit.ts', status: 'added', additions: 87, deletions: 0 },
  { path: 'apps/api/middleware/rateLimit.test.ts', status: 'added', additions: 112, deletions: 0 },
  { path: 'apps/api/routes/index.ts', status: 'modified', additions: 12, deletions: 2 },
  { path: 'apps/api/types/middleware.ts', status: 'modified', additions: 24, deletions: 5 },
  { path: '.env.example', status: 'modified', additions: 4, deletions: 0 },
]

export const mockTestResults: TestResult[] = [
  { id: 't1', name: 'should allow requests within limit', suite: 'RateLimiter', status: 'passed', durationMs: 45 },
  { id: 't2', name: 'should block requests exceeding limit', suite: 'RateLimiter', status: 'passed', durationMs: 38 },
  { id: 't3', name: 'should reset window after expiry', suite: 'RateLimiter', status: 'passed', durationMs: 52 },
  { id: 't4', name: 'should return correct Retry-After header', suite: 'RateLimiter', status: 'passed', durationMs: 29 },
  { id: 't5', name: 'should handle Redis connection failure gracefully', suite: 'RateLimiter', status: 'failed', durationMs: 5012, errorMessage: 'Expected status 200 but received 503 — Redis failover not implemented' },
  { id: 't6', name: 'should apply per-IP rate limiting', suite: 'RateLimiter', status: 'passed', durationMs: 67 },
  { id: 't7', name: 'should skip rate limiting for whitelisted IPs', suite: 'RateLimiter', status: 'passed', durationMs: 31 },
  { id: 't8', name: 'should work with authenticated requests', suite: 'Integration', status: 'skipped', durationMs: 0 },
]

export const mockTimeline: TimelineStep[] = [
  { id: 'step-1', agent: 'Planner', action: 'Task analysis and decomposition', status: 'completed', startedAt: new Date(Date.now() - 23 * 60000).toISOString(), completedAt: new Date(Date.now() - 21.5 * 60000).toISOString(), durationSeconds: 90, detail: 'Decomposed into 5 subtasks' },
  { id: 'step-2', agent: 'Researcher', action: 'Codebase and documentation research', status: 'completed', startedAt: new Date(Date.now() - 21.5 * 60000).toISOString(), completedAt: new Date(Date.now() - 19 * 60000).toISOString(), durationSeconds: 150, detail: 'Found existing middleware patterns, selected ioredis' },
  { id: 'step-3', agent: 'Architect', action: 'Architecture and algorithm design', status: 'completed', startedAt: new Date(Date.now() - 19 * 60000).toISOString(), completedAt: new Date(Date.now() - 17.5 * 60000).toISOString(), durationSeconds: 90, detail: 'Sliding window via Redis sorted sets' },
  { id: 'step-4', agent: 'Developer', action: 'Implementation', status: 'running', startedAt: new Date(Date.now() - 17.5 * 60000).toISOString(), completedAt: null, durationSeconds: null, detail: '4 files written, pending review' },
  { id: 'step-5', agent: 'Tester', action: 'Test generation and execution', status: 'pending', startedAt: '', completedAt: null, durationSeconds: null },
  { id: 'step-6', agent: 'Reviewer', action: 'Code review', status: 'pending', startedAt: '', completedAt: null, durationSeconds: null },
  { id: 'step-7', agent: 'Security', action: 'Security audit', status: 'pending', startedAt: '', completedAt: null, durationSeconds: null },
]

export const mockApprovalRequests: ApprovalRequest[] = [
  {
    id: 'approval-1',
    type: 'code-review',
    title: 'Review implementation before testing',
    description: 'The Developer agent has completed the rate limiting middleware. Please review the generated code in apps/api/middleware/rateLimit.ts before the Tester agent proceeds.',
    requestedAt: new Date(Date.now() - 6 * 60000).toISOString(),
    status: 'pending',
    requestedBy: 'Reviewer',
  },
]

export const mockActivity: ActivityItem[] = [
  { id: 'act-1', type: 'task_started', description: 'Task started: Implement rate limiting middleware', timestamp: new Date(Date.now() - 23 * 60000).toISOString(), agent: 'Planner' },
  { id: 'act-2', type: 'task_completed', description: 'Task completed: Add vector similarity search to RAG pipeline', timestamp: new Date(Date.now() - 2.25 * 3600000).toISOString(), agent: 'Security' },
  { id: 'act-3', type: 'commit', description: 'Committed: feat: add pgvector similarity search (9 files)', timestamp: new Date(Date.now() - 2.2 * 3600000).toISOString(), metadata: { sha: 'a3f9d21', branch: 'main' } },
  { id: 'act-4', type: 'agent_ran', description: 'Security audit passed — no critical vulnerabilities found', timestamp: new Date(Date.now() - 2.25 * 3600000).toISOString(), agent: 'Security' },
  { id: 'act-5', type: 'approval_required', description: 'Approval requested: Review rate limiter implementation', timestamp: new Date(Date.now() - 6 * 60000).toISOString() },
  { id: 'act-6', type: 'task_started', description: 'Task queued: Add Prometheus metrics and Grafana templates', timestamp: new Date(Date.now() - 5 * 60000).toISOString(), agent: 'Planner' },
]

export const mockSystemStatus: SystemService[] = [
  { name: 'API Server', status: 'online', latencyMs: 12 },
  { name: 'Database', status: 'online', latencyMs: 8 },
  { name: 'Gemini API', status: 'online', latencyMs: 245 },
  { name: 'GitHub', status: 'online', latencyMs: 183 },
  { name: 'Redis', status: 'degraded', latencyMs: 890, detail: 'High latency detected' },
]

export const mockGeneratedPlan = `## Implementation Plan: Rate Limiting Middleware

### Objective
Add sliding-window rate limiting to the Express API server using Redis as the backing store.

### Approach
Use Redis sorted sets (ZADD/ZRANGEBYSCORE) for O(log N) sliding window tracking.

### Files to Create
- \`apps/api/middleware/rateLimit.ts\` — Core RateLimiter class + Express middleware
- \`apps/api/middleware/rateLimit.test.ts\` — Unit + integration tests

### Files to Modify
- \`apps/api/routes/index.ts\` — Apply middleware to protected routes
- \`apps/api/types/middleware.ts\` — Add RateLimitConfig type
- \`.env.example\` — Document new environment variables

### Configuration
\`\`\`env
REDIS_URL=redis://localhost:6379
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
RATE_LIMIT_WHITELIST=127.0.0.1,::1
\`\`\`

### Algorithm
1. On each request, compute window start = now - windowMs
2. Remove stale entries: ZREMRANGEBYSCORE key 0 windowStart
3. Count remaining: ZCARD key
4. If count >= max → reject with 429
5. Otherwise add current timestamp: ZADD key now now
6. Set TTL: EXPIRE key windowMs/1000`
