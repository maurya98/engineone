import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRepoRole } from '../middleware/auth.middleware.js';
import { prisma } from '../db/prisma.js';
import * as vcsService from '../services/vcs.service.js';
import { param } from '../utils/param.js';

export const issuesRouter = Router({ mergeParams: true });

const createIssueSchema = z.object({
  branch: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
});

const updateIssueSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(['open', 'resolved', 'closed']).optional(),
});

issuesRouter.use(requireAuth);
issuesRouter.use(requireRepoRole('qa'));

issuesRouter.get('/', async (req: Request, res: Response) => {
  const repoId = param(req, 'id');
  const branch = req.query.branch as string | undefined;
  const status = req.query.status as string | undefined;
  const where: { repoId: string; branchId?: string; status?: string } = { repoId };
  if (branch) {
    const b = await vcsService.getBranchByName(repoId, branch);
    if (b) where.branchId = b.id;
  }
  if (status) where.status = status;
  const issues = await prisma.issue.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { branch: { select: { name: true } } },
  });
  res.json({
    issues: issues.map((i) => ({
      id: i.id,
      repo_id: i.repoId,
      branch_id: i.branchId,
      branch_name: (i as typeof i & { branch: { name: string } }).branch.name,
      title: i.title,
      description: i.description,
      status: i.status,
      created_by: i.createdBy,
      created_at: i.createdAt,
      updated_at: i.updatedAt,
    })),
  });
});

issuesRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createIssueSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const repoId = param(req, 'id');
  const userId = (req.user as { id: string }).id;
  const branch = await vcsService.getBranchByName(repoId, parsed.data.branch);
  if (!branch) {
    res.status(404).json({ error: 'Branch not found' });
    return;
  }
  const res_ = await prisma.issue.create({
    data: {
      repoId,
      branchId: branch.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      createdBy: userId,
    },
  });
  res.status(201).json({
    issue: {
      id: res_.id,
      repo_id: res_.repoId,
      branch_id: res_.branchId,
      title: res_.title,
      description: res_.description,
      status: res_.status,
      created_by: res_.createdBy,
      created_at: res_.createdAt,
      updated_at: res_.updatedAt,
    },
  });
});

issuesRouter.get('/:issueId', async (req: Request, res: Response) => {
  const issueId = param(req, 'issueId');
  const repoId = param(req, 'id');
  const issue = await prisma.issue.findFirst({
    where: { id: issueId, repoId },
    include: { branch: { select: { name: true } } },
  });
  if (!issue) {
    res.status(404).json({ error: 'Issue not found' });
    return;
  }
  res.json({
    issue: {
      id: issue.id,
      repo_id: issue.repoId,
      branch_id: issue.branchId,
      branch_name: (issue as typeof issue & { branch: { name: string } }).branch.name,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      created_by: issue.createdBy,
      created_at: issue.createdAt,
      updated_at: issue.updatedAt,
    },
  });
});

issuesRouter.patch('/:issueId', async (req: Request, res: Response) => {
  const parsed = updateIssueSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const issueId = param(req, 'issueId');
  const repoId = param(req, 'id');
  const issue = await prisma.issue.updateMany({
    where: { id: issueId, repoId },
    data: {
      ...(parsed.data.title != null && { title: parsed.data.title }),
      ...(parsed.data.description != null && { description: parsed.data.description }),
      ...(parsed.data.status != null && { status: parsed.data.status }),
    },
  });
  if (issue.count === 0) {
    res.status(404).json({ error: 'Issue not found' });
    return;
  }
  const updated = await prisma.issue.findFirst({
    where: { id: issueId, repoId },
  });
  if (!updated) {
    res.status(500).json({ error: 'Update succeeded but issue not found' });
    return;
  }
  res.json({
    issue: {
      id: updated.id,
      repo_id: updated.repoId,
      branch_id: updated.branchId,
      title: updated.title,
      description: updated.description,
      status: updated.status,
      created_by: updated.createdBy,
      created_at: updated.createdAt,
      updated_at: updated.updatedAt,
    },
  });
});
