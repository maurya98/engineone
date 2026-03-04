import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import passport from 'passport';
import { createUser, findUserByEmail } from '../services/user.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().max(255).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { email, password, display_name } = parsed.data;
  const existing = await findUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }
  try {
    const user = await createUser({ email, password, display_name });
    req.login(user, (err) => {
      if (err) {
        res.status(500).json({ error: 'Session error' });
        return;
      }
      res.status(201).json({ user });
    });
  } catch (e) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

authRouter.post(
  '/login',
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }
    next();
  },
  passport.authenticate('local', { session: true }),
  (req: Request, res: Response) => {
    res.json({ user: req.user });
  }
);

authRouter.post('/logout', requireAuth, (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) res.status(500).json({ error: 'Logout failed' });
    else res.json({ ok: true });
  });
});

// SAML stub: return 501 until implemented
authRouter.get('/saml/login', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'SAML login not implemented' });
});
authRouter.post('/saml/callback', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'SAML callback not implemented' });
});
