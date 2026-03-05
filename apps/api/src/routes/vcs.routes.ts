import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRepoRole } from '../middleware/auth.middleware.js';
import * as vcsService from '../services/vcs.service.js';
import * as blobService from '../services/blob.service.js';
import { prisma } from '../db/prisma.js';
import { param } from '../utils/param.js';

export const vcsRouter = Router({ mergeParams: true });

const createCommitSchema = z.object({
  message: z.string().min(1),
  branch: z.string().min(1).default('main'),
  tree: z.array(z.object({
    path: z.string(),
    kind: z.enum(['file', 'folder']),
    content: z.string().optional(),
  })),
});

const createBranchSchema = z.object({
  name: z.string().min(1).max(255),
  source: z.string().min(1).default('main'),
});

const resetBranchSchema = z.object({
  commit_id: z.string().uuid(),
});

const createTagSchema = z.object({
  name: z.string().min(1).max(255),
  commit_id: z.string().uuid().optional(),
});

vcsRouter.use(requireAuth);
vcsRouter.use(requireRepoRole('developer'));

vcsRouter.get('/commits', async (req: Request, res: Response) => {
  const repoId = param(req, 'id');
  const branch = (req.query.branch as string) || 'main';
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const commits = await vcsService.listCommits(repoId, { branch, limit });
  res.json({ commits });
});

vcsRouter.get('/commits/graph', async (req: Request, res: Response) => {
  const repoId = param(req, 'id');
  const branch = (req.query.branch as string) || 'main';
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const commits = await vcsService.listCommits(repoId, { branch, limit });
  const graph = commits.map((c) => ({
    id: c.id,
    parent_commit_id: c.parent_commit_id,
    message: c.message,
    author_id: c.author_id,
    created_at: c.created_at,
  }));
  res.json({ commits: graph });
});

vcsRouter.post('/commits', requireRepoRole('maintainer'), async (req: Request, res: Response) => {
  const parsed = createCommitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const repoId = param(req, 'id');
  const repo = (req as any).repo;
  const userId = (req.user as { id: string }).id;
  const { message, branch: branchName, tree } = parsed.data;

  const branch = await vcsService.getBranchByName(repoId, branchName);
  if (!branch) {
    res.status(404).json({ error: 'Branch not found' });
    return;
  }
  if (branch.is_protected) {
    const role = await require('../services/repo.service.js').getRepoRole(repoId, userId);
    if (role !== 'maintainer' && (req.user as { role?: string }).role !== 'super_admin') {
      res.status(403).json({ error: 'Protected branch: maintainer only' });
      return;
    }
  }

  const entries: { path: string; blob_id: string; kind: 'file' | 'folder' }[] = [];
  let parentTree: { path: string; blob_id: string; kind: string }[] = [];
  if (branch.head_commit_id) {
    parentTree = await vcsService.getTreeEntries(branch.head_commit_id);
  }
  const parentByPath = new Map(parentTree.map((e) => [e.path, e]));

  for (const e of tree) {
    if (e.kind === 'folder') {
      const blobId = blobService.computeBlobId('');
      await blobService.putBlob(repoId, '');
      entries.push({ path: e.path, blob_id: blobId, kind: 'folder' });
    } else if (e.content !== undefined && e.content !== null) {
      const blobId = await blobService.putBlob(repoId, e.content);
      entries.push({ path: e.path, blob_id: blobId, kind: 'file' });
    } else {
      const parent = parentByPath.get(e.path);
      if (parent) {
        entries.push({ path: e.path, blob_id: parent.blob_id, kind: 'file' });
      } else {
        const blobId = await blobService.putBlob(repoId, '');
        entries.push({ path: e.path, blob_id: blobId, kind: 'file' });
      }
    }
  }

  const commit = await vcsService.createCommit({
    repoId,
    authorId: userId,
    parentCommitId: branch.head_commit_id,
    message,
  });
  await vcsService.insertTreeEntries(commit.id, entries);
  await vcsService.setBranchHead(branch.id, commit.id);

  res.status(201).json({ commit });
});

vcsRouter.get('/branches', async (req: Request, res: Response) => {
  const repoId = param(req, 'id');
  const branches = await vcsService.listBranches(repoId);
  const defaultBranch = (req as any).repo?.default_branch_name || 'main';
  res.json({
    branches: branches.map((b) => ({
      ...b,
      is_default: b.name === defaultBranch,
    })),
  });
});

vcsRouter.post('/branches', async (req: Request, res: Response) => {
  const parsed = createBranchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const repoId = param(req, 'id');
  const sourceBranch = await vcsService.getBranchByName(repoId, parsed.data.source);
  if (!sourceBranch) {
    res.status(404).json({ error: 'Source branch not found' });
    return;
  }
  const existing = await vcsService.getBranchByName(repoId, parsed.data.name);
  if (existing) {
    res.status(409).json({ error: 'Branch already exists' });
    return;
  }
  const branch = await vcsService.createBranch({
    repoId,
    name: parsed.data.name,
    headCommitId: sourceBranch.head_commit_id,
    isProtected: false,
  });
  res.status(201).json({ branch });
});

