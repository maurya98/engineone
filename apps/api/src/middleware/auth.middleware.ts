import { Request, Response, NextFunction } from 'express';
import { getWorkspaceRole } from '../services/workspace.service.js';
import { getRepositoryById, getRepoRole } from '../services/repo.service.js';
import { param } from '../utils/param.js';

/**
 * Requires a valid JWT to have been verified (req.user set by jwtAuth middleware).
 * Use after jwtAuth on protected routes.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.user) {
    next();
    return;
  }
  const authHeader = req.headers.authorization;
  const hasToken = authHeader?.startsWith('Bearer ') && authHeader.length > 10;
  const message = hasToken
    ? 'Session expired or invalid. Please sign in again.'
    : 'Authentication required. Please sign in.';
  res.status(401).json({ error: 'Unauthorized', message });
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Valid JWT required' });
    return;
  }
  if ((req.user as { role?: string }).role !== 'super_admin') {
    res.status(403).json({ error: 'Forbidden: super_admin only' });
    return;
  }
  next();
}

export async function requireWorkspaceAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const workspaceId = param(req, 'workspaceId');
  if (!workspaceId) {
    res.status(400).json({ error: 'Missing workspaceId' });
    return;
  }
  const userId = (req.user as { id?: string })?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const role = await getWorkspaceRole(workspaceId, userId);
  const isSuperAdmin = (req.user as { role?: string }).role === 'super_admin';
  if (!isSuperAdmin && (!role || role !== 'admin')) {
    res.status(403).json({ error: 'Forbidden: workspace admin required' });
    return;
  }
  next();
}

export function requireRepoRole(minRole: 'qa' | 'developer' | 'maintainer') {
  const order = { qa: 0, developer: 1, maintainer: 2 };
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const repoId = param(req, 'repoId') || param(req, 'id');
    if (!repoId) {
      res.status(400).json({ error: 'Missing repo id' });
      return;
    }
    const userId = (req.user as { id?: string })?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const repo = await getRepositoryById(repoId);
    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }
    if ((req.user as { role?: string }).role === 'super_admin') {
      (req as any).repo = repo;
      return next();
    }
    const repoRole = await getRepoRole(repoId, userId);
    const wsRole = await getWorkspaceRole(repo.workspace_id, userId);
    const effectiveRole =
      wsRole === 'admin'
        ? 'maintainer'
        : repoRole;
    if (!effectiveRole || order[effectiveRole] < order[minRole]) {
      res.status(403).json({ error: `Forbidden: ${minRole} or higher required` });
      return;
    }
    (req as any).repo = repo;
    next();
  };
}
