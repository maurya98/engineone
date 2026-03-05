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
}

export default function Dashboard() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [reposLoading, setReposLoading] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showCreateRepo, setShowCreateRepo] = useState(false);

  const loadWorkspaces = () => {
    apiFetch<{ workspaces: Workspace[] }>('/workspaces')
      .then((data) => setWorkspaces(data.workspaces || []))
      .catch(() => setWorkspaces([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (!loading && !workspaceId && workspaces.length > 0) {
      navigate(`/workspaces/${workspaces[0].id}`, { replace: true });
    }
  }, [loading, workspaceId, workspaces, navigate]);

  useEffect(() => {
    if (!workspaceId) {
      setRepos([]);
      setWorkspaceName(null);
      return;
    }
    setReposLoading(true);
    Promise.all([
      apiFetch<{ workspace: Workspace }>(`/workspaces/${workspaceId}`).then((d) => d.workspace),
      apiFetch<{ repositories: Repository[] }>(`/workspaces/${workspaceId}/repos`).then(
        (d) => d.repositories || []
      ),
    ])
      .then(([ws, list]) => {
        setWorkspaceName(ws.name);
        setRepos(list);
      })
      .catch(() => {
        setWorkspaceName(null);
        setRepos([]);
      })
      .finally(() => setReposLoading(false));
  }, [workspaceId]);

  const handleCreateWorkspaceSuccess = () => {
    loadWorkspaces();
    emitWorkspacesChanged();
  };

  const handleCreateRepoSuccess = () => {
    if (!workspaceId) return;
    apiFetch<{ repositories: Repository[] }>(`/workspaces/${workspaceId}/repos`)
      .then((d) => setRepos(d.repositories || []))
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
      if (workspaceId) {
        const data = await apiFetch<{ repositories: Repository[] }>(`/workspaces/${workspaceId}/repos`);
        setRepos(data.repositories || []);
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete repository');
    }
  };

  const isSuperAdmin = user?.role === 'super_admin';

  if (loading && !workspaceId) {
    return <div className="loading">Loading...</div>;
  }

  // No workspace selected: show prompt on home
  if (!workspaceId) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <p className="text-muted">Select a workspace from the left sidebar to view its repositories.</p>
        {workspaces.length === 0 && !isSuperAdmin && (
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
      {reposLoading ? (
        <p className="text-muted">Loading repositories...</p>
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
