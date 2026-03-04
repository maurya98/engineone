import { useParams, Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import CodeTab from '../components/repo/CodeTab';
import './RepoPage.css';

const TABS = [
  { path: '', label: 'Code' },
  { path: 'issues', label: 'Issues' },
  { path: 'branches', label: 'Branches' },
  { path: 'pull_requests', label: 'Pull Requests' },
  { path: 'wiki', label: 'Wiki' },
  { path: 'settings', label: 'Settings' },
];

export default function RepoPage() {
  const { workspaceId, repoId } = useParams<{ workspaceId: string; repoId: string }>();
  const [repo, setRepo] = useState<{ name: string; default_branch_name: string } | null>(null);

  useEffect(() => {
    if (!repoId) return;
    apiFetch<{ repository: { name: string; default_branch_name: string } }>(`/repos/${repoId}`)
      .then((data) => setRepo(data.repository))
      .catch(() => setRepo(null));
  }, [repoId]);

  const base = `/workspaces/${workspaceId}/repos/${repoId}`;

  return (
    <div className="repo-page">
      {repo && (
        <>
          <h1 className="repo-name">{repo.name}</h1>
          <nav className="repo-tabs">
            {TABS.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path ? `${base}/${tab.path}` : base}
                end={tab.path === ''}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
          <div className="repo-content">
            <Routes>
              <Route path="/" element={<CodeTab repoId={repoId!} defaultBranch={repo.default_branch_name} />} />
              <Route path="issues" element={<div className="placeholder">Issues</div>} />
              <Route path="branches" element={<div className="placeholder">Branches</div>} />
              <Route path="pull_requests" element={<div className="placeholder">Pull Requests</div>} />
              <Route path="wiki" element={<div className="placeholder">Wiki</div>} />
              <Route path="settings" element={<div className="placeholder">Settings</div>} />
            </Routes>
          </div>
        </>
      )}
      {!repo && <div className="loading">Loading repo...</div>}
    </div>
  );
}
