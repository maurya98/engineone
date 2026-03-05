import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import './AdminUsers.css';

type WorkspaceMembership = { workspace_id: string; workspace_name: string; role: string };
type RepoMembership = {
  repo_id: string;
  repo_name: string;
  workspace_id: string;
  workspace_name: string;
  role: string;
};

type AdminUser = {
  id: string;
  email: string;
  role: string;
  display_name: string | null;
  created_at: string;
  workspace_memberships: WorkspaceMembership[];
  repo_memberships: RepoMembership[];
};

type WorkspaceItem = { id: string; name: string };
type RepoItem = { id: string; name: string; workspace_id: string; workspace_name: string };

export default function AdminUsers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addWorkspaceForUser, setAddWorkspaceForUser] = useState<AdminUser | null>(null);
  const [addRepoForUser, setAddRepoForUser] = useState<AdminUser | null>(null);
  const [addWsWorkspaceId, setAddWsWorkspaceId] = useState('');
  const [addWsRole, setAddWsRole] = useState<'admin' | 'member'>('member');
  const [addRepoRepoId, setAddRepoRepoId] = useState('');
  const [addRepoRole, setAddRepoRole] = useState<'maintainer' | 'developer' | 'qa'>('developer');
  const [saving, setSaving] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin' | 'super_admin'>('user');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [usersRes, workspacesRes, reposRes] = await Promise.all([
        apiFetch<{ users: AdminUser[] }>('/admin/users'),
        apiFetch<{ workspaces: WorkspaceItem[] }>('/admin/workspaces'),
        apiFetch<{ repositories: RepoItem[] }>('/admin/repos'),
      ]);
      setUsers(usersRes.users);
      setWorkspaces(workspacesRes.workspaces || []);
      setRepos(reposRes.repositories || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setUsers([]);
      setWorkspaces([]);
      setRepos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== 'super_admin') {
      setLoading(false);
      return;
    }
    load();
  }, [user?.role, load]);

  useEffect(() => {
    if (!addWorkspaceForUser) return;
    const available = workspaces.filter(
      (ws) => !addWorkspaceForUser.workspace_memberships.some((m) => m.workspace_id === ws.id)
    );
    setAddWsWorkspaceId(available[0]?.id || '');
  }, [addWorkspaceForUser, workspaces]);

  useEffect(() => {
    if (!addRepoForUser) return;
    const available = repos.filter(
      (r) => !addRepoForUser.repo_memberships.some((m) => m.repo_id === r.id)
    );
    setAddRepoRepoId(available[0]?.id || '');
  }, [addRepoForUser, repos]);

  const handleRoleChange = async (userId: string, role: 'user' | 'admin' | 'super_admin') => {
    setError(null);
    try {
      await apiFetch(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update role');
    }
  };

  const removeWorkspaceMember = async (workspaceId: string, userId: string) => {
    setError(null);
    try {
      await apiFetch(`/admin/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove from workspace');
    }
  };

  const removeRepoMember = async (repoId: string, userId: string) => {
    setError(null);
    try {
      await apiFetch(`/admin/repos/${repoId}/members/${userId}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove from repository');
    }
  };

  const submitAddWorkspace = async () => {
    if (!addWorkspaceForUser || !addWsWorkspaceId) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/admin/workspaces/${addWsWorkspaceId}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: addWorkspaceForUser.id, role: addWsRole }),
      });
      await load();
      setAddWorkspaceForUser(null);
      setAddWsWorkspaceId('');
      setAddWsRole('member');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add to workspace');
    } finally {
      setSaving(false);
    }
  };

  const submitAddRepo = async () => {
    if (!addRepoForUser || !addRepoRepoId) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/admin/repos/${addRepoRepoId}/members`, {
        method: 'POST',
        body: JSON.stringify({ user_id: addRepoForUser.id, role: addRepoRole }),
      });
      await load();
      setAddRepoForUser(null);
      setAddRepoRepoId('');
      setAddRepoRole('developer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add to repository');
    } finally {
      setSaving(false);
    }
  };

  const updateWorkspaceRole = async (
    workspaceId: string,
    userId: string,
    role: 'admin' | 'member'
  ) => {
    setError(null);
    try {
      await apiFetch(`/admin/workspaces/${workspaceId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update workspace role');
    }
  };

  const updateRepoRole = async (
    repoId: string,
    userId: string,
    role: 'maintainer' | 'developer' | 'qa'
  ) => {
    setError(null);
    try {
      await apiFetch(`/admin/repos/${repoId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update repository role');
    }
  };

  const submitAddUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: newUserEmail.trim(),
          password: newUserPassword,
          display_name: newUserDisplayName.trim() || undefined,
          role: newUserRole,
        }),
      });
      await load();
      setShowAddUser(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserDisplayName('');
      setNewUserRole('user');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (targetUser: AdminUser) => {
    if (targetUser.id === user?.id) return;
    if (!window.confirm(`Delete user ${targetUser.email}? This cannot be undone.`)) return;
    setDeletingUserId(targetUser.id);
    setError(null);
    try {
      await apiFetch(`/admin/users/${targetUser.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="admin-users-page">
        <h1>User management</h1>
        <div className="admin-users-forbidden">
          <p>You need super_admin access to manage users.</p>
          <button type="button" onClick={() => navigate('/')}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-users-page">
        <h1>User management</h1>
        <div className="admin-users-loading">Loading users…</div>
      </div>
    );
  }

  const workspaceOptions = workspaces.filter(
    (ws) =>
      !addWorkspaceForUser?.workspace_memberships.some((m) => m.workspace_id === ws.id)
  );
  const repoOptions = repos.filter(
    (r) =>
      !addRepoForUser?.repo_memberships.some((m) => m.repo_id === r.id)
  );

  return (
    <div className="admin-users-page">
      <h1>User management</h1>
      <p className="admin-users-intro">
        Manage global roles, workspace access, and repository access for all users.
      </p>

      <div className="admin-users-toolbar">
        <button
          type="button"
          className="admin-users-add-user-btn"
          onClick={() => setShowAddUser(true)}
        >
          Add user
        </button>
      </div>

      {error && (
        <div className="admin-users-error" role="alert">
          {error}
        </div>
      )}

      <div className="admin-users-table-wrap">
        <table className="admin-users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Global role</th>
              <th>Workspace access</th>
              <th>Repository access</th>
              <th>Actions</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="admin-users-user-cell">
                  <div className="admin-users-user-email">{u.email}</div>
                  {u.display_name && (
                    <div className="admin-users-user-display">{u.display_name}</div>
                  )}
                </td>
                <td className="admin-users-role-cell">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      handleRoleChange(u.id, e.target.value as 'user' | 'admin' | 'super_admin')
                    }
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </td>
                <td className="admin-users-badges-cell">
                  <div className="admin-users-badges">
                    {u.workspace_memberships.length === 0 ? (
                      <span className="admin-users-empty">None</span>
                    ) : (
                      u.workspace_memberships.map((m) => (
                        <span key={m.workspace_id} className="admin-users-badge">
                          {m.workspace_name}{' '}
                          <select
                            value={m.role}
                            onChange={(e) =>
                              updateWorkspaceRole(
                                m.workspace_id,
                                u.id,
                                e.target.value as 'admin' | 'member'
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="member">member</option>
                            <option value="admin">admin</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeWorkspaceMember(m.workspace_id, u.id)}
                            aria-label={`Remove from ${m.workspace_name}`}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="admin-users-badges-cell">
                  <div className="admin-users-badges">
                    {u.repo_memberships.length === 0 ? (
                      <span className="admin-users-empty">None</span>
                    ) : (
                      u.repo_memberships.map((m) => (
                        <span key={m.repo_id} className="admin-users-badge">
                          {m.workspace_name} / {m.repo_name}{' '}
                          <select
                            value={m.role}
                            onChange={(e) =>
                              updateRepoRole(
                                m.repo_id,
                                u.id,
                                e.target.value as 'maintainer' | 'developer' | 'qa'
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="qa">qa</option>
                            <option value="developer">developer</option>
                            <option value="maintainer">maintainer</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeRepoMember(m.repo_id, u.id)}
                            aria-label={`Remove from ${m.repo_name}`}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="admin-users-actions-cell">
                  <button
                    type="button"
                    onClick={() => setAddWorkspaceForUser(u)}
                    disabled={workspaces.filter((ws) => !u.workspace_memberships.some((m) => m.workspace_id === ws.id)).length === 0}
                  >
                    Add workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddRepoForUser(u)}
                    disabled={repos.filter((r) => !u.repo_memberships.some((m) => m.repo_id === r.id)).length === 0}
                  >
                    Add repository
                  </button>
                </td>
                <td className="admin-users-delete-cell">
                  <button
                    type="button"
                    className="admin-users-delete-btn"
                    onClick={() => deleteUser(u)}
                    disabled={u.id === user?.id || deletingUserId === u.id}
                    title={u.id === user?.id ? 'Cannot delete your own account' : 'Delete user'}
                  >
                    {deletingUserId === u.id ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addWorkspaceForUser && (
        <div
          className="admin-users-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-ws-title"
          onClick={() => !saving && setAddWorkspaceForUser(null)}
        >
          <div
            className="admin-users-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="add-ws-title">Add to workspace</h3>
            <p className="admin-users-user-display" style={{ marginBottom: '1rem' }}>
              {addWorkspaceForUser.email}
            </p>
            <div className="field">
              <label htmlFor="add-ws-workspace">Workspace</label>
              <select
                id="add-ws-workspace"
                value={addWsWorkspaceId}
                onChange={(e) => setAddWsWorkspaceId(e.target.value)}
              >
                {workspaceOptions.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="add-ws-role">Role</label>
              <select
                id="add-ws-role"
                value={addWsRole}
                onChange={(e) => setAddWsRole(e.target.value as 'admin' | 'member')}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="admin-users-modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setAddWorkspaceForUser(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={submitAddWorkspace}
                disabled={saving || !addWsWorkspaceId}
              >
                {saving ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {addRepoForUser && (
        <div
          className="admin-users-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-repo-title"
          onClick={() => !saving && setAddRepoForUser(null)}
        >
          <div
            className="admin-users-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="add-repo-title">Add to repository</h3>
            <p className="admin-users-user-display" style={{ marginBottom: '1rem' }}>
              {addRepoForUser.email}
            </p>
            <div className="field">
              <label htmlFor="add-repo-repo">Repository</label>
              <select
                id="add-repo-repo"
                value={addRepoRepoId}
                onChange={(e) => setAddRepoRepoId(e.target.value)}
              >
                {repoOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.workspace_name} / {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="add-repo-role">Role</label>
              <select
                id="add-repo-role"
                value={addRepoRole}
                onChange={(e) =>
                  setAddRepoRole(e.target.value as 'maintainer' | 'developer' | 'qa')
                }
              >
                <option value="qa">QA</option>
                <option value="developer">Developer</option>
                <option value="maintainer">Maintainer</option>
              </select>
            </div>
            <div className="admin-users-modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setAddRepoForUser(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={submitAddRepo}
                disabled={saving || !addRepoRepoId}
              >
                {saving ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddUser && (
        <div
          className="admin-users-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-title"
          onClick={() => !saving && setShowAddUser(false)}
        >
          <div
            className="admin-users-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="add-user-title">Add user</h3>
            <div className="field">
              <label htmlFor="new-user-email">Email *</label>
              <input
                id="new-user-email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@example.com"
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="new-user-password">Password *</label>
              <input
                id="new-user-password"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Min 8 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label htmlFor="new-user-display-name">Display name</label>
              <input
                id="new-user-display-name"
                type="text"
                value={newUserDisplayName}
                onChange={(e) => setNewUserDisplayName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="field">
              <label htmlFor="new-user-role">Global role</label>
              <select
                id="new-user-role"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as 'user' | 'admin' | 'super_admin')}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div className="admin-users-modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setShowAddUser(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={submitAddUser}
                disabled={saving || !newUserEmail.trim() || newUserPassword.length < 8}
              >
                {saving ? 'Creating…' : 'Create user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
