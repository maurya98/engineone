import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'change-me-in-production',
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  database: {
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/engineone',
  },
  superadmin: {
    email: process.env.SUPERADMIN_EMAIL || 'admin@engineone.local',
    password: process.env.SUPERADMIN_PASSWORD || 'SuperAdmin1!',
  },
  jwt: {
    secret: process.env.JWT_SECRET || process.env.SESSION_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
} as const;
