import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import { Modal } from '../Modal';
import './IssueTab.css';

export interface IssueItem {
  id: string;
  repo_id: string;
  branch_id: string;
  branch_name: string;
  title: string;
  description: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface BranchItem {
  id: string;
  name: string;
}

interface IssueTabProps {
  repoId: string;
  defaultBranch: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export default function IssueTab({ repoId, defaultBranch }: IssueTabProps) {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState(defaultBranch);
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<IssueItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createBranch, setCreateBranch] = useState(defaultBranch);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const loadBranches = useCallback(async () => {
    try {
      const data = await apiFetch<{ branches: BranchItem[] }>(`/repos/${repoId}/branches`);
      setBranches(data.branches || []);
    } catch {
      setBranches([]);
    }
  }, [repoId]);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchFilter) params.set('branch', branchFilter);
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      const data = await apiFetch<{ issues: IssueItem[] }>(
        `/repos/${repoId}/issues${qs ? `?${qs}` : ''}`
      );
      setIssues(data.issues || []);
    } catch {
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [repoId, branchFilter, statusFilter]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const trimmedTitle = createTitle.trim();
    if (!trimmedTitle) {
      setCreateError('Title is required');
      return;
    }
    setCreateSubmitting(true);
    try {
      await apiFetch(`/repos/${repoId}/issues`, {
        method: 'POST',
        body: JSON.stringify({
          branch: createBranch,
          title: trimmedTitle,
          description: createDescription.trim() || undefined,
        }),
      });
      setCreateOpen(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreateBranch(defaultBranch);
      loadIssues();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create issue');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openDetail = useCallback(
    async (issue: IssueItem) => {
      setSelectedIssue(issue);
      setEditTitle(issue.title);
      setEditDescription(issue.description ?? '');
      setEditStatus(issue.status);
      setEditError(null);
      setDetailLoading(true);
      try {
        const data = await apiFetch<{ issue: IssueItem }>(`/repos/${repoId}/issues/${issue.id}`);
        setSelectedIssue(data.issue);
        setEditTitle(data.issue.title);
        setEditDescription(data.issue.description ?? '');
        setEditStatus(data.issue.status);
      } catch {
        setEditError('Failed to load issue');
      } finally {
        setDetailLoading(false);
      }
    },
    [repoId]
  );

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue) return;
    setEditError(null);
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setEditError('Title is required');
      return;
    }
    setEditSubmitting(true);
    try {
      await apiFetch(`/repos/${repoId}/issues/${selectedIssue.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: trimmedTitle,
          description: editDescription.trim() || undefined,
          status: editStatus,
        }),
      });
      setSelectedIssue(null);
      loadIssues();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update issue');
    } finally {
      setEditSubmitting(false);
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
    <div className="issue-tab">
      <div className="issue-toolbar">
        <div className="issue-filters">
          <select
            className="issue-select"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            aria-label="Filter by branch"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            className="issue-select"
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
          className="issue-btn-primary"
          onClick={() => {
            setCreateOpen(true);
            setCreateError(null);
            setCreateTitle('');
            setCreateDescription('');
            setCreateBranch(defaultBranch);
          }}
        >
          New issue
        </button>
      </div>

      {loading ? (
        <div className="issue-loading">Loading issues…</div>
      ) : (
        <div className="issue-list-layout">
          <ul className="issue-list" aria-label="Issues">
            {issues.length === 0 ? (
              <li className="issue-empty">No issues match the current filters.</li>
            ) : (
              issues.map((issue) => (
                <li
                  key={issue.id}
                  className={`issue-list-item ${selectedIssue?.id === issue.id ? 'selected' : ''}`}
                  onClick={() => openDetail(issue)}
                >
                  <span className="issue-item-status" data-status={issue.status}>
                    {issue.status}
                  </span>
                  <div className="issue-item-main">
                    <span className="issue-item-title">{issue.title}</span>
                    <span className="issue-item-meta">
                      {issue.branch_name} · {formatDate(issue.created_at)}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>

          {selectedIssue && (
            <aside className="issue-detail-panel">
              {detailLoading ? (
                <div className="issue-loading">Loading…</div>
              ) : (
                <>
                  <div className="issue-detail-header">
                    <h3 className="issue-detail-title">Issue detail</h3>
                    <button
                      type="button"
                      className="issue-btn-icon"
                      onClick={() => setSelectedIssue(null)}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                  <form onSubmit={handleUpdateSubmit} className="issue-detail-form">
                    <label htmlFor="issue-edit-title">Title</label>
                    <input
                      id="issue-edit-title"
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={500}
                      disabled={editSubmitting}
                      className="issue-input"
                    />
                    <label htmlFor="issue-edit-description">Description</label>
                    <textarea
                      id="issue-edit-description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      disabled={editSubmitting}
                      className="issue-textarea"
                    />
                    <label htmlFor="issue-edit-status">Status</label>
                    <select
                      id="issue-edit-status"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      disabled={editSubmitting}
                      className="issue-select"
                    >
                      <option value="open">Open</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                    <div className="issue-detail-meta">
                      Branch: {selectedIssue.branch_name ?? '—'} · Created{' '}
                      {formatDate(selectedIssue.created_at)}
                    </div>
                    {editError && <p className="issue-error">{editError}</p>}
                    <div className="issue-detail-actions">
                      <button
                        type="button"
                        className="issue-btn-secondary"
                        onClick={() => setSelectedIssue(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="issue-btn-primary"
                        disabled={editSubmitting}
                      >
                        {editSubmitting ? 'Saving…' : 'Save changes'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </aside>
          )}
        </div>
      )}

      {createOpen && (
        <Modal title="New issue" onClose={() => setCreateOpen(false)}>
          <form onSubmit={handleCreateSubmit} className="modal-form">
            <label htmlFor="issue-create-branch">Branch</label>
            <select
              id="issue-create-branch"
              value={createBranch}
              onChange={(e) => setCreateBranch(e.target.value)}
              disabled={createSubmitting}
              className="issue-select modal-form-select"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
            <label htmlFor="issue-create-title">Title</label>
            <input
              id="issue-create-title"
              type="text"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="Issue title"
              autoFocus
              disabled={createSubmitting}
              maxLength={500}
            />
            <label htmlFor="issue-create-description">Description (optional)</label>
            <textarea
              id="issue-create-description"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="Describe the issue…"
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
