import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CreateWorkspaceModal, CreateRepoModal } from '../components/Modal';
import { DeleteIcon } from '../components/icons/DeleteIcon';
import { emitWorkspacesChanged } from '../lib/events';

interface Workspace {
  id: string;
  name: string;
}

interface Repository {
  id: string;
  name: string;
  workspace_id: string;
  default_branch_name: string;
  workspace_name?: string;
}

export default function Dashboard() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [myRepos, setMyRepos] = useState<Repository[]>([]);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showCreateRepo, setShowCreateRepo] = useState(false);

  // Repos in the selected workspace: from /users/me/repos filtered by workspace
  const repos = workspaceId
    ? myRepos.filter((r) => r.workspace_id === workspaceId)
    : [];

  const loadWorkspaces = () => {
    apiFetch<{ workspaces: Workspace[] }>('/workspaces')
      .then((data) => setWorkspaces(data.workspaces || []))
      .catch(() => setWorkspaces([]))
      .finally(() => setLoading(false));
  };

  const loadMyRepos = () => {
    apiFetch<{ repositories: Repository[] }>('/users/me/repos')
      .then((data) => setMyRepos(data.repositories || []))
      .catch(() => setMyRepos([]));
  };

  const loadInitial = () => {
    setLoading(true);
    Promise.all([
      apiFetch<{ workspaces: Workspace[] }>('/workspaces').then((d) => d.workspaces || []).catch(() => []),
      apiFetch<{ repositories: Repository[] }>('/users/me/repos').then((d) => d.repositories || []).catch(() => []),
    ]).then(([ws, repos]) => {
      setWorkspaces(ws);
      setMyRepos(repos);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (!loading && !workspaceId && workspaces.length > 0) {
      navigate(`/workspaces/${workspaces[0].id}`, { replace: true });
    }
  }, [loading, workspaceId, workspaces, navigate]);

  useEffect(() => {
    if (!workspaceId) {
      setWorkspaceName(null);
      return;
    }
    setWorkspaceLoading(true);
    apiFetch<{ workspace: Workspace }>(`/workspaces/${workspaceId}`)
      .then((d) => setWorkspaceName(d.workspace.name))
      .catch(() => setWorkspaceName(null))
      .finally(() => setWorkspaceLoading(false));
  }, [workspaceId]);

  const handleCreateWorkspaceSuccess = () => {
    loadWorkspaces();
    emitWorkspacesChanged();
  };

  const handleCreateRepoSuccess = () => {
    apiFetch<{ repositories: Repository[] }>('/users/me/repos')
      .then((d) => setMyRepos(d.repositories || []))
      .catch(() => {});
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceId || !workspaceName) return;
    if (!window.confirm(`Delete workspace "${workspaceName}"? This will remove all repositories and cannot be undone.`)) return;
    try {
      await apiFetch(`/workspaces/${workspaceId}`, { method: 'DELETE' });
      loadWorkspaces();
      emitWorkspacesChanged();
      navigate('/');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete workspace');
    }
  };

  const handleDeleteRepo = async (e: React.MouseEvent, r: Repository) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete repository "${r.name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/repos/${r.id}`, { method: 'DELETE' });
      const data = await apiFetch<{ repositories: Repository[] }>('/users/me/repos');
      setMyRepos(data.repositories || []);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete repository');
    }
  };

  const isSuperAdmin = user?.role === 'super_admin';

  if (loading && !workspaceId) {
    return <div className="loading">Loading...</div>;
  }

  // No workspace selected: show prompt or "Your repositories" for repo-only users
  if (!workspaceId) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        {workspaces.length > 0 ? (
          <p className="text-muted">Select a workspace from the left sidebar to view its repositories.</p>
        ) : myRepos.length > 0 ? (
          <>
            <p className="text-muted">Repositories you have access to</p>
            <ul className="dashboard-repo-list">
              {myRepos.map((r) => (
                <li key={r.id} className="dashboard-repo-row">
                  <button
                    type="button"
                    className="dashboard-repo-card"
                    onClick={() => navigate(`/workspaces/${r.workspace_id}/repos/${r.id}`)}
                  >
                    <span className="dashboard-repo-name">{r.name}</span>
                    <span className="dashboard-repo-meta">
                      {r.workspace_name ? `${r.workspace_name} · ` : ''}Default branch: {r.default_branch_name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted">Select a workspace from the left sidebar to view its repositories.</p>
        )}
        {workspaces.length === 0 && myRepos.length === 0 && !isSuperAdmin && (
          <p className="text-muted">No workspaces yet. Workspaces can only be created by a super admin.</p>
        )}
        {isSuperAdmin && (
          <p className="dashboard-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowCreateWorkspace(true)}
            >
              Create workspace
            </button>
          </p>
        )}
        {showCreateWorkspace && (
          <CreateWorkspaceModal
            onClose={() => setShowCreateWorkspace(false)}
            onSuccess={handleCreateWorkspaceSuccess}
          />
        )}
      </div>
    );
  }

  // Workspace selected: show repos in main section
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-workspace-title">{workspaceName ?? 'Workspace'}</h1>
        <p className="text-muted">Repositories</p>
      </div>
      <div className="dashboard-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowCreateRepo(true)}
        >
          + New repository
        </button>
        {isSuperAdmin && (
          <button
            type="button"
            className="btn-danger"
            onClick={handleDeleteWorkspace}
          >
            Delete workspace
          </button>
        )}
      </div>
      {workspaceLoading ? (
        <p className="text-muted">Loading...</p>
      ) : repos.length === 0 ? (
        <p className="text-muted">No repositories yet. Create one to get started.</p>
      ) : (
        <ul className="dashboard-repo-list">
          {repos.map((r) => (
            <li key={r.id} className="dashboard-repo-row">
              <button
                type="button"
                className="dashboard-repo-card"
                onClick={() => navigate(`/workspaces/${workspaceId}/repos/${r.id}`)}
              >
                <span className="dashboard-repo-name">{r.name}</span>
                <span className="dashboard-repo-meta">Default branch: {r.default_branch_name}</span>
              </button>
              <button
                type="button"
                className="dashboard-repo-delete"
                title="Delete repository"
                onClick={(e) => handleDeleteRepo(e, r)}
                aria-label={`Delete repository ${r.name}`}
              >
                <DeleteIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {showCreateRepo && workspaceId && workspaceName && (
        <CreateRepoModal
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          onClose={() => setShowCreateRepo(false)}
          onSuccess={() => {
            handleCreateRepoSuccess();
            setShowCreateRepo(false);
          }}
        />
      )}
    </div>
  );
}
