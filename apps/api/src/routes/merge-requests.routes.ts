import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRepoRole } from '../middleware/auth.middleware.js';
import { prisma } from '../db/prisma.js';
import * as vcsService from '../services/vcs.service.js';
import { param } from '../utils/param.js';

export const mergeRequestsRouter = Router({ mergeParams: true });

const createMRSchema = z.object({
  source_branch: z.string().min(1),
  target_branch: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
});

const updateMRSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(['open', 'closed']).optional(),
});

mergeRequestsRouter.use(requireAuth);
mergeRequestsRouter.use(requireRepoRole('developer'));

mergeRequestsRouter.get('/', async (req: Request, res: Response) => {
  const repoId = param(req, 'id');
  const status = req.query.status as string | undefined;
  const list = await prisma.mergeRequest.findMany({
    where: { repoId, ...(status && { status }) },
    orderBy: { createdAt: 'desc' },
    include: {
      sourceBranch: { select: { name: true } },
      targetBranch: { select: { name: true } },
    },
  });
  res.json({
    merge_requests: list.map((mr) => {
      const withBranches = mr as typeof mr & { sourceBranch: { name: string }; targetBranch: { name: string } };
      return {
        id: mr.id,
        repo_id: mr.repoId,
        source_branch_id: mr.sourceBranchId,
        target_branch_id: mr.targetBranchId,
        source_branch_name: withBranches.sourceBranch.name,
        target_branch_name: withBranches.targetBranch.name,
        title: mr.title,
        description: mr.description,
        status: mr.status,
        author_id: mr.authorId,
        merge_commit_id: mr.mergeCommitId,
        created_at: mr.createdAt,
        updated_at: mr.updatedAt,
      };
    }),
  });
});

mergeRequestsRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createMRSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const repoId = param(req, 'id');
  const userId = (req.user as { id: string }).id;
  const sourceBranch = await vcsService.getBranchByName(repoId, parsed.data.source_branch);
  const targetBranch = await vcsService.getBranchByName(repoId, parsed.data.target_branch);
  if (!sourceBranch || !targetBranch) {
    res.status(404).json({ error: 'Source or target branch not found' });
    return;
  }
  const mr = await prisma.mergeRequest.create({
    data: {
      repoId,
      sourceBranchId: sourceBranch.id,
      targetBranchId: targetBranch.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      authorId: userId,
    },
  });
  res.status(201).json({
    merge_request: {
      id: mr.id,
      repo_id: mr.repoId,
      source_branch_id: mr.sourceBranchId,
      target_branch_id: mr.targetBranchId,
      title: mr.title,
      description: mr.description,
      status: mr.status,
      author_id: mr.authorId,
      merge_commit_id: mr.mergeCommitId,
      created_at: mr.createdAt,
      updated_at: mr.updatedAt,
    },
  });
});

mergeRequestsRouter.get('/:mrId', async (req: Request, res: Response) => {
  const mrId = param(req, 'mrId');
  const repoId = param(req, 'id');
  const mr = await prisma.mergeRequest.findFirst({
    where: { id: mrId, repoId },
    include: {
      sourceBranch: { select: { name: true } },
      targetBranch: { select: { name: true } },
    },
  });
  if (!mr) {
    res.status(404).json({ error: 'Merge request not found' });
    return;
  }
  const watchers = await prisma.mergeRequestWatcher.findMany({
    where: { mergeRequestId: mrId },
    select: { userId: true },
  });
  const withBranches = mr as typeof mr & { sourceBranch: { name: string }; targetBranch: { name: string } };
  res.json({
    merge_request: {
      id: mr.id,
      repo_id: mr.repoId,
      source_branch_id: mr.sourceBranchId,
      target_branch_id: mr.targetBranchId,
      source_branch_name: withBranches.sourceBranch.name,
      target_branch_name: withBranches.targetBranch.name,
      title: mr.title,
      description: mr.description,
      status: mr.status,
      author_id: mr.authorId,
      merge_commit_id: mr.mergeCommitId,
      created_at: mr.createdAt,
      updated_at: mr.updatedAt,
    },
    watchers: watchers.map((w) => w.userId),
  });
});

