import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CreateWorkspaceModal } from './Modal';
import { DeleteIcon } from './icons/DeleteIcon';
import { WORKSPACES_CHANGED, emitWorkspacesChanged } from '../lib/events';
import { apiFetch } from '../lib/api';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const showSearch =
    location.pathname === '/' ||
    (location.pathname.startsWith('/workspaces/') && !/^\/workspaces\/[^/]+\/repos\/[^/]+/.test(location.pathname));

  const isRepoPage = /^\/workspaces\/[^/]+\/repos\/[^/]+/.test(location.pathname);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    setUserMenuOpen(false);
  };

  return (
    <div className="layout">
      <header className="navbar">
        <button
          type="button"
          className="navbar-toggle"
          aria-label="Toggle sidebar"
          onClick={() => setSidebarOpen((o) => !o)}
          style={isRepoPage ? { display: 'none' } : undefined}
        >
          ☰
        </button>
        <a href="/" className="navbar-brand">
          EngineOne
        </a>
        {showSearch && (
          <div className="navbar-search">
            <input
              type="search"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        )}
        <div className="navbar-right">
          <div className="user-menu-wrap">
            <button
              type="button"
              className="user-menu-trigger"
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-expanded={userMenuOpen}
            >
              {user?.display_name || user?.email || 'User'}
            </button>
            {userMenuOpen && (
              <>
                <div
                  className="user-menu-backdrop"
                  onClick={() => setUserMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="user-menu">
                  <button type="button" onClick={() => { navigate('/profile'); setUserMenuOpen(false); }}>
                    Profile
                  </button>
                  <button type="button" onClick={() => { navigate('/preferences'); setUserMenuOpen(false); }}>
                    Preferences
                  </button>
                  <button type="button" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      <div className={`layout-body ${isRepoPage ? 'layout-body--no-sidebar' : ''}`}>
        {!isRepoPage && (
          <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
            <DashboardSidebar searchQuery={searchQuery} user={user} />
          </aside>
        )}
        <main className="main">
          <div className="main-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function DashboardSidebar({
  searchQuery,
  user,
}: {
  searchQuery: string;
  user: { id: string; role: string } | null;
}) {
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const currentWorkspaceId = location.pathname.startsWith('/workspaces/')
    ? location.pathname.split('/')[2]
    : null;

  const loadWorkspaces = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ workspaces: { id: string; name: string }[] }>('/workspaces');
      let list = data.workspaces || [];
      if (searchQuery) {
        list = list.filter((w) =>
          w.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      setWorkspaces(list);
    } catch {
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, [searchQuery]);

  useEffect(() => {
    const onWorkspacesChanged = () => loadWorkspaces();
    window.addEventListener(WORKSPACES_CHANGED, onWorkspacesChanged);
    return () => window.removeEventListener(WORKSPACES_CHANGED, onWorkspacesChanged);
  }, [searchQuery]);

  const isSuperAdmin = user?.role === 'super_admin';

  const handleDeleteWorkspace = async (e: React.MouseEvent, ws: { id: string; name: string }) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete workspace "${ws.name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/workspaces/${ws.id}`, { method: 'DELETE' });
      loadWorkspaces();
      emitWorkspacesChanged();
      if (currentWorkspaceId === ws.id) {
        navigate('/');
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete workspace');
    }
  };

  return (
    <div className="sidebar-inner">
      <h3 className="sidebar-title">Workspaces</h3>
      {isSuperAdmin && (
        <button
          type="button"
          className="sidebar-action-btn"
          onClick={() => setShowCreateWorkspace(true)}
        >
          + New workspace
        </button>
      )}
      {loading ? (
        <p className="sidebar-muted">Loading...</p>
      ) : (
        <ul className="sidebar-list">
          {workspaces.map((ws) => (
            <li key={ws.id} className="sidebar-workspace-row">
              <button
                type="button"
                className={currentWorkspaceId === ws.id ? 'active' : ''}
                onClick={() => navigate(`/workspaces/${ws.id}`)}
              >
                {ws.name}
              </button>
              {isSuperAdmin && (
                <button
                  type="button"
                  className="sidebar-delete-workspace"
                  title="Delete workspace"
                  onClick={(e) => handleDeleteWorkspace(e, ws)}
                  aria-label={`Delete workspace ${ws.name}`}
                >
                  <DeleteIcon size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {showCreateWorkspace && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateWorkspace(false)}
          onSuccess={() => {
            loadWorkspaces();
            setShowCreateWorkspace(false);
          }}
        />
      )}
    </div>
  );
}
