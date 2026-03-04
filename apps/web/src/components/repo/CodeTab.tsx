import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../../lib/api';
import {
  loadDraftFromStorage,
  saveDraftToStorage,
  clearDraftStorage,
} from '../../lib/draftStorage';
import './CodeTab.css';

interface TreeEntry {
  path: string;
  blob_id: string;
  kind: 'file' | 'folder';
}

interface BranchItem {
  id: string;
  name: string;
  is_default?: boolean;
}

interface TreeNode {
  name: string;
  path: string; // full path for files, path prefix for folders
  kind: 'file' | 'folder';
  children?: TreeNode[];
}

function buildTree(entries: { path: string; kind: 'file' | 'folder' }[]): TreeNode[] {
  const byPath = new Map<string, TreeNode>();
  const ensureFolder = (path: string): TreeNode => {
    if (byPath.has(path)) return byPath.get(path)!;
    const parts = path.split('/').filter(Boolean);
    const name = parts[parts.length - 1] || path || '';
    const node: TreeNode = { name, path, kind: 'folder', children: [] };
    byPath.set(path, node);
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join('/');
      const parent = ensureFolder(parentPath);
      parent.children!.push(node);
    }
    return node;
  };
  const rootKeys = new Set<string>();
  entries.forEach((e) => {
    const path = e.path.trim();
    if (!path) return;
    const parts = path.split('/').filter(Boolean);
    rootKeys.add(parts[0]);
    if (e.kind === 'folder') {
      ensureFolder(path);
    } else {
      if (parts.length > 1) ensureFolder(parts.slice(0, -1).join('/'));
      const node: TreeNode = { name: parts[parts.length - 1], path, kind: 'file' };
      byPath.set(path, node);
      if (parts.length > 1) {
        const parent = ensureFolder(parts.slice(0, -1).join('/'));
        parent.children!.push(node);
      }
    }
  });
  return (
    Array.from(rootKeys)
      .map((key) => byPath.get(key))
      .filter((n): n is TreeNode => Boolean(n))
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      })
  );
}

interface CodeTabProps {
  repoId: string;
  defaultBranch: string;
}

