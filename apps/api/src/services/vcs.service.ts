import { prisma } from '../db/prisma.js';

export interface Branch {
  id: string;
  repo_id: string;
  name: string;
  head_commit_id: string | null;
  is_protected: boolean;
  created_at: Date;
}

export interface Commit {
  id: string;
  repo_id: string;
  author_id: string;
  parent_commit_id: string | null;
  message: string;
  created_at: Date;
}

export interface TreeEntry {
  path: string;
  blob_id: string;
  kind: 'file' | 'folder';
}

function toBranch(b: { id: string; repoId: string; name: string; headCommitId: string | null; isProtected: boolean; createdAt: Date }): Branch {
  return {
    id: b.id,
    repo_id: b.repoId,
    name: b.name,
    head_commit_id: b.headCommitId,
    is_protected: b.isProtected,
    created_at: b.createdAt,
  };
}

function toCommit(c: { id: string; repoId: string; authorId: string; parentCommitId: string | null; message: string; createdAt: Date }): Commit {
  return {
    id: c.id,
    repo_id: c.repoId,
    author_id: c.authorId,
    parent_commit_id: c.parentCommitId,
    message: c.message,
    created_at: c.createdAt,
  };
}

export async function getBranchByName(
  repoId: string,
  name: string
): Promise<Branch | null> {
  const b = await prisma.branch.findFirst({
    where: { repoId, name },
  });
  return b ? toBranch(b) : null;
}

export async function getBranchById(id: string): Promise<Branch | null> {
  const b = await prisma.branch.findUnique({
    where: { id },
  });
  return b ? toBranch(b) : null;
}

export async function createBranch(params: {
  repoId: string;
  name: string;
  headCommitId: string | null;
  isProtected?: boolean;
}): Promise<Branch> {
  const b = await prisma.branch.create({
    data: {
      repoId: params.repoId,
      name: params.name,
      headCommitId: params.headCommitId,
      isProtected: params.isProtected ?? false,
    },
  });
  return toBranch(b);
}

export async function createCommit(params: {
  repoId: string;
  authorId: string;
  parentCommitId: string | null;
  message: string;
}): Promise<Commit> {
  const c = await prisma.commit.create({
    data: {
      repoId: params.repoId,
      authorId: params.authorId,
      parentCommitId: params.parentCommitId,
      message: params.message,
    },
  });
  return toCommit(c);
}

export async function setBranchHead(branchId: string, commitId: string): Promise<void> {
  await prisma.branch.update({
    where: { id: branchId },
    data: { headCommitId: commitId },
  });
}

export async function getTreeEntries(commitId: string): Promise<TreeEntry[]> {
  const entries = await prisma.commitTree.findMany({
    where: { commitId },
    orderBy: { path: 'asc' },
  });
  return entries.map((e) => ({ path: e.path, blob_id: e.blobId, kind: e.kind as 'file' | 'folder' }));
}

export async function insertTreeEntries(
  commitId: string,
  entries: { path: string; blob_id: string; kind: 'file' | 'folder' }[]
): Promise<void> {
  if (entries.length === 0) return;
  await prisma.commitTree.createMany({
    data: entries.map((e) => ({
      commitId,
      path: e.path,
      blobId: e.blob_id,
      kind: e.kind,
    })),
  });
}

export async function listBranches(repoId: string): Promise<Branch[]> {
  const list = await prisma.branch.findMany({
    where: { repoId },
    orderBy: { name: 'asc' },
  });
  return list.map(toBranch);
}

export async function getCommitById(commitId: string): Promise<Commit | null> {
  const c = await prisma.commit.findUnique({
    where: { id: commitId },
  });
  return c ? toCommit(c) : null;
}

export async function resolveToCommitId(
  repoId: string,
  ref: string
): Promise<string | null> {
  const branch = await getBranchByName(repoId, ref);
  if (branch?.head_commit_id) return branch.head_commit_id;
  const commit = await getCommitById(ref);
  if (commit && commit.repo_id === repoId) return commit.id;
  return null;
}

export async function listCommits(
  repoId: string,
  options: { branch?: string; limit?: number } = {}
): Promise<(Commit & { author_email?: string })[]> {
  const { branch, limit = 50 } = options;
  let headCommitId: string | null = null;
  if (branch) {
    const b = await getBranchByName(repoId, branch);
    headCommitId = b?.head_commit_id ?? null;
  } else {
    const latest = await prisma.commit.findFirst({
      where: { repoId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    headCommitId = latest?.id ?? null;
  }
  if (!headCommitId) return [];
  const commits: (Commit & { author_email?: string })[] = [];
  let current: string | null = headCommitId;
  for (let i = 0; i < limit && current; i++) {
    const result = await prisma.commit.findUnique({
      where: { id: current },
      include: { author: { select: { email: true } } },
    }) as { id: string; repoId: string; authorId: string; parentCommitId: string | null; message: string; createdAt: Date; author: { email: string } } | null;
    if (!result) break;
    commits.push({
      ...toCommit(result),
      author_email: result.author.email,
    });
    current = result.parentCommitId;
  }
  return commits;
}
