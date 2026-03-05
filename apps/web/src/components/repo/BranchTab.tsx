import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import { Modal } from '../Modal';
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
        <div className="branch-list-layout">
          <ul className="branch-list" aria-label="Branches">
            {branches.length === 0 ? (
              <li className="branch-empty">No branches yet. Create one from the default branch.</li>
            ) : (
              branches.map((b) => (
                <li
                  key={b.id}
                  className={`branch-list-item ${selectedBranch?.id === b.id ? 'selected' : ''}`}
                  onClick={() => setSelectedBranch(b)}
                >
                  <div className="branch-item-main">
                    <span className="branch-item-name">{b.name}</span>
                    <span className="branch-item-meta">
                      {isDefaultBranch(b) && <span className="branch-badge branch-badge-default">default</span>}
                      {b.is_protected && <span className="branch-badge branch-badge-protected">protected</span>}
                      {' · '}
                      {formatDate(b.created_at)}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>

          {selectedBranch && (
            <aside className="branch-detail-panel">
              <div className="branch-detail-header">
                <h3 className="branch-detail-title">{selectedBranch.name}</h3>
                <button
                  type="button"
                  className="branch-btn-icon"
                  onClick={() => setSelectedBranch(null)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="branch-detail-body">
                <p className="branch-detail-meta">
                  Created {formatDate(selectedBranch.created_at)}
                  {isDefaultBranch(selectedBranch) && (
                    <>
                      {' · '}
                      <span className="branch-badge branch-badge-default">default</span>
                    </>
                  )}
                </p>
                {!isDefaultBranch(selectedBranch) && (
                  <>
                    <div className="branch-detail-actions">
                      <label className="branch-detail-toggle">
                        <input
                          type="checkbox"
                          checked={selectedBranch.is_protected}
                          onChange={handleToggleProtected}
                          disabled={protectSubmitting}
                        />
                        <span>Protected (maintainer-only commits)</span>
                      </label>
                      {protectError && <p className="branch-error">{protectError}</p>}
                    </div>
                    <div className="branch-detail-actions">
                      <button
                        type="button"
                        className="branch-btn-danger"
                        onClick={() => setDeleteConfirm(selectedBranch)}
                      >
                        Delete branch
                      </button>
                    </div>
                  </>
                )}
              </div>
            </aside>
          )}
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
