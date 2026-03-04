import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import session from 'express-session';
import { createClient } from 'redis';
import passport from 'passport';
import { config } from './config.js';
import './config/passport.js';
import { authRouter } from './routes/auth.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { workspacesRouter } from './routes/workspaces.routes.js';
import { reposRouter } from './routes/repos.routes.js';
import { executeRouter } from './routes/execute.routes.js';

export async function createApp() {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  let sessionStore: session.Store;
  try {
    const redisClient = createClient({ url: config.redis.url });
    await redisClient.connect();
    const RedisStoreClass = (await import('connect-redis')).default as any;
    sessionStore = new RedisStoreClass({ client: redisClient });
  } catch {
    console.warn('Redis not available, using memory session store');
    sessionStore = new session.MemoryStore();
  }

  app.use(
    session({
      store: sessionStore,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.nodeEnv === 'production',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/workspaces', workspacesRouter);
  app.use('/repos', reposRouter);
  app.use('/execute', executeRouter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
