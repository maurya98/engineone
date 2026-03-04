import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CreateWorkspaceModal } from './Modal';
import { WORKSPACES_CHANGED } from '../lib/events';
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
      const res = await fetch('/workspaces', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        let list = data.workspaces || [];
        if (searchQuery) {
          list = list.filter((w: { name: string }) =>
            w.name.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        setWorkspaces(list);
      }
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
            <li key={ws.id}>
              <button
                type="button"
                className={currentWorkspaceId === ws.id ? 'active' : ''}
                onClick={() => navigate(`/workspaces/${ws.id}`)}
              >
                {ws.name}
              </button>
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
