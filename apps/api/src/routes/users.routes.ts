import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  findUserById,
  updateUserProfile,
  updateUserPassword,
} from '../services/user.service.js';
import * as repoService from '../services/repo.service.js';
import { prisma } from '../db/prisma.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const updateProfileSchema = z.object({
  display_name: z.string().max(255).nullable().optional(),
});

usersRouter.get('/me', async (req: Request, res: Response) => {
  const id = (req.user as { id: string })?.id;
  if (!id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const user = await findUserById(id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const { toSafeUser } = await import('../types/user.js');
  res.json({ user: toSafeUser(user) });
});

usersRouter.get('/me/repos', async (req: Request, res: Response) => {
  const id = (req.user as { id: string })?.id;
  if (!id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const repositories = await repoService.listRepositoriesForUser(id);
  res.json({ repositories });
});

usersRouter.patch('/me', async (req: Request, res: Response) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const id = (req.user as { id: string })?.id;
  if (!id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const user = await updateUserProfile(id, parsed.data);
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: 'Update failed' });
  }
});

usersRouter.post('/me/change-password', async (req: Request, res: Response) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const id = (req.user as { id: string })?.id;
  if (!id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { verifyPassword } = await import('../services/user.service.js');
  const user = await findUserById(id);
  if (!user?.password_hash) {
    res.status(400).json({ error: 'Cannot change password for this account' });
    return;
  }
  const valid = await verifyPassword(parsed.data.currentPassword, user.password_hash);
  if (!valid) {
    res.status(400).json({ error: 'Current password is incorrect' });
    return;
  }
  await updateUserPassword(id, parsed.data.newPassword);
  res.json({ ok: true });
});

// User preferences (theme, font-size, etc.)
usersRouter.get('/me/preferences', async (req: Request, res: Response) => {
  const id = (req.user as { id: string })?.id;
  if (!id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const prefs = await prisma.userPreferences.findUnique({
    where: { userId: id },
  });
  const out = prefs
    ? {
        theme: prefs.theme,
        font_size: prefs.fontSize,
        font_style: prefs.fontStyle,
        icon_pack: prefs.iconPack,
      }
    : { theme: 'system', font_size: 'medium', font_style: 'default', icon_pack: 'default' };
  res.json({ preferences: out });
});

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  font_size: z.string().optional(),
  font_style: z.string().optional(),
  icon_pack: z.string().optional(),
});

usersRouter.patch('/me/preferences', async (req: Request, res: Response) => {
  const parsed = preferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const id = (req.user as { id: string })?.id;
  if (!id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const prefs = await prisma.userPreferences.upsert({
    where: { userId: id },
    create: {
      userId: id,
      theme: parsed.data.theme ?? 'system',
      fontSize: parsed.data.font_size ?? 'medium',
      fontStyle: parsed.data.font_style ?? 'default',
      iconPack: parsed.data.icon_pack ?? 'default',
    },
    update: {
      ...(parsed.data.theme != null && { theme: parsed.data.theme }),
      ...(parsed.data.font_size != null && { fontSize: parsed.data.font_size }),
      ...(parsed.data.font_style != null && { fontStyle: parsed.data.font_style }),
      ...(parsed.data.icon_pack != null && { iconPack: parsed.data.icon_pack }),
    },
  });
  res.json({
    preferences: {
      theme: prefs.theme,
      font_size: prefs.fontSize,
      font_style: prefs.fontStyle,
      icon_pack: prefs.iconPack,
    },
  });
});
