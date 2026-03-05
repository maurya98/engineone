import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import passport from 'passport';
import { jwtAuth } from './middleware/jwt.middleware.js';
import './config/passport.js';
import { authRouter } from './routes/auth.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { workspacesRouter } from './routes/workspaces.routes.js';
import { reposRouter } from './routes/repos.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { executeRouter } from './routes/execute.routes.js';
import { simulateRouter } from './routes/simulate.routes.js';

export async function createApp() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  app.use(passport.initialize());
  // JWT-only auth: verify Bearer token and set req.user on protected routes
  app.use(jwtAuth);

  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/workspaces', workspacesRouter);
  app.use('/repos', reposRouter);
  app.use('/admin', adminRouter);
  app.use('/execute', executeRouter);
  app.use('/simulate', simulateRouter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
