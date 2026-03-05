import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRepoRole } from '../middleware/auth.middleware.js';
import * as repoService from '../services/repo.service.js';
import * as treeService from '../services/tree.service.js';
import { vcsRouter } from './vcs.routes.js';
import { mergeRequestsRouter } from './merge-requests.routes.js';
import { issuesRouter } from './issues.routes.js';
import { wikiRouter } from './wiki.routes.js';
import { prisma } from '../db/prisma.js';
import { param } from '../utils/param.js';

export const reposRouter = Router();

const updateRepoSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  default_branch_name: z.string().min(1).max(255).optional(),
});

const addMemberSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['maintainer', 'developer', 'qa']),
});

reposRouter.use(requireAuth);

reposRouter.get('/:id', requireRepoRole('qa'), async (req: Request, res: Response) => {
  const repo = (req as any).repo;
  res.json({ repository: repo });
});

reposRouter.get('/:id/tree', requireRepoRole('qa'), async (req: Request, res: Response) => {
  const branch = (req.query.branch as string) || (req as any).repo?.default_branch_name || 'main';
  const repoId = param(req, 'id');
  const entries = await treeService.getTreeForBranch(repoId, branch);
  if (entries === null) {
    res.status(404).json({ error: 'Branch not found' });
    return;
  }
  res.json({ branch, tree: entries });
});

reposRouter.get('/:id/files', requireRepoRole('qa'), async (req: Request, res: Response) => {
  const path = req.query.path as string;
  if (!path) {
    res.status(400).json({ error: 'Missing path query' });
    return;
  }
  const branch = (req.query.branch as string) || (req as any).repo?.default_branch_name || 'main';
  const repoId = param(req, 'id');
  const content = await treeService.getFileContent(repoId, branch, path);
  if (content === null) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.send(content);
});

reposRouter.use('/:id', vcsRouter);
reposRouter.use('/:id/merge_requests', mergeRequestsRouter);
reposRouter.use('/:id/issues', issuesRouter);
reposRouter.use('/:id/wiki', wikiRouter);

reposRouter.patch('/:id', requireRepoRole('maintainer'), async (req: Request, res: Response) => {
  const parsed = updateRepoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const updated = await repoService.updateRepository(param(req, 'id'), parsed.data);
  if (!updated) {
    res.status(404).json({ error: 'Repository not found' });
    return;
  }
  res.json({ repository: updated });
});

reposRouter.delete('/:id', requireRepoRole('maintainer'), async (req: Request, res: Response) => {
  const ok = await repoService.deleteRepository(param(req, 'id'));
  if (!ok) {
    res.status(404).json({ error: 'Repository not found' });
    return;
  }
  res.json({ ok: true });
});

reposRouter.get('/:id/members', requireRepoRole('maintainer'), async (req: Request, res: Response) => {
  const repoId = param(req, 'id');
  const members = await prisma.repoMember.findMany({
    where: { repoId },
    include: { user: { select: { email: true } } },
  });
  res.json({
    members: members.map((m) => ({
      user_id: m.userId,
      role: m.role,
      email: (m as typeof m & { user: { email: string } }).user.email,
    })),
  });
});

reposRouter.post('/:id/members', requireRepoRole('maintainer'), async (req: Request, res: Response) => {
  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  await repoService.addRepoMember(param(req, 'id'), parsed.data.user_id, parsed.data.role);
  res.status(201).json({ ok: true });
});

reposRouter.delete('/:id/members/:userId', requireRepoRole('maintainer'), async (req: Request, res: Response) => {
  const ok = await repoService.removeRepoMember(param(req, 'id'), param(req, 'userId'));
  if (!ok) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  res.json({ ok: true });
});
