import { prisma } from '../db/prisma.js';
import type { Repository } from '../types/workspace.js';
import * as vcsService from './vcs.service.js';

function toRepository(r: {
  id: string;
  workspaceId: string;
  name: string;
  defaultBranchName: string;
  createdAt: Date;
  updatedAt: Date;
}): Repository {
  return {
    id: r.id,
    workspace_id: r.workspaceId,
    name: r.name,
    default_branch_name: r.defaultBranchName,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export async function createRepository(params: {
  workspaceId: string;
  name: string;
  defaultBranchName?: string;
  authorId: string;
}): Promise<Repository> {
  const defaultBranchName = params.defaultBranchName ?? 'main';
  const repo = await prisma.repository.create({
    data: {
      workspaceId: params.workspaceId,
      name: params.name,
      defaultBranchName,
    },
  });
  const commit = await vcsService.createCommit({
    repoId: repo.id,
    authorId: params.authorId,
    parentCommitId: null,
    message: 'Initial commit',
  });
  await vcsService.createBranch({
    repoId: repo.id,
    name: defaultBranchName,
    headCommitId: commit.id,
    isProtected: defaultBranchName === 'main',
  });
  return toRepository(repo);
}

export async function getRepositoryById(id: string): Promise<Repository | null> {
  const r = await prisma.repository.findUnique({
    where: { id },
  });
  return r ? toRepository(r) : null;
}

export async function listRepositoriesByWorkspace(workspaceId: string): Promise<Repository[]> {
  const list = await prisma.repository.findMany({
    where: { workspaceId },
    orderBy: { name: 'asc' },
  });
  return list.map(toRepository);
}

export async function updateRepository(
  id: string,
  data: { name?: string; default_branch_name?: string }
): Promise<Repository | null> {
  const updates: { name?: string; defaultBranchName?: string } = {};
  if (data.name != null) updates.name = data.name;
  if (data.default_branch_name != null) updates.defaultBranchName = data.default_branch_name;
  if (Object.keys(updates).length === 0) {
    const r = await prisma.repository.findUnique({ where: { id } });
    return r ? toRepository(r) : null;
  }
  const r = await prisma.repository.update({
    where: { id },
    data: updates,
  });
  return toRepository(r);
}

export async function deleteRepository(id: string): Promise<boolean> {
  const result = await prisma.repository.deleteMany({
    where: { id },
  });
  return result.count > 0;
}

export async function getRepoRole(
  repoId: string,
  userId: string
): Promise<'maintainer' | 'developer' | 'qa' | null> {
  const m = await prisma.repoMember.findUnique({
    where: { repoId_userId: { repoId, userId } },
  });
  if (!m) return null;
  return m.role as 'maintainer' | 'developer' | 'qa';
}

export async function addRepoMember(
  repoId: string,
  userId: string,
  role: 'maintainer' | 'developer' | 'qa'
): Promise<void> {
  await prisma.repoMember.upsert({
    where: { repoId_userId: { repoId, userId } },
    create: { repoId, userId, role },
    update: { role },
  });
}

export async function removeRepoMember(repoId: string, userId: string): Promise<boolean> {
  const result = await prisma.repoMember.deleteMany({
    where: { repoId, userId },
  });
  return result.count > 0;
}
