import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.middleware.js';
import { prisma } from '../db/prisma.js';
import { toSafeUser } from '../types/user.js';
import type { User } from '../types/user.js';
import * as userService from '../services/user.service.js';
import * as workspaceService from '../services/workspace.service.js';
import * as repoService from '../services/repo.service.js';
import { param } from '../utils/param.js';

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use(requireSuperAdmin);

/** List all users with workspace and repo memberships */
adminRouter.get('/users', async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    orderBy: { email: 'asc' },
    include: {
      workspaceMembers: {
        include: { workspace: { select: { id: true, name: true } } },
      },
      repoMembers: {
        include: {
          repo: {
            select: {
              id: true,
              name: true,
              workspaceId: true,
              workspace: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  const list = users.map((u) => {
    const safe = toSafeUser({
      id: u.id,
      email: u.email,
      password_hash: u.passwordHash,
      role: u.role,
      saml_id: u.samlId,
      display_name: u.displayName,
      created_at: u.createdAt,
      updated_at: u.updatedAt,
    } as User);
    return {
      ...safe,
      workspace_memberships: u.workspaceMembers.map((m) => ({
        workspace_id: m.workspaceId,
        workspace_name: (m as typeof m & { workspace: { name: string } }).workspace.name,
        role: m.role,
      })),
      repo_memberships: u.repoMembers.map((m) => ({
        repo_id: m.repoId,
        repo_name: (m as typeof m & { repo: { name: string; workspaceId: string; workspace: { name: string } } }).repo.name,
        workspace_id: (m as typeof m & { repo: { workspaceId: string } }).repo.workspaceId,
        workspace_name: (m as typeof m & { repo: { workspace: { name: string } } }).repo.workspace.name,
        role: m.role,
      })),
    };
  });
  res.json({ users: list });
});

const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin', 'super_admin']),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().max(255).optional().nullable(),
  role: z.enum(['user', 'admin', 'super_admin']).optional(),
});

adminRouter.post('/users', async (req: Request, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const existing = await userService.findUserByEmail(parsed.data.email);
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }
  try {
    const user = await userService.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      display_name: parsed.data.display_name ?? null,
      role: parsed.data.role ?? 'user',
    });
    res.status(201).json({ user });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

adminRouter.patch('/users/:userId/role', async (req: Request, res: Response) => {
  const userId = param(req, 'userId');
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const existing = await userService.findUserById(userId);
  if (!existing) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const updated = await userService.updateUserRole(userId, parsed.data.role);
  res.json({ user: updated });
});

adminRouter.delete('/users/:userId', async (req: Request, res: Response) => {
  const userId = param(req, 'userId');
  const currentUserId = (req.user as { id: string }).id;
  if (userId === currentUserId) {
    res.status(400).json({ error: 'Cannot delete your own account' });
    return;
  }
  const result = await userService.deleteUser(userId);
  if (!result.ok) {
    const status = result.reason === 'User not found' ? 404 : 400;
    res.status(status).json({ error: result.reason });
    return;
  }
  res.json({ ok: true });
});

/** List all workspaces (for admin dropdowns) */
adminRouter.get('/workspaces', async (_req: Request, res: Response) => {
  const list = await workspaceService.listAllWorkspaces();
  res.json({
    workspaces: list.map((w) => ({
      id: w.id,
      name: w.name,
      created_by: w.created_by,
    })),
  });
});

/** List all repos with workspace info (for admin dropdowns) */
adminRouter.get('/repos', async (_req: Request, res: Response) => {
  const workspaces = await workspaceService.listAllWorkspaces();
  const repos: { id: string; name: string; workspace_id: string; workspace_name: string }[] = [];
  for (const ws of workspaces) {
    const list = await repoService.listRepositoriesByWorkspace(ws.id);
    for (const r of list) {
      repos.push({
        id: r.id,
        name: r.name,
        workspace_id: r.workspace_id,
        workspace_name: ws.name,
      });
    }
  }
  repos.sort((a, b) => a.workspace_name.localeCompare(b.workspace_name) || a.name.localeCompare(b.name));
  res.json({ repositories: repos });
});

const addWorkspaceMemberSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['admin', 'member']),
});

adminRouter.post('/workspaces/:workspaceId/members', async (req: Request, res: Response) => {
  const workspaceId = param(req, 'workspaceId');
  const parsed = addWorkspaceMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const ws = await workspaceService.getWorkspaceById(workspaceId);
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  const user = await userService.findUserById(parsed.data.user_id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  await workspaceService.addWorkspaceMember(workspaceId, parsed.data.user_id, parsed.data.role);
  res.status(201).json({ ok: true });
});

const updateWorkspaceMemberSchema = z.object({
  role: z.enum(['admin', 'member']),
});

adminRouter.patch('/workspaces/:workspaceId/members/:userId', async (req: Request, res: Response) => {
  const workspaceId = param(req, 'workspaceId');
  const userId = param(req, 'userId');
  const parsed = updateWorkspaceMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const ws = await workspaceService.getWorkspaceById(workspaceId);
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  const current = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!current) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  await workspaceService.updateWorkspaceMemberRole(workspaceId, userId, parsed.data.role);
  res.json({ ok: true });
});

adminRouter.delete('/workspaces/:workspaceId/members/:userId', async (req: Request, res: Response) => {
  const workspaceId = param(req, 'workspaceId');
  const userId = param(req, 'userId');
  const ok = await workspaceService.removeWorkspaceMember(workspaceId, userId);
  if (!ok) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  res.json({ ok: true });
});

const addRepoMemberSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['maintainer', 'developer', 'qa']),
});

adminRouter.post('/repos/:repoId/members', async (req: Request, res: Response) => {
  const repoId = param(req, 'repoId');
  const parsed = addRepoMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const repo = await repoService.getRepositoryById(repoId);
  if (!repo) {
    res.status(404).json({ error: 'Repository not found' });
    return;
  }
  const user = await userService.findUserById(parsed.data.user_id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  await repoService.addRepoMember(repoId, parsed.data.user_id, parsed.data.role);
  res.status(201).json({ ok: true });
});

adminRouter.delete('/repos/:repoId/members/:userId', async (req: Request, res: Response) => {
  const repoId = param(req, 'repoId');
  const userId = param(req, 'userId');
  const ok = await repoService.removeRepoMember(repoId, userId);
  if (!ok) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  res.json({ ok: true });
});

adminRouter.patch('/repos/:repoId/members/:userId', async (req: Request, res: Response) => {
  const repoId = param(req, 'repoId');
  const userId = param(req, 'userId');
  const parsed = z.object({ role: z.enum(['maintainer', 'developer', 'qa']) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const repo = await repoService.getRepositoryById(repoId);
  if (!repo) {
    res.status(404).json({ error: 'Repository not found' });
    return;
  }
  await repoService.addRepoMember(repoId, userId, parsed.data.role);
  res.json({ ok: true });
});
