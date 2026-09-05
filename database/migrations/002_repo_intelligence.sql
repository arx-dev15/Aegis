-- Aegis Repository Intelligence Schema
-- Migration: 002_repo_intelligence.sql

CREATE TABLE IF NOT EXISTS repositories (
  id                VARCHAR(200) PRIMARY KEY,
  provider          VARCHAR(50) NOT NULL,
  owner             VARCHAR(100) NOT NULL,
  name              VARCHAR(100) NOT NULL,
  url               TEXT NOT NULL,
  default_branch    VARCHAR(100) DEFAULT 'main',
  analyzed_revision VARCHAR(100) DEFAULT 'HEAD',
  commit_sha        VARCHAR(100) DEFAULT 'latest',
  status            VARCHAR(50) DEFAULT 'ready',
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repository_snapshots (
  repo_id           VARCHAR(200) PRIMARY KEY REFERENCES repositories(id) ON DELETE CASCADE,
  snapshot_data     JSONB NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repository_files (
  id                VARCHAR(200) PRIMARY KEY,
  repo_id           VARCHAR(200) NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  path              TEXT NOT NULL,
  category          VARCHAR(50) NOT NULL,
  language          VARCHAR(50) NOT NULL,
  lines             INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS repository_symbols (
  id                VARCHAR(200) PRIMARY KEY,
  repo_id           VARCHAR(200) NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_path         TEXT NOT NULL,
  name              VARCHAR(200) NOT NULL,
  kind              VARCHAR(50) NOT NULL,
  start_line        INT NOT NULL,
  end_line          INT NOT NULL,
  exported          BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS repository_edges (
  id                VARCHAR(200) PRIMARY KEY,
  repo_id           VARCHAR(200) NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  source_id         VARCHAR(200) NOT NULL,
  target_id         VARCHAR(200) NOT NULL,
  type              VARCHAR(50) NOT NULL,
  confidence        VARCHAR(20) DEFAULT 'exact',
  provenance        JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_repo_files_repo_id   ON repository_files(repo_id);
CREATE INDEX IF NOT EXISTS idx_repo_syms_repo_id    ON repository_symbols(repo_id);
CREATE INDEX IF NOT EXISTS idx_repo_syms_name       ON repository_symbols(name);
CREATE INDEX IF NOT EXISTS idx_repo_edges_repo_id   ON repository_edges(repo_id);
CREATE INDEX IF NOT EXISTS idx_repo_edges_source    ON repository_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_repo_edges_target    ON repository_edges(target_id);
