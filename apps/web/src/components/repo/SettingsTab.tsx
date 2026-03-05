import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { Modal } from '../Modal';
import './SettingsTab.css';

export interface RepoSettings {
  name: string;
  default_branch_name: string;
}

export interface RepoMemberItem {
  user_id: string;
  role: string;
  email: string;
}

interface BranchItem {
  id: string;
  name: string;
}

interface SettingsTabProps {
  repoId: string;
  repo: RepoSettings;
  onRepoUpdate: (repo: RepoSettings) => void;
}

const ROLE_OPTIONS = [
  { value: 'qa', label: 'QA' },
  { value: 'developer', label: 'Developer' },
  { value: 'maintainer', label: 'Maintainer' },
];

function isValidUuid(s: string): boolean {
  const u =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return u.test(s.trim());
}

export default function SettingsTab({ repoId, repo, onRepoUpdate }: SettingsTabProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const [isMaintainer, setIsMaintainer] = useState<boolean | null>(null);
  const [members, setMembers] = useState<RepoMemberItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [name, setName] = useState(repo.name);
  const [defaultBranchName, setDefaultBranchName] = useState(repo.default_branch_name);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [generalSaving, setGeneralSaving] = useState(false);

  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState<'maintainer' | 'developer' | 'qa'>('developer');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [removeUserId, setRemoveUserId] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const loadMembers = useCallback(async () => {
    try {
      const data = await apiFetch<{ members: RepoMemberItem[] }>(
        `/repos/${repoId}/members`
      );
      setMembers(data.members || []);
      setIsMaintainer(true);
    } catch {
      setIsMaintainer(false);
      setMembers([]);
    }
  }, [repoId]);

  const loadBranches = useCallback(async () => {
    try {
      const data = await apiFetch<{ branches: BranchItem[] }>(
        `/repos/${repoId}/branches`
      );
      setBranches(data.branches || []);
    } catch {
      setBranches([]);
    }
  }, [repoId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (isMaintainer) {
      loadBranches();
    }
  }, [isMaintainer, loadBranches]);

  useEffect(() => {
    setName(repo.name);
    setDefaultBranchName(repo.default_branch_name);
  }, [repo.name, repo.default_branch_name]);

  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    const trimmedName = name.trim();
    const trimmedBranch = defaultBranchName.trim();
    if (!trimmedName) {
      setGeneralError('Repository name is required');
      return;
    }
    if (!trimmedBranch) {
      setGeneralError('Default branch is required');
      return;
    }
    setGeneralSaving(true);
    try {
      const data = await apiFetch<{ repository: RepoSettings }>(`/repos/${repoId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: trimmedName,
          default_branch_name: trimmedBranch,
        }),
      });
      onRepoUpdate(data.repository);
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to update repository');
    } finally {
      setGeneralSaving(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const uid = addUserId.trim();
    if (!uid) {
      setAddError('User ID is required');
      return;
    }
    if (!isValidUuid(uid)) {
      setAddError('Enter a valid UUID (e.g. from workspace or user list)');
      return;
    }
    setAddSubmitting(true);
    try {
      await apiFetch(`/repos/${repoId}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: uid, role: addRole }),
      });
      setAddUserId('');
      setAddRole('developer');
      loadMembers();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setAddError(null);
    setRemoveUserId(userId);
    try {
      await apiFetch(`/repos/${repoId}/members/${userId}`, {
        method: 'DELETE',
      });
      loadMembers();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemoveUserId(null);
    }
  };

  const handleDeleteRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmName !== repo.name) {
      setDeleteError('Type the repository name to confirm');
      return;
    }
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      await apiFetch(`/repos/${repoId}`, { method: 'DELETE' });
      setDeleteConfirmOpen(false);
      setDeleteConfirmName('');
      if (workspaceId) {
        navigate(`/workspaces/${workspaceId}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete repository');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (isMaintainer === null) {
    return (
      <div className="settings-tab">
        <div className="settings-loading">Loading settings…</div>
      </div>
    );
  }

  return (
    <div className="settings-tab">
      <section className="settings-section">
        <h2 className="settings-section-title">General</h2>
        {isMaintainer ? (
          <form onSubmit={handleGeneralSubmit} className="settings-form">
            <label htmlFor="settings-repo-name">Repository name</label>
            <input
              id="settings-repo-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={generalSaving}
              maxLength={255}
              className="settings-input"
            />
            <label htmlFor="settings-default-branch">Default branch</label>
            {branches.length > 0 ? (
              <select
                id="settings-default-branch"
                value={defaultBranchName}
                onChange={(e) => setDefaultBranchName(e.target.value)}
                disabled={generalSaving}
                className="settings-select"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="settings-default-branch"
                type="text"
                value={defaultBranchName}
                onChange={(e) => setDefaultBranchName(e.target.value)}
                disabled={generalSaving}
                className="settings-input"
              />
            )}
            {generalError && (
              <p className="settings-error" role="alert">
                {generalError}
              </p>
            )}
            <div className="settings-actions">
              <button
                type="submit"
                className="settings-btn-primary"
                disabled={generalSaving}
              >
                {generalSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="settings-readonly">
            <p>
              <strong>Name:</strong> {repo.name}
            </p>
            <p>
              <strong>Default branch:</strong> {repo.default_branch_name}
            </p>
            <p className="settings-muted">
              You need maintainer access to change repository settings.
            </p>
          </div>
        )}
      </section>

      {isMaintainer && (
        <>
          <section className="settings-section">
            <h2 className="settings-section-title">Members</h2>
            <p className="settings-muted">
              Manage who has access to this repository and their role (QA, Developer,
              Maintainer).
            </p>
            <ul className="settings-members-list" aria-label="Repository members">
              {members.length === 0 ? (
                <li className="settings-empty">No members yet.</li>
              ) : (
                members.map((m) => (
                  <li key={m.user_id} className="settings-member-row">
                    <span className="settings-member-email">{m.email}</span>
                    <span className="settings-member-role">{m.role}</span>
                    <button
                      type="button"
                      className="settings-btn-remove"
                      onClick={() => handleRemoveMember(m.user_id)}
                      disabled={removeUserId === m.user_id}
                      aria-label={`Remove ${m.email}`}
                    >
                      {removeUserId === m.user_id ? 'Removing…' : 'Remove'}
                    </button>
                  </li>
                ))
              )}
            </ul>
            <form onSubmit={handleAddMember} className="settings-form settings-add-member">
              <label htmlFor="settings-add-user-id">Add member by User ID (UUID)</label>
              <div className="settings-add-member-row">
                <input
                  id="settings-add-user-id"
                  type="text"
                  value={addUserId}
                  onChange={(e) => {
                    setAddUserId(e.target.value);
                    setAddError(null);
                  }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  disabled={addSubmitting}
                  className="settings-input"
                />
                <select
                  value={addRole}
                  onChange={(e) =>
                    setAddRole(e.target.value as 'maintainer' | 'developer' | 'qa')
                  }
                  disabled={addSubmitting}
                  className="settings-select settings-role-select"
                  aria-label="Role"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="settings-btn-primary"
                  disabled={addSubmitting}
                >
                  {addSubmitting ? 'Adding…' : 'Add'}
                </button>
              </div>
              {addError && (
                <p className="settings-error" role="alert">
                  {addError}
                </p>
              )}
            </form>
          </section>

          <section className="settings-section settings-danger">
            <h2 className="settings-section-title">Danger zone</h2>
            <p className="settings-muted">
              Deleting this repository is permanent. All branches, commits, issues, and
              wiki pages will be removed.
            </p>
            <button
              type="button"
              className="settings-btn-danger"
              onClick={() => {
                setDeleteConfirmOpen(true);
                setDeleteConfirmName('');
                setDeleteError(null);
              }}
            >
              Delete repository
            </button>
          </section>
        </>
      )}

      {deleteConfirmOpen && (
        <Modal title="Delete repository" onClose={() => setDeleteConfirmOpen(false)}>
          <form onSubmit={handleDeleteRepo} className="modal-form">
            <p className="settings-delete-warning">
              Type <strong>{repo.name}</strong> below to confirm deletion.
            </p>
            <label htmlFor="settings-delete-confirm">Repository name</label>
            <input
              id="settings-delete-confirm"
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={repo.name}
              disabled={deleteSubmitting}
              className="settings-input"
              autoComplete="off"
            />
            {deleteError && (
              <p className="modal-error" role="alert">
                {deleteError}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="modal-btn secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="modal-btn danger"
                disabled={deleteSubmitting || deleteConfirmName !== repo.name}
              >
                {deleteSubmitting ? 'Deleting…' : 'Delete repository'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