export default function CodeTab({ repoId, defaultBranch }: CodeTabProps) {
  const [branch, setBranch] = useState(defaultBranch);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [draftTree, setDraftTree] = useState<{ path: string; kind: 'file' | 'folder'; content?: string }[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitOpen, setCommitOpen] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFileName, setNewFileName] = useState('');
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<'saved' | null>(null);
  const [deletedPaths, setDeletedPaths] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ path: string; kind: 'file' | 'folder'; x: number; y: number } | null>(null);
  const [moveModal, setMoveModal] = useState<{ path: string; kind: 'file' | 'folder' } | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef<string | null>(null);

  const loadBranches = useCallback(async () => {
    try {
      const data = await apiFetch<{ branches: BranchItem[] }>(`/repos/${repoId}/branches`);
      setBranches(data.branches || []);
    } catch {
      setBranches([]);
    }
  }, [repoId]);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ tree: TreeEntry[] }>(
        `/repos/${repoId}/tree?branch=${encodeURIComponent(branch)}`
      );
      setTree(data.tree || []);
    } catch {
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, [repoId, branch]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // Restore draft from localStorage after tree has loaded for this branch
  useEffect(() => {
    if (loading || !repoId || !branch) return;
    const key = `${repoId}-${branch}`;
    if (hasRestoredRef.current === key) return;
    hasRestoredRef.current = key;
    const stored = loadDraftFromStorage(repoId, branch);
    if (stored) {
      if (Object.keys(stored.draft).length > 0) setDraft(stored.draft);
      if (stored.draftTree.length > 0) setDraftTree(stored.draftTree);
      if (stored.expandedFolders?.length) setExpandedFolders(new Set(stored.expandedFolders));
      if (stored.deletedPaths?.length) setDeletedPaths(new Set(stored.deletedPaths));
    }
  }, [loading, repoId, branch]);

  // Reset restore key when branch changes so we restore for the new branch
  useEffect(() => {
    hasRestoredRef.current = null;
  }, [branch]);

  const handleBranchChange = (newBranch: string) => {
    setBranch(newBranch);
    setBranchDropdownOpen(false);
    setSelectedPath(null);
    setDraft({});
    setDraftTree([]);
    setDeletedPaths(new Set());
    hasRestoredRef.current = null;
    loadTree();
  };

  const isPathDeleted = useCallback((path: string) => {
    for (const d of deletedPaths) {
      if (path === d || path.startsWith(d + '/')) return true;
    }
    return false;
  }, [deletedPaths]);

  const mergedPaths = (() => {
    const fromServer = new Map(tree.map((e) => [e.path, e.kind]));
    draftTree.forEach((e) => fromServer.set(e.path, e.kind));
    return Array.from(fromServer.entries())
      .map(([path, kind]) => ({ path, kind }))
      .filter(({ path }) => !isPathDeleted(path));
  })();

  const treeData = buildTree(mergedPaths);

  const getFileContent = useCallback(
    async (path: string): Promise<string> => {
      if (draft[path] !== undefined) return draft[path];
      const res = await window.fetch(
        `/repos/${repoId}/files?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`,
        { credentials: 'include' }
      );
      if (!res.ok) return '';
      return res.text();
    },
    [repoId, branch, draft]
  );

  const handleSelectFile = (path: string) => {
    setSelectedPath(path);
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const hasChanges =
    Object.keys(draft).length > 0 ||
    draftTree.some((e) => !tree.find((t) => t.path === e.path)) ||
    deletedPaths.size > 0;

  const persistToLocalStorage = useCallback(() => {
    saveDraftToStorage(repoId, branch, {
      draft,
      draftTree,
      expandedFolders,
      deletedPaths,
    });
  }, [repoId, branch, draft, draftTree, expandedFolders, deletedPaths]);

  const handleSaveClick = () => {
    persistToLocalStorage();
    setSaveFeedback('saved');
    setTimeout(() => setSaveFeedback(null), 2000);
  };

  // Auto-save draft changes to localStorage (debounced)
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (hasChanges) persistToLocalStorage();
      autoSaveTimerRef.current = null;
    }, 800);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [draft, draftTree, expandedFolders, hasChanges, persistToLocalStorage]);

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    setCommitting(true);
    try {
      const treePayload = mergedPaths.map((p) =>
        p.kind === 'folder'
          ? { path: p.path, kind: 'folder' as const }
          : {
              path: p.path,
              kind: 'file' as const,
              ...(draft[p.path] !== undefined ? { content: draft[p.path] } : {}),
            }
      );
      await apiFetch(`/repos/${repoId}/commits`, {
        method: 'POST',
        body: JSON.stringify({
          message: commitMessage,
          branch,
          tree: treePayload,
        }),
      });
      clearDraftStorage(repoId, branch);
      setCommitMessage('');
      setCommitOpen(false);
      setDraft({});
      setDraftTree([]);
      setDeletedPaths(new Set());
      setSelectedPath(null);
      await loadTree();
    } finally {
      setCommitting(false);
    }
  };

  const handleDelete = (path: string, kind: 'file' | 'folder') => {
    setContextMenu(null);
    if (kind === 'folder') {
      const toRemove = mergedPaths.filter((p) => p.path === path || p.path.startsWith(path + '/'));
      setDeletedPaths((prev) => {
        const next = new Set(prev);
        toRemove.forEach((p) => {
          if (tree.some((t) => t.path === p.path)) next.add(p.path);
        });
        return next;
      });
      setDraftTree((t) => t.filter((e) => e.path !== path && !e.path.startsWith(path + '/')));
      setDraft((d) => {
        const next = { ...d };
        toRemove.forEach((p) => delete next[p.path]);
        return next;
      });
    } else {
      const fromServer = tree.some((t) => t.path === path);
      if (fromServer) setDeletedPaths((prev) => new Set(prev).add(path));
      setDraftTree((t) => t.filter((e) => e.path !== path));
      setDraft((d) => {
        const next = { ...d };
        delete next[path];
        return next;
      });
    }
    if (selectedPath === path || (kind === 'folder' && selectedPath?.startsWith(path + '/'))) {
      setSelectedPath(null);
    }
  };

  const handleMove = async (fromPath: string, kind: 'file' | 'folder', toFolderPath: string) => {
    setContextMenu(null);
    setMoveModal(null);
    const targetPrefix = toFolderPath ? `${toFolderPath}/` : '';
    const name = fromPath.split('/').filter(Boolean).pop() || fromPath;

    if (kind === 'file') {
      const newPath = targetPrefix + name;
      if (newPath === fromPath) return;
      let content: string | undefined = draft[fromPath];
      if (content === undefined) {
        try {
          content = await getFileContent(fromPath) ?? '';
        } catch {
          content = '';
        }
      }
      const fromServer = tree.some((t) => t.path === fromPath);
      if (fromServer) setDeletedPaths((prev) => new Set(prev).add(fromPath));
      setDraftTree((t) => t.filter((e) => e.path !== fromPath).concat([{ path: newPath, kind: 'file', content }]));
      setDraft((d) => {
        const next = { ...d };
        delete next[fromPath];
        if (content !== undefined) next[newPath] = content;
        return next;
      });
      if (selectedPath === fromPath) setSelectedPath(newPath);
    } else {
      const under = mergedPaths.filter((p) => p.path === fromPath || p.path.startsWith(fromPath + '/'));
      const fromServerPaths = under.filter((p) => tree.some((t) => t.path === p.path));
      setDeletedPaths((prev) => {
        const next = new Set(prev);
        fromServerPaths.forEach((p) => next.add(p.path));
        return next;
      });
      setDraftTree((t) =>
        t.filter((e) => e.path !== fromPath && !e.path.startsWith(fromPath + '/')).concat(
          under.map((p) => {
            const rel = p.path === fromPath ? name : p.path.slice(fromPath.length + 1);
            const newPath = targetPrefix + rel;
            return { path: newPath, kind: p.kind, content: p.kind === 'file' ? draft[p.path] : undefined };
          })
        )
      );
      setDraft((d) => {
        const next = { ...d };
        under.forEach((p) => {
          if (d[p.path] !== undefined) {
            const rel = p.path === fromPath ? name : p.path.slice(fromPath.length + 1);
            next[targetPrefix + rel] = d[p.path];
            delete next[p.path];
          }
        });
        return next;
      });
      if (selectedPath && (selectedPath === fromPath || selectedPath.startsWith(fromPath + '/'))) {
        const rel = selectedPath === fromPath ? name : selectedPath.slice(fromPath.length + 1);
        setSelectedPath(targetPrefix + rel);
      }
    }
  };

  const handleNewFile = () => {
    const path = newFileName.trim();
    if (!path) return;
    const isFolder = path.endsWith('/') || (path.includes('/') && !path.split('/').pop()?.includes('.'));
    const normalizedPath = path.replace(/\/+$/, '');
    if (isFolder) {
      setDraftTree((t) => (t.some((e) => e.path === normalizedPath) ? t : [...t, { path: normalizedPath, kind: 'folder' }]));
      setNewFileOpen(false);
      setNewFileName('');
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        const parts = normalizedPath.split('/').filter(Boolean);
        let p = '';
        parts.forEach((seg) => {
          p = p ? `${p}/${seg}` : seg;
          next.add(p);
        });
        return next;
      });
      return;
    }
    setDraftTree((t) => (t.some((e) => e.path === normalizedPath) ? t : [...t, { path: normalizedPath, kind: 'file', content: '' }]));
    setSelectedPath(normalizedPath);
    setNewFileOpen(false);
    setNewFileName('');
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      const parts = normalizedPath.split('/').slice(0, -1);
      let p = '';
      parts.forEach((seg) => {
        p = p ? `${p}/${seg}` : seg;
        next.add(p);
      });
      return next;
    });
  };

  function renderTreeNode(node: TreeNode, depth: number) {
    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({ path: node.path, kind: node.kind, x: e.clientX, y: e.clientY });
    };
    if (node.kind === 'folder') {
      const isExpanded = expandedFolders.has(node.path);
      return (
        <li key={node.path} className="tree-folder">
          <button
            type="button"
            className="tree-row"
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
            onClick={() => toggleFolder(node.path)}
            onContextMenu={handleContextMenu}
          >
            <span className="tree-chevron">{isExpanded ? '▼' : '▶'}</span>
            <span className="tree-icon">📁</span>
            <span className="tree-label">{node.name}</span>
          </button>
          {isExpanded && node.children && node.children.length > 0 && (
            <ul className="tree-list tree-sublist">
              {[...node.children]
                .sort((a, b) => {
                  if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
                  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
                })
                .map((child) => renderTreeNode(child, depth + 1))}
            </ul>
          )}
        </li>
      );
    }
    return (
      <li key={node.path}>
        <button
          type="button"
          className={`tree-row ${selectedPath === node.path ? 'selected' : ''}`}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => handleSelectFile(node.path)}
          onContextMenu={handleContextMenu}
        >
          <span className="tree-chevron" />
          <span className="tree-icon">📄</span>
          <span className="tree-label">{node.name}</span>
        </button>
      </li>
    );
  }

  return (
    <div className="code-tab">
      <div className="code-toolbar">
        <div className="branch-dropdown-wrap">
          <button
            type="button"
            className="branch-dropdown-trigger"
            onClick={() => setBranchDropdownOpen((o) => !o)}
            aria-expanded={branchDropdownOpen}
          >
            <span className="branch-icon">⌄</span>
            <span className="branch-name">{branch}</span>
          </button>
          {branchDropdownOpen && (
            <>
              <div className="branch-dropdown-backdrop" onClick={() => setBranchDropdownOpen(false)} aria-hidden />
              <div className="branch-dropdown-menu">
                {branches.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={b.name === branch ? 'active' : ''}
                    onClick={() => handleBranchChange(b.name)}
                  >
                    {b.name}
                    {b.is_default && <span className="branch-default-badge">default</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {hasChanges && (
          <>
            <button type="button" className="btn-save" onClick={handleSaveClick}>
              Save
            </button>
            <button type="button" className="btn-commit" onClick={() => setCommitOpen(true)}>
              Commit
            </button>
          </>
        )}
        {saveFeedback === 'saved' && <span className="save-feedback">Saved to browser</span>}
      </div>
      <div className="code-body">
        <div className="code-tree">
          <div className="code-tree-header">
            <span className="code-tree-title">Files</span>
            <button
              type="button"
              className="tree-btn-new"
              onClick={() => setNewFileOpen(true)}
              title="New file or folder"
            >
              +
            </button>
          </div>
          {loading ? (
            <p className="muted">Loading...</p>
          ) : (
            <ul className="tree-list tree-root">
              {treeData.map((node) => renderTreeNode(node, 0))}
            </ul>
          )}
        </div>
        <div className="code-main">
          {selectedPath ? (
            <p className="muted">Preview not implemented for this file.</p>
          ) : (
            <p className="muted">Select a file from the tree.</p>
          )}
        </div>
      </div>
      {commitOpen && (
        <div className="modal-backdrop" onClick={() => setCommitOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Commit changes</h3>
            <label>
              Message
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message"
              />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setCommitOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={handleCommit} disabled={committing || !commitMessage.trim()}>
                {committing ? 'Committing...' : 'Commit'}
              </button>
            </div>
          </div>
        </div>
      )}
      {newFileOpen && (
        <div className="modal-backdrop" onClick={() => { setNewFileOpen(false); setNewFileName(''); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New file or folder</h3>
            <label>
              Path (e.g. <code>rules/index.json</code> or <code>src/</code> for folder)
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="path/to/file.json"
                onKeyDown={(e) => e.key === 'Enter' && handleNewFile()}
              />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => { setNewFileOpen(false); setNewFileName(''); }}>
                Cancel
              </button>
              <button type="button" onClick={handleNewFile} disabled={!newFileName.trim()}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      {contextMenu && (
        <>
          <div
            className="context-menu-backdrop"
            aria-hidden
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => handleDelete(contextMenu.path, contextMenu.kind)}
            >
              Delete
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMoveModal({ path: contextMenu.path, kind: contextMenu.kind });
                setContextMenu(null);
              }}
            >
              Move to…
            </button>
          </div>
        </>
      )}
      {moveModal && (
        <div className="modal-backdrop" onClick={() => setMoveModal(null)}>
          <div className="modal move-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Move {moveModal.kind === 'folder' ? 'folder' : 'file'} to</h3>
            <ul className="move-folder-list">
              <li>
                <button
                  type="button"
                  className="move-folder-item"
                  onClick={() => handleMove(moveModal.path, moveModal.kind, '')}
                >
                  Root
                </button>
              </li>
              {mergedPaths
                .filter((p) => p.kind === 'folder')
                .filter((p) => {
                  if (moveModal.kind === 'folder') {
                    if (p.path === moveModal.path || p.path.startsWith(moveModal.path + '/')) return false;
                  }
                  return true;
                })
                .map((p) => (
                  <li key={p.path}>
                    <button
                      type="button"
                      className="move-folder-item"
                      onClick={() => handleMove(moveModal.path, moveModal.kind, p.path)}
                    >
                      {p.path}
                    </button>
                  </li>
                ))}
            </ul>
            <div className="modal-actions">
              <button type="button" onClick={() => setMoveModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
