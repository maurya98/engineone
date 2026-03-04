import type { UserSafe } from './types/user.js';

declare global {
  namespace Express {
    interface Request {
      login: (user: UserSafe, callback: (err?: Error) => void) => void;
      logout: (callback: (err?: Error) => void) => void;
      isAuthenticated: () => boolean;
    }
  }
}

export {};
