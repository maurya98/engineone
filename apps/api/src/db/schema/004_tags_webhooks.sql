-- Tags (point to a commit)
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  commit_id UUID NOT NULL REFERENCES commits(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (repo_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_repo ON tags(repo_id);

-- Webhooks (trigger on push/MR/merge)
CREATE TABLE IF NOT EXISTS repo_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  url VARCHAR(2048) NOT NULL,
  events VARCHAR(255) NOT NULL DEFAULT 'push',
  secret VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repo_webhooks_repo ON repo_webhooks(repo_id);