mergeRequestsRouter.patch('/:mrId', async (req: Request, res: Response) => {
  const parsed = updateMRSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const mrId = param(req, 'mrId');
  const repoId = param(req, 'id');
  const mr = await prisma.mergeRequest.updateMany({
    where: { id: mrId, repoId },
    data: {
      ...(parsed.data.title != null && { title: parsed.data.title }),
      ...(parsed.data.description != null && { description: parsed.data.description }),
      ...(parsed.data.status != null && { status: parsed.data.status }),
    },
  });
  if (mr.count === 0) {
    res.status(404).json({ error: 'Merge request not found' });
    return;
  }
  const updated = await prisma.mergeRequest.findFirst({
    where: { id: mrId, repoId },
  });
  res.json({
    merge_request: updated
      ? {
          id: updated.id,
          repo_id: updated.repoId,
          source_branch_id: updated.sourceBranchId,
          target_branch_id: updated.targetBranchId,
          title: updated.title,
          description: updated.description,
          status: updated.status,
          author_id: updated.authorId,
          merge_commit_id: updated.mergeCommitId,
          created_at: updated.createdAt,
          updated_at: updated.updatedAt,
        }
      : null,
  });
});

mergeRequestsRouter.post('/:mrId/merge', requireRepoRole('maintainer'), async (req: Request, res: Response) => {
  const mrId = param(req, 'mrId');
  const repoId = param(req, 'id');
  const userId = (req.user as { id: string }).id;
  const mrRow = await prisma.mergeRequest.findFirst({
    where: { id: mrId, repoId },
  });
  if (!mrRow || mrRow.status !== 'open') {
    res.status(400).json({ error: 'Merge request not found or not open' });
    return;
  }
  const targetBranch = await vcsService.getBranchById(mrRow.targetBranchId);
  const sourceBranch = await vcsService.getBranchById(mrRow.sourceBranchId);
  if (!targetBranch || !sourceBranch) {
    res.status(400).json({ error: 'Branch not found' });
    return;
  }
  if (!sourceBranch.head_commit_id) {
    res.status(400).json({ error: 'Source branch has no commits' });
    return;
  }
  const commit = await vcsService.createCommit({
    repoId,
    authorId: userId,
    parentCommitId: targetBranch.head_commit_id,
    message: `Merge ${sourceBranch.name} into ${targetBranch.name}`,
  });
  const sourceTree = await vcsService.getTreeEntries(sourceBranch.head_commit_id);
  const entries = sourceTree.map((e) => ({ path: e.path, blob_id: e.blob_id, kind: e.kind }));
  await vcsService.insertTreeEntries(commit.id, entries);
  await vcsService.setBranchHead(targetBranch.id, commit.id);
  await prisma.mergeRequest.update({
    where: { id: mrId },
    data: { status: 'merged', mergeCommitId: commit.id },
  });
  res.json({
    merge_request: {
      id: mrRow.id,
      repo_id: mrRow.repoId,
      source_branch_id: mrRow.sourceBranchId,
      target_branch_id: mrRow.targetBranchId,
      title: mrRow.title,
      description: mrRow.description,
      status: 'merged',
      author_id: mrRow.authorId,
      merge_commit_id: commit.id,
      created_at: mrRow.createdAt,
      updated_at: mrRow.updatedAt,
    },
  });
});

mergeRequestsRouter.post('/:mrId/watchers', async (req: Request, res: Response) => {
  const userId = (req.user as { id: string }).id;
  const mrId = param(req, 'mrId');
  await prisma.mergeRequestWatcher.upsert({
    where: { mergeRequestId_userId: { mergeRequestId: mrId, userId } },
    create: { mergeRequestId: mrId, userId },
    update: {},
  });
  res.json({ ok: true });
});

mergeRequestsRouter.delete('/:mrId/watchers/me', async (req: Request, res: Response) => {
  const userId = (req.user as { id: string }).id;
  await prisma.mergeRequestWatcher.deleteMany({
    where: { mergeRequestId: param(req, 'mrId'), userId },
  });
  res.json({ ok: true });
});
