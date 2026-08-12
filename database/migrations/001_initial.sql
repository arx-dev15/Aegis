-- Aegis Database Schema
-- Migration: 001_initial.sql

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100) NOT NULL,
  description  TEXT DEFAULT '',
  repo         VARCHAR(200) DEFAULT '',
  branch       VARCHAR(100) DEFAULT 'main',
  tech_stack   JSONB DEFAULT '[]',
  language     VARCHAR(50) DEFAULT '',
  status       VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  task_count   INT DEFAULT 0,
  completed_tasks INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description    TEXT NOT NULL,
  execution_mode VARCHAR(20) DEFAULT 'semi-auto' CHECK (execution_mode IN ('automatic', 'semi-auto', 'manual')),
  priority       INT DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  status         VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'paused', 'cancelled')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Agent runs
CREATE TABLE IF NOT EXISTS agent_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status         VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'success', 'failed', 'paused', 'cancelled')),
  current_agent  VARCHAR(50),
  execution_mode VARCHAR(20) DEFAULT 'semi-auto',
  files_changed  INT DEFAULT 0,
  tests_run      INT DEFAULT 0,
  tests_passed   INT DEFAULT 0,
  started_at     TIMESTAMPTZ DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  duration_seconds INT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Run events (agent logs / timeline steps)
CREATE TABLE IF NOT EXISTS run_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  level      VARCHAR(10) DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error', 'debug')),
  agent      VARCHAR(50) NOT NULL,
  message    TEXT NOT NULL,
  metadata   JSONB DEFAULT '{}',
  timestamp  TIMESTAMPTZ DEFAULT NOW()
);

-- Project files (changed files per run)
CREATE TABLE IF NOT EXISTS project_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  path         VARCHAR(500) NOT NULL,
  status       VARCHAR(10) CHECK (status IN ('added', 'modified', 'deleted')),
  additions    INT DEFAULT 0,
  deletions    INT DEFAULT 0,
  diff_content TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Approvals
CREATE TABLE IF NOT EXISTS approvals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  type         VARCHAR(30) CHECK (type IN ('code-review', 'deployment', 'security-check')),
  title        VARCHAR(200) NOT NULL,
  description  TEXT DEFAULT '',
  requested_by VARCHAR(50),
  status       VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolution   TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

-- Activity feed
CREATE TABLE IF NOT EXISTS activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  agent       VARCHAR(50),
  metadata    JSONB DEFAULT '{}',
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  run_id      UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  timestamp   TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_project_id    ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_task_id        ON agent_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_runs_project_id     ON agent_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_events_run_id       ON run_events(run_id);
CREATE INDEX IF NOT EXISTS idx_files_run_id        ON project_files(run_id);
CREATE INDEX IF NOT EXISTS idx_approvals_run_id    ON approvals(run_id);
CREATE INDEX IF NOT EXISTS idx_activity_project_id ON activity(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp  ON activity(timestamp DESC);

-- Update project task counts automatically
CREATE OR REPLACE FUNCTION update_project_task_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects
  SET
    task_count = (SELECT COUNT(*) FROM tasks WHERE project_id = NEW.project_id),
    completed_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = NEW.project_id AND status = 'completed'),
    updated_at = NOW()
  WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_project_counts ON tasks;
CREATE TRIGGER trg_update_project_counts
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_project_task_counts();
