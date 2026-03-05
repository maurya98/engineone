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

/** Repos in this workspace that the user is a member of (for users who have repo-only access). */
export async function listRepositoriesInWorkspaceForUser(
  workspaceId: string,
  userId: string
): Promise<Repository[]> {
  const list = await prisma.repository.findMany({
    where: {
      workspaceId,
      members: { some: { userId } },
    },
    orderBy: { name: 'asc' },
  });
  return list.map(toRepository);
}

/** All repos the user is a member of (for "Your repositories" list).
 * Also includes all repos in workspaces where the user has admin role. */
export async function listRepositoriesForUser(
  userId: string
): Promise<{ id: string; name: string; workspace_id: string; workspace_name: string; default_branch_name: string }[]> {
  const [memberships, adminWorkspaceIds] = await Promise.all([
    prisma.repoMember.findMany({
      where: { userId },
      include: {
        repo: {
          include: { workspace: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.workspaceMember.findMany({
      where: { userId, role: 'admin' },
      select: { workspaceId: true },
    }).then((rows) => rows.map((r) => r.workspaceId)),
  ]);

  const byId = new Map<string, { id: string; name: string; workspace_id: string; workspace_name: string; default_branch_name: string }>();

  for (const m of memberships) {
    byId.set(m.repo.id, {
      id: m.repo.id,
      name: m.repo.name,
      workspace_id: m.repo.workspaceId,
      workspace_name: m.repo.workspace.name,
      default_branch_name: m.repo.defaultBranchName,
    });
  }

  if (adminWorkspaceIds.length > 0) {
    const adminRepos = await prisma.repository.findMany({
      where: { workspaceId: { in: adminWorkspaceIds } },
      include: { workspace: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    for (const r of adminRepos) {
      if (!byId.has(r.id)) {
        byId.set(r.id, {
          id: r.id,
          name: r.name,
          workspace_id: r.workspaceId,
          workspace_name: r.workspace.name,
          default_branch_name: r.defaultBranchName,
        });
      }
    }
  }

  return [...byId.values()].sort(
    (a, b) => a.workspace_name.localeCompare(b.workspace_name) || a.name.localeCompare(b.name)
  );
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

/** All users in the database who are not yet repo members. Optional search by email/display_name. */
export async function listAvailableUsersForRepo(
  repoId: string,
  search?: string
): Promise<{ id: string; email: string; display_name: string | null }[]> {
  const existingRepoUserIds = await prisma.repoMember.findMany({
    where: { repoId },
    select: { userId: true },
  });
  const existingIds = existingRepoUserIds.map((m) => m.userId);
  const searchLower = search?.trim().toLowerCase();
  const users = await prisma.user.findMany({
    where: {
      id: { notIn: existingIds },
      ...(searchLower && {
        OR: [
          { email: { contains: searchLower, mode: 'insensitive' } },
          { displayName: { contains: searchLower, mode: 'insensitive' } },
        ],
      }),
    },
    select: { id: true, email: true, displayName: true },
    orderBy: { email: 'asc' },
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    display_name: u.displayName,
  }));
}
