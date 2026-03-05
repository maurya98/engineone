import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch, apiFetchText } from '../../lib/api';
import { Modal } from '../Modal';
import { useTheme } from '../../context/ThemeContext';
import { JdmConfigProvider, DecisionGraph, calculateDiffGraph } from '@gorules/jdm-editor';
import type { DecisionGraphType } from '@gorules/jdm-editor';
import '@gorules/jdm-editor/dist/style.css';
import './BranchTab.css';

export interface BranchItem {
  id: string;
  repo_id: string;
  name: string;
  head_commit_id: string | null;
  is_protected: boolean;
  created_at: string;
  is_default?: boolean;
}

interface BranchTabProps {
  repoId: string;
  defaultBranch: string;
}

interface CompareChange {
  path: string;
  change: 'add' | 'modify' | 'delete';
  base_blob_id?: string;
  head_blob_id?: string;
}

interface CommitItem {
  id: string;
  message: string;
  created_at: string;
  author_email?: string;
  parent_commit_id: string | null;
}

const COMMITS_PER_PAGE = 15;
const EMPTY_GRAPH: DecisionGraphType = { nodes: [], edges: [] };

function shortCommitId(id: string | null): string {
  if (!id) return '—';
  return id.slice(0, 7);
}

export default function BranchTab({ repoId, defaultBranch }: BranchTabProps) {
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<BranchItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSource, setCreateSource] = useState(defaultBranch);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [protectSubmitting, setProtectSubmitting] = useState(false);
  const [protectError, setProtectError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<BranchItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [commitDiffCommitId, setCommitDiffCommitId] = useState<string | null>(null);
  const [commitDiffParentId, setCommitDiffParentId] = useState<string | null>(null);
  const [compareChanges, setCompareChanges] = useState<CompareChange[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null);
  const [diffGraph, setDiffGraph] = useState<DecisionGraphType | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [commitPage, setCommitPage] = useState(1);

  const { effectiveTheme } = useTheme();
  const jdmTheme = useMemo(() => {
    const isDark = effectiveTheme === 'dark';
    return {
      mode: effectiveTheme as 'light' | 'dark',
      token: {
        colorPrimary: isDark ? '#58a6ff' : '#0969da',
        colorPrimaryHover: isDark ? '#79b8ff' : '#0550ae',
        colorPrimaryActive: isDark ? '#388bfd' : '#0969da',
        colorBgLayout: isDark ? '#0f1117' : '#ffffff',
        colorBgContainer: isDark ? '#0f1117' : '#ffffff',
        colorBgElevated: isDark ? '#161b22' : '#f6f8fa',
        colorText: isDark ? '#e6edf3' : '#1f2328',
        colorTextSecondary: isDark ? '#8b949e' : '#656d76',
        colorTextPlaceholder: isDark ? '#6e7681' : '#8c959f',
        colorBorder: isDark ? '#30363d' : '#d0d7de',
        colorBorderSecondary: isDark ? '#21262d' : '#d8dee4',
      },
    };
  }, [effectiveTheme]);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ branches: BranchItem[] }>(`/repos/${repoId}/branches`);
      setBranches(data.branches || []);
    } catch {
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const loadCommits = useCallback(async () => {
    if (!selectedBranch?.name) {
      setCommits([]);
      return;
    }
    setCommitsLoading(true);
    try {
      const data = await apiFetch<{ commits: CommitItem[] }>(
        `/repos/${repoId}/commits?branch=${encodeURIComponent(selectedBranch.name)}&limit=100`
      );
      setCommits(data.commits || []);
      setCommitPage(1);
    } catch {
      setCommits([]);
    } finally {
      setCommitsLoading(false);
    }
  }, [repoId, selectedBranch?.name]);

  useEffect(() => {
    loadCommits();
  }, [loadCommits]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const trimmedName = createName.trim();
    if (!trimmedName) {
      setCreateError('Branch name is required');
      return;
    }
    setCreateSubmitting(true);
    try {
      await apiFetch(`/repos/${repoId}/branches`, {
        method: 'POST',
        body: JSON.stringify({ name: trimmedName, source: createSource }),
      });
      setCreateOpen(false);
      setCreateName('');
      setCreateSource(defaultBranch);
      loadBranches();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create branch');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleToggleProtected = async () => {
    if (!selectedBranch) return;
    setProtectError(null);
    setProtectSubmitting(true);
    try {
      const updated = await apiFetch<{ branch: BranchItem }>(
        `/repos/${repoId}/branches/${encodeURIComponent(selectedBranch.name)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ is_protected: !selectedBranch.is_protected }),
        }
      );
      setSelectedBranch(updated.branch);
      setBranches((prev) =>
        prev.map((b) => (b.id === updated.branch.id ? { ...b, is_protected: updated.branch.is_protected } : b))
      );
    } catch (err) {
      setProtectError(err instanceof Error ? err.message : 'Failed to update branch');
    } finally {
      setProtectSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      await apiFetch(
        `/repos/${repoId}/branches/${encodeURIComponent(deleteConfirm.name)}`,
        { method: 'DELETE' }
      );
      if (selectedBranch?.id === deleteConfirm.id) setSelectedBranch(null);
      setDeleteConfirm(null);
      loadBranches();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete branch');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleCommitIdClick = useCallback(
    async (commitId: string) => {
      setCommitDiffCommitId(commitId);
      setCommitDiffParentId(null);
      setCompareChanges([]);
      setSelectedDiffPath(null);
      setDiffGraph(null);
      setDiffError(null);
      try {
        const data = await apiFetch<{ commit: { parent_commit_id: string | null } }>(
          `/repos/${repoId}/commits/${commitId}`
        );
        const parentId = data.commit?.parent_commit_id ?? null;
        setCommitDiffParentId(parentId);
        if (!parentId) return;
        setCompareLoading(true);
        try {
          const compareData = await apiFetch<{ changes: CompareChange[] }>(
            `/repos/${repoId}/compare?base=${encodeURIComponent(parentId)}&head=${encodeURIComponent(commitId)}`
          );
          const changes = compareData.changes || [];
          setCompareChanges(changes);
          const jsonChanges = changes.filter((c) => c.path.toLowerCase().endsWith('.json'));
          const defaultPath =
            jsonChanges.find((c) => c.path.toLowerCase() === 'index.json')?.path ?? jsonChanges[0]?.path ?? null;
          setSelectedDiffPath(defaultPath);
        } catch {
          setCompareChanges([]);
        } finally {
          setCompareLoading(false);
        }
      } catch {
        setCommitDiffParentId(null);
      }
    },
    [repoId]
  );

  const loadDiffGraph = useCallback(async () => {
    if (!commitDiffCommitId || !commitDiffParentId || !selectedDiffPath) {
      setDiffGraph(null);
      setDiffError(null);
      return;
    }
    const path = selectedDiffPath;
    setDiffLoading(true);
    setDiffError(null);
    try {
      let baseContent = '';
      let headContent = '';
      const baseUrl = `/repos/${repoId}/files?commit=${encodeURIComponent(commitDiffParentId)}&path=${encodeURIComponent(path)}`;
      const headUrl = `/repos/${repoId}/files?commit=${encodeURIComponent(commitDiffCommitId)}&path=${encodeURIComponent(path)}`;
      try {
        baseContent = await apiFetchText(baseUrl);
      } catch {
        baseContent = '';
      }
      try {
        headContent = await apiFetchText(headUrl);
      } catch {
        headContent = '';
      }
      const parseGraph = (raw: string): DecisionGraphType => {
        if (!raw?.trim()) return EMPTY_GRAPH;
        try {
          const parsed = JSON.parse(raw) as { nodes?: unknown[]; edges?: unknown[] };
          if (Array.isArray(parsed?.nodes) && Array.isArray(parsed?.edges)) {
            return { nodes: parsed.nodes, edges: parsed.edges };
          }
        } catch {
          /* ignore */
        }
        return EMPTY_GRAPH;
      };
      const baseGraph = parseGraph(baseContent);
      const headGraph = parseGraph(headContent);
      const graphWithDiff = calculateDiffGraph(headGraph, baseGraph);
      setDiffGraph(graphWithDiff);
    } catch (err) {
      setDiffError(err instanceof Error ? err.message : 'Failed to load diff');
      setDiffGraph(null);
    } finally {
      setDiffLoading(false);
    }
  }, [repoId, commitDiffCommitId, commitDiffParentId, selectedDiffPath]);

  useEffect(() => {
    loadDiffGraph();
  }, [loadDiffGraph]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const isDefaultBranch = (b: BranchItem) => b.name === defaultBranch || b.is_default;

  const totalCommitPages = Math.max(1, Math.ceil(commits.length / COMMITS_PER_PAGE));
  const paginatedCommits = useMemo(() => {
    const start = (commitPage - 1) * COMMITS_PER_PAGE;
    return commits.slice(start, start + COMMITS_PER_PAGE);
  }, [commits, commitPage]);

  return (
    <div className="branch-tab">
      <div className="branch-toolbar">
        <button
          type="button"
          className="branch-btn-primary"
          onClick={() => {
            setCreateOpen(true);
            setCreateError(null);
            setCreateName('');
            setCreateSource(defaultBranch);
          }}
        >
          New branch
        </button>
      </div>

      {loading ? (
        <div className="branch-loading">Loading branches…</div>
      ) : (
        <div className="branch-three-col">
          {/* Left: branches (15%) */}
          <div className="branch-col branch-col-branches" style={{ width: '15%' }}>
            <h3 className="branch-col-title">Branches</h3>
            <ul className="branch-list" aria-label="Branches">
              {branches.length === 0 ? (
                <li className="branch-empty">No branches yet.</li>
              ) : (
                branches.map((b) => (
                  <li
                    key={b.id}
                    className={`branch-list-item ${selectedBranch?.id === b.id ? 'selected' : ''}`}
                    onClick={() => setSelectedBranch(b)}
                  >
                    <span className="branch-item-name">{b.name}</span>
                    <span className="branch-item-meta">
                      {isDefaultBranch(b) && <span className="branch-badge branch-badge-default">default</span>}
                      {b.is_protected && <span className="branch-badge branch-badge-protected">protected</span>}
                    </span>
                  </li>
                ))
              )}
            </ul>
            {selectedBranch && !isDefaultBranch(selectedBranch) && (
              <div className="branch-col-actions">
                <label className="branch-detail-toggle">
                  <input
                    type="checkbox"
                    checked={selectedBranch.is_protected}
                    onChange={handleToggleProtected}
                    disabled={protectSubmitting}
                  />
                  <span>Protected</span>
                </label>
                {protectError && <p className="branch-error">{protectError}</p>}
                <button
                  type="button"
                  className="branch-btn-danger branch-btn-small"
                  onClick={() => setDeleteConfirm(selectedBranch)}
                >
                  Delete branch
                </button>
              </div>
            )}
          </div>

          {/* Middle: commits (15%) */}
          <div className="branch-col branch-col-commits" style={{ width: '15%' }}>
            <h3 className="branch-col-title">
              {selectedBranch ? `Commits · ${selectedBranch.name}` : 'Commits'}
            </h3>
            {!selectedBranch ? (
              <p className="branch-col-muted">Select a branch</p>
            ) : commitsLoading ? (
              <p className="branch-col-muted">Loading…</p>
            ) : commits.length === 0 ? (
              <p className="branch-col-muted">No commits</p>
            ) : (
              <>
                <ul className="branch-commits-list" aria-label="Commits">
                  {paginatedCommits.map((c) => (
                    <li key={c.id} className="branch-commit-row">
                      <button
                        type="button"
                        className={`branch-commit-row-btn ${commitDiffCommitId === c.id ? 'selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCommitIdClick(c.id);
                        }}
                        title={`${c.id}\n${c.message}`}
                      >
                        <span className="branch-commit-id branch-commit-id-mono">{shortCommitId(c.id)}</span>
                        <span className="branch-commit-message" title={c.message}>
                          {c.message.split('\n')[0].slice(0, 40)}
                          {(c.message.split('\n')[0].length > 40 || c.message.includes('\n')) && '…'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {totalCommitPages > 1 && (
                  <div className="branch-commits-pagination" role="navigation" aria-label="Commit list pagination">
                    <button
                      type="button"
                      className="branch-pagination-btn"
                      onClick={() => setCommitPage((p) => Math.max(1, p - 1))}
                      disabled={commitPage <= 1}
                      aria-label="Previous page"
                    >
                      Prev
                    </button>
                    <span className="branch-pagination-info">
                      {commitPage} / {totalCommitPages}
                    </span>
                    <button
                      type="button"
                      className="branch-pagination-btn"
                      onClick={() => setCommitPage((p) => Math.min(totalCommitPages, p + 1))}
                      disabled={commitPage >= totalCommitPages}
                      aria-label="Next page"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: diff (70%) */}
          <div className="branch-col branch-col-diff" style={{ width: '70%' }}>
            <h3 className="branch-col-title">Changes</h3>
            <div className="branch-col-diff-body">
            {!commitDiffCommitId ? (
              <p className="branch-col-muted">Select a commit to view diff</p>
            ) : !commitDiffParentId ? (
              <p className="branch-col-muted">No parent commit (root commit).</p>
            ) : compareLoading ? (
              <p className="branch-col-muted">Loading changes…</p>
            ) : compareChanges.length === 0 ? (
              <p className="branch-col-muted">No file changes in this commit.</p>
            ) : (
              <>
                <div className="branch-diff-header">
                  <span className="branch-diff-title">
                    Commit {shortCommitId(commitDiffCommitId)} vs parent
                  </span>
                  <button
                    type="button"
                    className="branch-btn-icon branch-diff-close"
                    onClick={() => {
                      setCommitDiffCommitId(null);
                      setCommitDiffParentId(null);
                      setCompareChanges([]);
                      setSelectedDiffPath(null);
                      setDiffGraph(null);
                    }}
                    aria-label="Close diff"
                  >
                    ×
                  </button>
                </div>
                <ul className="branch-diff-files" aria-label="Changed files">
                  {compareChanges
                    .filter((c) => c.path.toLowerCase().endsWith('.json'))
                    .map((c) => (
                      <li key={c.path} className="branch-diff-file">
                        <button
                          type="button"
                          className={`branch-diff-file-btn ${selectedDiffPath === c.path ? 'selected' : ''}`}
                          onClick={() => setSelectedDiffPath(c.path)}
                        >
                          <span className="branch-diff-file-change" data-change={c.change}>
                            {c.change}
                          </span>
                          <span className="branch-diff-file-path">{c.path}</span>
                        </button>
                      </li>
                    ))}
                </ul>
                {selectedDiffPath && (
                  <>
                    <h4 className="branch-diff-heading">Graph diff — {selectedDiffPath}</h4>
                    {diffLoading ? (
                      <p className="branch-col-muted">Loading graph…</p>
                    ) : diffError ? (
                      <p className="branch-error">{diffError}</p>
                    ) : diffGraph &&
                      (diffGraph.nodes?.length > 0 || diffGraph.edges?.length > 0) ? (
                      <div className="branch-jdm-wrap">
                        <JdmConfigProvider theme={jdmTheme}>
                          <DecisionGraph value={diffGraph} onChange={() => {}} disabled />
                        </JdmConfigProvider>
                      </div>
                    ) : (
                      <p className="branch-col-muted">No graph nodes in this file.</p>
                    )}
                  </>
                    )}
                  </>
                )}
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <Modal title="New branch" onClose={() => setCreateOpen(false)}>
          <form onSubmit={handleCreateSubmit} className="branch-modal-form">
            <label htmlFor="branch-create-name">Branch name</label>
            <input
              id="branch-create-name"
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. feature/my-feature"
              autoFocus
              disabled={createSubmitting}
              className="branch-input"
            />
            <label htmlFor="branch-create-source">Create from</label>
            <select
              id="branch-create-source"
              value={createSource}
              onChange={(e) => setCreateSource(e.target.value)}
              disabled={createSubmitting}
              className="branch-select"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                  {isDefaultBranch(b) ? ' (default)' : ''}
                </option>
              ))}
            </select>
            {createError && <p className="branch-error">{createError}</p>}
            <div className="branch-modal-actions">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="branch-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="branch-btn-primary"
                disabled={createSubmitting}
              >
                {createSubmitting ? 'Creating…' : 'Create branch'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal
          title="Delete branch"
          onClose={() => {
            if (!deleteSubmitting) {
              setDeleteConfirm(null);
              setDeleteError(null);
            }
          }}
        >
          <p className="branch-delete-message">
            Delete branch <strong>{deleteConfirm.name}</strong>? This cannot be undone.
          </p>
          {deleteError && <p className="branch-error">{deleteError}</p>}
          <div className="branch-modal-actions">
            <button
              type="button"
              onClick={() => {
                setDeleteConfirm(null);
                setDeleteError(null);
              }}
              className="branch-btn-secondary"
              disabled={deleteSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              className="branch-btn-danger"
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
