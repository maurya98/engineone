import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch, apiFetchText } from '../../lib/api';
import { Modal } from '../Modal';
import { useTheme } from '../../context/ThemeContext';
import { JdmConfigProvider, DecisionGraph, calculateDiffGraph } from '@gorules/jdm-editor';
import type { DecisionGraphType } from '@gorules/jdm-editor';
import '@gorules/jdm-editor/dist/style.css';
import './PullRequestTab.css';

export interface MergeRequestItem {
  id: string;
  repo_id: string;
  source_branch_id: string;
  target_branch_id: string;
  source_branch_name: string;
  target_branch_name: string;
  title: string;
  description: string | null;
  status: string;
  author_id: string;
  merge_commit_id: string | null;
  created_at: string;
  updated_at: string;
}

interface BranchItem {
  id: string;
  name: string;
}

interface PullRequestTabProps {
  repoId: string;
  defaultBranch: string;
}

interface CompareChange {
  path: string;
  change: 'add' | 'modify' | 'delete';
  base_blob_id?: string;
  head_blob_id?: string;
}

const EMPTY_GRAPH: DecisionGraphType = { nodes: [], edges: [] };

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'merged', label: 'Merged' },
  { value: 'closed', label: 'Closed' },
];

export default function PullRequestTab({ repoId, defaultBranch }: PullRequestTabProps) {
  const [mergeRequests, setMergeRequests] = useState<MergeRequestItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedMr, setSelectedMr] = useState<MergeRequestItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createSourceBranch, setCreateSourceBranch] = useState(defaultBranch);
  const [createTargetBranch, setCreateTargetBranch] = useState(defaultBranch);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [mergeSubmitting, setMergeSubmitting] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [compareChanges, setCompareChanges] = useState<CompareChange[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null);
  const [diffGraph, setDiffGraph] = useState<DecisionGraphType | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

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
    try {
      const data = await apiFetch<{ branches: BranchItem[] }>(`/repos/${repoId}/branches`);
      setBranches(data.branches || []);
    } catch {
      setBranches([]);
    }
  }, [repoId]);

  const loadMergeRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      const data = await apiFetch<{ merge_requests: MergeRequestItem[] }>(
        `/repos/${repoId}/merge_requests${qs ? `?${qs}` : ''}`
      );
      setMergeRequests(data.merge_requests || []);
    } catch {
      setMergeRequests([]);
    } finally {
      setLoading(false);
    }
  }, [repoId, statusFilter]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    loadMergeRequests();
  }, [loadMergeRequests]);

  const loadDiffGraph = useCallback(async () => {
    if (!selectedMr || !selectedDiffPath) {
      setDiffGraph(null);
      setDiffError(null);
      return;
    }
    const baseBranch = selectedMr.target_branch_name;
    const headBranch = selectedMr.source_branch_name;
    const path = selectedDiffPath;
    setDiffLoading(true);
    setDiffError(null);
    try {
      let baseContent = '';
      let headContent = '';
      const baseUrl = `/repos/${repoId}/files?branch=${encodeURIComponent(baseBranch)}&path=${encodeURIComponent(path)}`;
      const headUrl = `/repos/${repoId}/files?branch=${encodeURIComponent(headBranch)}&path=${encodeURIComponent(path)}`;
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
  }, [repoId, selectedMr, selectedDiffPath]);

  useEffect(() => {
    loadDiffGraph();
  }, [loadDiffGraph]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const trimmedTitle = createTitle.trim();
    if (!trimmedTitle) {
      setCreateError('Title is required');
      return;
    }
    if (createSourceBranch === createTargetBranch) {
      setCreateError('Source and target branch must be different');
      return;
    }
    setCreateSubmitting(true);
    try {
      await apiFetch(`/repos/${repoId}/merge_requests`, {
        method: 'POST',
        body: JSON.stringify({
          source_branch: createSourceBranch,
          target_branch: createTargetBranch,
          title: trimmedTitle,
          description: createDescription.trim() || undefined,
        }),
      });
      setCreateOpen(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreateSourceBranch(defaultBranch);
      setCreateTargetBranch(defaultBranch);
      loadMergeRequests();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create pull request');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openDetail = useCallback(
    async (mr: MergeRequestItem) => {
      setSelectedMr(mr);
      setEditTitle(mr.title);
      setEditDescription(mr.description ?? '');
      setEditStatus(mr.status);
      setEditError(null);
      setMergeError(null);
      setCompareChanges([]);
      setSelectedDiffPath(null);
      setDiffGraph(null);
      setDiffError(null);
      setDetailLoading(true);
      try {
        const data = await apiFetch<{
          merge_request: MergeRequestItem;
          watchers: string[];
        }>(`/repos/${repoId}/merge_requests/${mr.id}`);
        setSelectedMr(data.merge_request);
        setEditTitle(data.merge_request.title);
        setEditDescription(data.merge_request.description ?? '');
        setEditStatus(data.merge_request.status);

        setCompareLoading(true);
        try {
          const compareData = await apiFetch<{ changes: CompareChange[] }>(
            `/repos/${repoId}/compare?base=${encodeURIComponent(data.merge_request.target_branch_name)}&head=${encodeURIComponent(data.merge_request.source_branch_name)}`
          );
          const changes = compareData.changes || [];
          setCompareChanges(changes);
          const jsonChanges = changes.filter((c) => c.path.toLowerCase().endsWith('.json'));
          const defaultPath = jsonChanges.find((c) => c.path.toLowerCase() === 'index.json')?.path ?? jsonChanges[0]?.path ?? null;
          setSelectedDiffPath(defaultPath);
        } catch {
          setCompareChanges([]);
        } finally {
          setCompareLoading(false);
        }
      } catch {
        setEditError('Failed to load pull request');
      } finally {
        setDetailLoading(false);
      }
    },
    [repoId]
  );

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMr) return;
    setEditError(null);
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setEditError('Title is required');
      return;
    }
    setEditSubmitting(true);
    try {
      const data = await apiFetch<{ merge_request: MergeRequestItem | null }>(
        `/repos/${repoId}/merge_requests/${selectedMr.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: trimmedTitle,
            description: editDescription.trim() || undefined,
            status: editStatus as 'open' | 'closed',
          }),
        }
      );
      if (data.merge_request) {
        setSelectedMr({ ...data.merge_request, source_branch_name: selectedMr.source_branch_name, target_branch_name: selectedMr.target_branch_name });
      }
      loadMergeRequests();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update pull request');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedMr || selectedMr.status !== 'open') return;
    setMergeError(null);
    setMergeSubmitting(true);
    try {
      const data = await apiFetch<{ merge_request: MergeRequestItem }>(
        `/repos/${repoId}/merge_requests/${selectedMr.id}/merge`,
        { method: 'POST' }
      );
      setSelectedMr({
        ...data.merge_request,
        source_branch_name: selectedMr.source_branch_name,
        target_branch_name: selectedMr.target_branch_name,
      });
      loadMergeRequests();
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Failed to merge');
    } finally {
      setMergeSubmitting(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="pr-tab">
      <div className="pr-toolbar">
        <div className="pr-filters">
          <select
            className="pr-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="pr-btn-primary"
          onClick={() => {
            setCreateOpen(true);
            setCreateError(null);
            setCreateTitle('');
            setCreateDescription('');
            setCreateSourceBranch(defaultBranch);
            setCreateTargetBranch(defaultBranch);
          }}
        >
          New pull request
        </button>
      </div>

      {loading ? (
        <div className="pr-loading">Loading pull requests…</div>
      ) : (
        <div className="pr-list-layout">
          <ul className="pr-list" aria-label="Pull requests">
            {mergeRequests.length === 0 ? (
              <li className="pr-empty">No pull requests match the current filters.</li>
            ) : (
              mergeRequests.map((mr) => (
                <li
                  key={mr.id}
                  className={`pr-list-item ${selectedMr?.id === mr.id ? 'selected' : ''}`}
                  onClick={() => openDetail(mr)}
                >
                  <span className="pr-item-status" data-status={mr.status}>
                    {mr.status}
                  </span>
                  <div className="pr-item-main">
                    <span className="pr-item-title">{mr.title}</span>
                    <span className="pr-item-meta">
                      {mr.source_branch_name} → {mr.target_branch_name} · {formatDate(mr.created_at)}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>

          {selectedMr && (
            <aside className="pr-detail-panel">
              {detailLoading ? (
                <div className="pr-loading">Loading…</div>
              ) : (
                <>
                  <div className="pr-detail-header">
                    <h3 className="pr-detail-title">Pull request</h3>
                    <button
                      type="button"
                      className="pr-btn-icon"
                      onClick={() => setSelectedMr(null)}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                  <div className="pr-detail-branches">
                    {selectedMr.source_branch_name} → {selectedMr.target_branch_name}
                  </div>

                  {compareLoading ? (
                    <p className="pr-detail-meta">Loading changes…</p>
                  ) : compareChanges.length > 0 ? (
                    <>
                      <h4 className="pr-diff-heading">Changes</h4>
                      <ul className="pr-diff-files" aria-label="Changed files">
                        {compareChanges
                          .filter((c) => c.path.toLowerCase().endsWith('.json'))
                          .map((c) => (
                            <li key={c.path} className="pr-diff-file">
                              <button
                                type="button"
                                className={`pr-diff-file-btn ${selectedDiffPath === c.path ? 'selected' : ''}`}
                                onClick={() => setSelectedDiffPath(c.path)}
                              >
                                <span className="pr-diff-file-change" data-change={c.change}>
                                  {c.change}
                                </span>
                                <span className="pr-diff-file-path">{c.path}</span>
                              </button>
                            </li>
                          ))}
                      </ul>
                      {selectedDiffPath && (
                        <>
                          <h4 className="pr-diff-heading">Graph diff — {selectedDiffPath}</h4>
                          {diffLoading ? (
                            <p className="pr-detail-meta">Loading graph…</p>
                          ) : diffError ? (
                            <p className="pr-error">{diffError}</p>
                          ) : diffGraph && (diffGraph.nodes?.length > 0 || diffGraph.edges?.length > 0) ? (
                            <div className="pr-jdm-editor-wrap">
                              <JdmConfigProvider theme={jdmTheme}>
                                <DecisionGraph
                                  value={diffGraph}
                                  onChange={() => {}}
                                  disabled
                                />
                              </JdmConfigProvider>
                            </div>
                          ) : (
                            <p className="pr-detail-meta">No graph nodes in this file, or file is empty.</p>
                          )}
                        </>
                      )}
                    </>
                  ) : selectedMr && !detailLoading ? (
                    <p className="pr-detail-meta">No file changes between branches.</p>
                  ) : null}

                  <form onSubmit={handleUpdateSubmit} className="pr-detail-form">
                    <label htmlFor="pr-edit-title">Title</label>
                    <input
                      id="pr-edit-title"
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={500}
                      disabled={editSubmitting || selectedMr.status === 'merged'}
                      className="pr-input"
                    />
                    <label htmlFor="pr-edit-description">Description</label>
                    <textarea
                      id="pr-edit-description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      disabled={editSubmitting || selectedMr.status === 'merged'}
                      className="pr-textarea"
                    />
                    {selectedMr.status !== 'merged' && (
                      <>
                        <label htmlFor="pr-edit-status">Status</label>
                        <select
                          id="pr-edit-status"
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          disabled={editSubmitting}
                          className="pr-select"
                        >
                          <option value="open">Open</option>
                          <option value="closed">Closed</option>
                        </select>
                      </>
                    )}
                    <div className="pr-detail-meta">
                      Created {formatDate(selectedMr.created_at)}
                    </div>
                    {editError && <p className="pr-error">{editError}</p>}
                    {mergeError && <p className="pr-error">{mergeError}</p>}
                    <div className="pr-detail-actions">
                      {selectedMr.status === 'open' && (
                        <button
                          type="button"
                          className="pr-btn-merge"
                          onClick={handleMerge}
                          disabled={mergeSubmitting}
                        >
                          {mergeSubmitting ? 'Merging…' : 'Merge'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="pr-btn-secondary"
                        onClick={() => setSelectedMr(null)}
                      >
                        Cancel
                      </button>
                      {selectedMr.status !== 'merged' && (
                        <button
                          type="submit"
                          className="pr-btn-primary"
                          disabled={editSubmitting}
                        >
                          {editSubmitting ? 'Saving…' : 'Save changes'}
                        </button>
                      )}
                    </div>
                  </form>
                </>
              )}
            </aside>
          )}
        </div>
      )}

      {createOpen && (
        <Modal title="New pull request" onClose={() => setCreateOpen(false)}>
          <form onSubmit={handleCreateSubmit} className="modal-form">
            <label htmlFor="pr-create-source">Source branch</label>
            <select
              id="pr-create-source"
              value={createSourceBranch}
              onChange={(e) => setCreateSourceBranch(e.target.value)}
              disabled={createSubmitting}
              className="pr-select modal-form-select"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
            <label htmlFor="pr-create-target">Target branch</label>
            <select
              id="pr-create-target"
              value={createTargetBranch}
              onChange={(e) => setCreateTargetBranch(e.target.value)}
              disabled={createSubmitting}
              className="pr-select modal-form-select"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                  {b.name === defaultBranch ? ' (default)' : ''}
                </option>
              ))}
            </select>
            <label htmlFor="pr-create-title">Title</label>
            <input
              id="pr-create-title"
              type="text"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="Pull request title"
              autoFocus
              disabled={createSubmitting}
              maxLength={500}
            />
            <label htmlFor="pr-create-description">Description (optional)</label>
            <textarea
              id="pr-create-description"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="Describe the changes…"
              rows={3}
              disabled={createSubmitting}
              className="modal-form-textarea"
            />
            {createError && <p className="modal-error">{createError}</p>}
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="modal-btn secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="modal-btn primary"
                disabled={createSubmitting}
              >
                {createSubmitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