vcsRouter.delete('/branches/:name', async (req: Request, res: Response) => {
  const repoId = param(req, 'id');
  const name = param(req, 'name');
  const repo = (req as any).repo;
  if (name === (repo?.default_branch_name || 'main')) {
    res.status(400).json({ error: 'Cannot delete default branch' });
    return;
  }
  const branch = await vcsService.getBranchByName(repoId, name);
  if (!branch) {
    res.status(404).json({ error: 'Branch not found' });
    return;
  }
  await prisma.branch.delete({ where: { id: branch.id } });
  res.json({ ok: true });
});

vcsRouter.patch('/branches/:name', requireRepoRole('maintainer'), async (req: Request, res: Response) => {
  const repoId = param(req, 'id');
  const name = param(req, 'name');
  const isProtected = req.body.is_protected === true;
  const branch = await vcsService.getBranchByName(repoId, name);
  if (!branch) {
    res.status(404).json({ error: 'Branch not found' });
    return;
  }
  await prisma.branch.update({
    where: { id: branch.id },
    data: { isProtected },
  });
  res.json({ branch: { ...branch, is_protected: isProtected } });
});

vcsRouter.post('/branches/:name/reset', requireRepoRole('maintainer'), async (req: Request, res: Response) => {
  const parsed = resetBranchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const repoId = param(req, 'id');
  const name = param(req, 'name');
  const branch = await vcsService.getBranchByName(repoId, name);
  if (!branch) {
    res.status(404).json({ error: 'Branch not found' });
    return;
  }
  const commit = await vcsService.getCommitById(parsed.data.commit_id);
  if (!commit || commit.repo_id !== repoId) {
    res.status(404).json({ error: 'Commit not found' });
    return;
  }
  await vcsService.setBranchHead(branch.id, commit.id);
  res.json({ ok: true });
});

vcsRouter.get('/compare', async (req: Request, res: Response) => {
  const base = (req.query.base as string) || 'main';
  const head = (req.query.head as string);
  if (!head) {
    res.status(400).json({ error: 'Missing head param' });
    return;
  }
  const repoId = param(req, 'id');
  const baseCommitId = await vcsService.resolveToCommitId(repoId, base);
  const headCommitId = await vcsService.resolveToCommitId(repoId, head);
  if (!baseCommitId || !headCommitId) {
    res.status(404).json({ error: 'Base or head ref not found' });
    return;
  }
  const [baseTree, headTree] = await Promise.all([
    vcsService.getTreeEntries(baseCommitId),
    vcsService.getTreeEntries(headCommitId),
  ]);
  const basePaths = new Map(baseTree.map((e) => [e.path, e]));
  const headPaths = new Map(headTree.map((e) => [e.path, e]));
  const changes: { path: string; change: 'add' | 'modify' | 'delete'; base_blob_id?: string; head_blob_id?: string }[] = [];
  for (const [path, headEntry] of headPaths) {
    const baseEntry = basePaths.get(path);
    if (!baseEntry) {
      changes.push({ path, change: 'add', head_blob_id: headEntry.blob_id });
    } else if (baseEntry.blob_id !== headEntry.blob_id) {
      changes.push({
        path,
        change: 'modify',
        base_blob_id: baseEntry.blob_id,
        head_blob_id: headEntry.blob_id,
      });
    }
  }
  for (const path of basePaths.keys()) {
    if (!headPaths.has(path)) {
      changes.push({ path, change: 'delete', base_blob_id: basePaths.get(path)!.blob_id });
    }
  }
  res.json({ base: baseCommitId, head: headCommitId, changes });
});

vcsRouter.get('/tags', async (req: Request, res: Response) => {
  const repoId = param(req, 'id');
  const tags = await prisma.tag.findMany({
    where: { repoId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, commitId: true, createdAt: true },
  });
  res.json({
    tags: tags.map((t) => ({ id: t.id, name: t.name, commit_id: t.commitId, created_at: t.createdAt })),
  });
});

vcsRouter.post('/tags', requireRepoRole('maintainer'), async (req: Request, res: Response) => {
  const parsed = createTagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const repoId = param(req, 'id');
  const userId = (req.user as { id: string }).id;
  let commitId: string | null | undefined = parsed.data.commit_id;
  if (!commitId) {
    const branch = await vcsService.getBranchByName(repoId, 'main');
    commitId = branch?.head_commit_id ?? null;
  }
  if (!commitId) {
    res.status(400).json({ error: 'No commit to tag' });
    return;
  }
  const commit = await vcsService.getCommitById(commitId as string);
  if (!commit || commit.repo_id !== repoId) {
    res.status(404).json({ error: 'Commit not found' });
    return;
  }
  const tag = await prisma.tag.upsert({
    where: { repoId_name: { repoId, name: parsed.data.name } },
    create: { repoId, name: parsed.data.name, commitId, createdBy: userId },
    update: { commitId, createdBy: userId },
  });
  res.status(201).json({
    tag: { id: tag.id, name: tag.name, commit_id: tag.commitId, created_at: tag.createdAt },
  });
});

vcsRouter.delete('/tags/:name', requireRepoRole('maintainer'), async (req: Request, res: Response) => {
  const repoId = param(req, 'id');
  const name = param(req, 'name');
  const res_ = await prisma.tag.deleteMany({
    where: { repoId, name },
  });
  if (res_.count === 0) {
    res.status(404).json({ error: 'Tag not found' });
    return;
  }
  res.json({ ok: true });
});
