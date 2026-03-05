import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { UserSafe } from '../types/user.js';
import type { JwtPayload } from '../types/user.js';

/**
 * Extracts and verifies JWT from Authorization: Bearer <token>.
 * Sets req.user when token is valid; does not send 401 if token is missing
 * (so public routes still work). Use requireAuth after this for protected routes.
 */
export function jwtAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token =
    authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-access-token'] as string) ?? null;

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    const user: UserSafe = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role as UserSafe['role'],
      display_name: decoded.display_name,
      created_at: decoded.created_at,
    };
    (req as Request & { user: UserSafe }).user = user;
  } catch {
    // Invalid or expired token – leave req.user unset; requireAuth will return 401
  }
  next();
}
