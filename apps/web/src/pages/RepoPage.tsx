import { useParams, Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import CodeTab from '../components/repo/CodeTab';
import IssueTab from '../components/repo/IssueTab';
import WikiTab from '../components/repo/WikiTab';
import BranchTab from '../components/repo/BranchTab';
import PullRequestTab from '../components/repo/PullRequestTab';
import SettingsTab from '../components/repo/SettingsTab';
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

  const handleRepoUpdate = (updated: { name: string; default_branch_name: string }) => {
    setRepo((prev) => (prev ? { ...prev, ...updated } : null));
  };

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
              <Route path="issues" element={<IssueTab repoId={repoId!} defaultBranch={repo.default_branch_name} />} />
              <Route path="branches" element={<BranchTab repoId={repoId!} defaultBranch={repo.default_branch_name} />} />
              <Route path="pull_requests" element={<PullRequestTab repoId={repoId!} defaultBranch={repo.default_branch_name} />} />
              <Route path="wiki" element={<WikiTab repoId={repoId!} />} />
              <Route path="settings" element={<SettingsTab repoId={repoId!} repo={repo} onRepoUpdate={handleRepoUpdate} />} />
            </Routes>
          </div>
        </>
      )}
      {!repo && <div className="loading">Loading repo...</div>}
    </div>
  );
}
