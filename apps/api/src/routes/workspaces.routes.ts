import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireSuperAdmin, requireWorkspaceAdmin } from '../middleware/auth.middleware.js';
import * as workspaceService from '../services/workspace.service.js';
import * as repoService from '../services/repo.service.js';
import { param } from '../utils/param.js';

export const workspacesRouter = Router();

const createWorkspaceSchema = z.object({ name: z.string().min(1).max(255) });
const updateWorkspaceSchema = z.object({ name: z.string().min(1).max(255).optional() });
const createRepoSchema = z.object({ name: z.string().min(1).max(255) });

workspacesRouter.use(requireAuth);

workspacesRouter.get('/', async (req: Request, res: Response) => {
  const userId = (req.user as { id: string }).id;
  const list = await workspaceService.listWorkspacesForUser(userId);
  res.json({ workspaces: list });
});

workspacesRouter.post('/', requireSuperAdmin, async (req: Request, res: Response) => {
  const parsed = createWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const userId = (req.user as { id: string }).id;
  const workspace = await workspaceService.createWorkspace({
    name: parsed.data.name,
    createdBy: userId,
  });
  res.status(201).json({ workspace });
});

workspacesRouter.get('/:workspaceId', async (req: Request, res: Response) => {
  const workspaceId = param(req, 'workspaceId');
  const ws = await workspaceService.getWorkspaceById(workspaceId);
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  const userId = (req.user as { id: string }).id;
  const isSuperAdmin = (req.user as { role?: string }).role === 'super_admin';
  const hasAccess = isSuperAdmin || (await workspaceService.hasWorkspaceAccess(ws.id, userId));
  if (!hasAccess) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.json({ workspace: ws });
});

workspacesRouter.patch('/:workspaceId', requireWorkspaceAdmin, async (req: Request, res: Response) => {
  const parsed = updateWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const workspaceId = param(req, 'workspaceId');
  const ws = await workspaceService.updateWorkspace(workspaceId, parsed.data);
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  res.json({ workspace: ws });
});

workspacesRouter.delete('/:workspaceId', requireSuperAdmin, async (req: Request, res: Response) => {
  const workspaceId = param(req, 'workspaceId');
  const ok = await workspaceService.deleteWorkspace(workspaceId);
  if (!ok) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  res.json({ ok: true });
});

workspacesRouter.get('/:workspaceId/repos', async (req: Request, res: Response) => {
  const workspaceId = param(req, 'workspaceId');
  const ws = await workspaceService.getWorkspaceById(workspaceId);
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  const userId = (req.user as { id: string }).id;
  const isSuperAdmin = (req.user as { role?: string }).role === 'super_admin';
  const workspaceRole = await workspaceService.getWorkspaceRole(ws.id, userId);
  const hasAccess = isSuperAdmin || workspaceRole || (await workspaceService.hasWorkspaceAccess(ws.id, userId));
  if (!hasAccess) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const repos =
    isSuperAdmin || workspaceRole
      ? await repoService.listRepositoriesByWorkspace(ws.id)
      : await repoService.listRepositoriesInWorkspaceForUser(ws.id, userId);
  res.json({ repositories: repos });
});

workspacesRouter.post('/:workspaceId/repos', requireWorkspaceAdmin, async (req: Request, res: Response) => {
  const parsed = createRepoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const workspaceId = param(req, 'workspaceId');
  const ws = await workspaceService.getWorkspaceById(workspaceId);
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  const repo = await repoService.createRepository({
    workspaceId: ws.id,
    name: parsed.data.name,
    authorId: (req.user as { id: string }).id,
  });
  res.status(201).json({ repository: repo });
});
