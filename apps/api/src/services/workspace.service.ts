import { prisma } from '../db/prisma.js';
import type { Workspace } from '../types/workspace.js';

function toWorkspace(w: { id: string; name: string; createdBy: string; createdAt: Date; updatedAt: Date }): Workspace {
  return {
    id: w.id,
    name: w.name,
    created_by: w.createdBy,
    created_at: w.createdAt,
    updated_at: w.updatedAt,
  };
}

export async function createWorkspace(params: {
  name: string;
  createdBy: string;
}): Promise<Workspace> {
  const w = await prisma.workspace.create({
    data: {
      name: params.name,
      createdBy: params.createdBy,
      members: {
        create: { userId: params.createdBy, role: 'admin' },
      },
    },
  });
  return toWorkspace(w);
}

export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  const w = await prisma.workspace.findUnique({
    where: { id },
  });
  return w ? toWorkspace(w) : null;
}

export async function listWorkspacesForUser(userId: string): Promise<Workspace[]> {
  const list = await prisma.workspace.findMany({
    where: { members: { some: { userId } } },
    orderBy: { name: 'asc' },
  });
  return list.map(toWorkspace);
}

export async function updateWorkspace(
  id: string,
  data: { name?: string }
): Promise<Workspace | null> {
  if (data.name == null) {
    const w = await prisma.workspace.findUnique({ where: { id } });
    return w ? toWorkspace(w) : null;
  }
  const w = await prisma.workspace.update({
    where: { id },
    data: { name: data.name },
  });
  return toWorkspace(w);
}

export async function deleteWorkspace(id: string): Promise<boolean> {
  const result = await prisma.workspace.deleteMany({
    where: { id },
  });
  return result.count > 0;
}

export async function getWorkspaceRole(
  workspaceId: string,
  userId: string
): Promise<'admin' | 'member' | null> {
  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!m) return null;
  return m.role as 'admin' | 'member';
}

/** True if user can see the workspace (workspace member or member of at least one repo in it). */
export async function hasWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  const role = await getWorkspaceRole(workspaceId, userId);
  if (role) return true;
  const count = await prisma.repository.count({
    where: {
      workspaceId,
      members: { some: { userId } },
    },
  });
  return count > 0;
}

export async function listAllWorkspaces(): Promise<Workspace[]> {
  const list = await prisma.workspace.findMany({
    orderBy: { name: 'asc' },
  });
  return list.map(toWorkspace);
}

export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: 'admin' | 'member'
): Promise<void> {
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    create: { workspaceId, userId, role },
    update: { role },
  });
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: 'admin' | 'member'
): Promise<void> {
  await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId } },
    data: { role },
  });
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const result = await prisma.workspaceMember.deleteMany({
    where: { workspaceId, userId },
  });
  return result.count > 0;
}
