import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { UserSafe } from '../types/user.js';
import type { JwtPayload } from '../types/user.js';

/**
 * Signs a JWT for the given user. Use for login/register responses.
 */
export function signToken(user: UserSafe): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    display_name: user.display_name,
    created_at: user.created_at,
  };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}
