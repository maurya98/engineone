import * as vcsService from './vcs.service.js';
import * as blobService from './blob.service.js';

export interface TreeEntryDto {
  path: string;
  blob_id: string;
  kind: 'file' | 'folder';
}

export async function getTreeForBranch(
  repoId: string,
  branchName: string
): Promise<TreeEntryDto[] | null> {
  const branch = await vcsService.getBranchByName(repoId, branchName);
  if (!branch?.head_commit_id) return [];
  const entries = await vcsService.getTreeEntries(branch.head_commit_id);
  return entries;
}

export async function getFileContent(
  repoId: string,
  branchName: string,
  path: string
): Promise<string | null> {
  const branch = await vcsService.getBranchByName(repoId, branchName);
  if (!branch?.head_commit_id) return null;
  const entries = await vcsService.getTreeEntries(branch.head_commit_id);
  const entry = entries.find((e) => e.path === path && e.kind === 'file');
  if (!entry) return null;
  return blobService.getBlob(repoId, entry.blob_id);
}

export async function getFileContentByCommitId(
  repoId: string,
  commitId: string,
  path: string
): Promise<string | null> {
  const commit = await vcsService.getCommitById(commitId);
  if (!commit || commit.repo_id !== repoId) return null;
  const entries = await vcsService.getTreeEntries(commitId);
  const entry = entries.find((e) => e.path === path && e.kind === 'file');
  if (!entry) return null;
  return blobService.getBlob(repoId, entry.blob_id);
}
