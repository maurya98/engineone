import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRepoRole } from '../middleware/auth.middleware.js';
import { prisma } from '../db/prisma.js';
import { param } from '../utils/param.js';

export const wikiRouter = Router({ mergeParams: true });

const slugRegex = /^[a-z0-9-_]+$/;
const createPageSchema = z.object({
  slug: z.string().min(1).max(255).regex(slugRegex),
  title: z.string().min(1).max(500),
  body: z.string().optional(),
});
const updatePageSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  body: z.string().optional(),
});

wikiRouter.use(requireAuth);
wikiRouter.use(requireRepoRole('qa'));

wikiRouter.get('/', async (req: Request, res: Response) => {
  const repoId = param(req, 'id');
  const pages = await prisma.wikiPage.findMany({
    where: { repoId },
    orderBy: { title: 'asc' },
    select: { id: true, slug: true, title: true, updatedAt: true },
  });
  res.json({
    pages: pages.map((p) => ({ id: p.id, slug: p.slug, title: p.title, updated_at: p.updatedAt })),
  });
});

wikiRouter.get('/:slug', async (req: Request, res: Response) => {
  const repoId = param(req, 'id');
  const slug = param(req, 'slug');
  const page = await prisma.wikiPage.findUnique({
    where: { repoId_slug: { repoId, slug } },
  });
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }
  res.json({
    page: { id: page.id, slug: page.slug, title: page.title, body: page.body, updated_at: page.updatedAt },
  });
});

wikiRouter.post('/', requireRepoRole('developer'), async (req: Request, res: Response) => {
  const parsed = createPageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const repoId = param(req, 'id');
  const page = await prisma.wikiPage.upsert({
    where: { repoId_slug: { repoId, slug: parsed.data.slug } },
    create: {
      repoId,
      slug: parsed.data.slug,
      title: parsed.data.title,
      body: parsed.data.body ?? null,
    },
    update: { title: parsed.data.title, body: parsed.data.body ?? undefined },
  });
  res.status(201).json({
    page: { id: page.id, slug: page.slug, title: page.title, body: page.body, updated_at: page.updatedAt },
  });
});

wikiRouter.patch('/:slug', requireRepoRole('developer'), async (req: Request, res: Response) => {
  const parsed = updatePageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const repoId = param(req, 'id');
  const slug = param(req, 'slug');
  const page = await prisma.wikiPage.update({
    where: { repoId_slug: { repoId, slug } },
    data: {
      ...(parsed.data.title != null && { title: parsed.data.title }),
      ...(parsed.data.body != null && { body: parsed.data.body }),
    },
  });
  res.json({
    page: { id: page.id, slug: page.slug, title: page.title, body: page.body, updated_at: page.updatedAt },
  });
});

wikiRouter.delete('/:slug', requireRepoRole('maintainer'), async (req: Request, res: Response) => {
  try {
    const repoId = param(req, 'id');
    const slug = param(req, 'slug');
    await prisma.wikiPage.delete({
      where: { repoId_slug: { repoId, slug } },
    });
  } catch {
    res.status(404).json({ error: 'Page not found' });
    return;
  }
  res.json({ ok: true });
});
