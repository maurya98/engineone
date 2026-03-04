-- Commits (first, so branches can reference)
CREATE TABLE IF NOT EXISTS commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  parent_commit_id UUID REFERENCES commits(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commits_repo ON commits(repo_id);
CREATE INDEX IF NOT EXISTS idx_commits_parent ON commits(parent_commit_id);

-- Tree at each commit (path -> blob)
CREATE TABLE IF NOT EXISTS commit_trees (
  commit_id UUID NOT NULL REFERENCES commits(id) ON DELETE CASCADE,
  path VARCHAR(1024) NOT NULL,
  blob_id VARCHAR(255) NOT NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('file', 'folder')),
  PRIMARY KEY (commit_id, path)
);

CREATE INDEX IF NOT EXISTS idx_commit_trees_commit ON commit_trees(commit_id);

-- Branches (head_commit_id can be null until first commit)
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  head_commit_id UUID REFERENCES commits(id),
  is_protected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (repo_id, name)
);

CREATE INDEX IF NOT EXISTS idx_branches_repo ON branches(repo_id);
