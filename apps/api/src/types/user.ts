export type UserRole = 'super_admin' | 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  role: UserRole;
  saml_id: string | null;
  display_name: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserSafe {
  id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
  created_at: string;
}

/** JWT payload (claims) stored in the token; must match UserSafe shape. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  display_name: string | null;
  created_at: string;
}

export function toSafeUser(u: User): UserSafe {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    display_name: u.display_name,
    created_at: u.created_at.toISOString(),
  };
}

declare global {
  namespace Express {
    interface User extends UserSafe {}
  }
}
