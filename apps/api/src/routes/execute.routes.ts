import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import { prisma } from '../db/prisma.js';
import * as treeService from '../services/tree.service.js';
import * as repoService from '../services/repo.service.js';

export const executeRouter = Router();

const executeSchema = z.object({
  repoId: z.string().uuid(),
  context: z.record(z.unknown()),
  branch: z.string().optional(),
});

async function validateApiKey(key: string): Promise<{ repoId: string } | { workspaceId: string } | null> {
  const keyHash = createHash('sha256').update(key).digest('hex');
  const row = await prisma.apiKey.findFirst({
    where: { keyHash },
    select: { repoId: true, workspaceId: true },
  });
  if (!row) return null;
  if (row.repoId) return { repoId: row.repoId };
  if (row.workspaceId) return { workspaceId: row.workspaceId };
  return null;
}

executeRouter.post('/', async (req: Request, res: Response) => {
  const apiKey = req.headers['x-api-key'] as string || req.body?.apiKey;
  if (!apiKey) {
    res.status(401).json({ error: 'Missing API key (X-Api-Key header or body.apiKey)' });
    return;
  }
  const scope = await validateApiKey(apiKey);
  if (!scope) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  const parsed = executeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { repoId, context, branch: branchName } = parsed.data;
  if ('repoId' in scope && scope.repoId !== repoId) {
    res.status(403).json({ error: 'API key does not have access to this repo' });
    return;
  }
  if ('workspaceId' in scope) {
    const repo = await repoService.getRepositoryById(repoId);
    if (!repo || repo.workspace_id !== scope.workspaceId) {
      res.status(403).json({ error: 'API key does not have access to this repo' });
      return;
    }
  }

  const branch = branchName || (await repoService.getRepositoryById(repoId))?.default_branch_name || 'main';
  const content = await treeService.getFileContent(repoId, branch, 'index.json');
  if (content === null) {
    res.status(404).json({ error: 'index.json not found in branch' });
    return;
  }

  let result: unknown;
  try {
    const { ZenEngine } = await import('@gorules/zen-engine');
    const engine = new ZenEngine();
    const graph = JSON.parse(content);
    const decision = engine.createDecision(graph);
    result = await decision.evaluate(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Execution failed';
    res.status(500).json({ error: 'Rule execution failed', details: message });
    return;
  }
  res.json({ result });
});
