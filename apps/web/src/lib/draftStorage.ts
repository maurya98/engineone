const PREFIX = 'engineone-draft';

export interface DraftTreeEntry {
  path: string;
  kind: 'file' | 'folder';
  content?: string;
}

export interface DraftStorage {
  draft: Record<string, string>;
  draftTree: DraftTreeEntry[];
  expandedFolders?: string[];
  deletedPaths?: string[];
  savedAt?: number;
}

export function draftStorageKey(repoId: string, branch: string): string {
  return `${PREFIX}-${repoId}-${branch}`;
}

export function loadDraftFromStorage(repoId: string, branch: string): DraftStorage | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(repoId, branch));
    if (!raw) return null;
    const data = JSON.parse(raw) as DraftStorage;
    if (!data || typeof data.draft !== 'object' || !Array.isArray(data.draftTree)) return null;
    return {
      draft: data.draft ?? {},
      draftTree: data.draftTree ?? [],
      expandedFolders: Array.isArray(data.expandedFolders) ? data.expandedFolders : undefined,
      deletedPaths: Array.isArray(data.deletedPaths) ? data.deletedPaths : undefined,
    };
  } catch {
    return null;
  }
}

export function saveDraftToStorage(
  repoId: string,
  branch: string,
  payload: {
    draft: Record<string, string>;
    draftTree: DraftTreeEntry[];
    expandedFolders?: Set<string>;
    deletedPaths?: Set<string>;
  }
): void {
  try {
    const key = draftStorageKey(repoId, branch);
    const data: DraftStorage = {
      draft: payload.draft,
      draftTree: payload.draftTree,
      expandedFolders: payload.expandedFolders ? Array.from(payload.expandedFolders) : undefined,
      deletedPaths: payload.deletedPaths ? Array.from(payload.deletedPaths) : undefined,
      savedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // quota or parse error
  }
}

export function clearDraftStorage(repoId: string, branch: string): void {
  try {
    localStorage.removeItem(draftStorageKey(repoId, branch));
  } catch {
    // ignore
  }
}
