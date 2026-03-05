import bcrypt from 'bcrypt';
import { prisma } from '../db/prisma.js';
import { toSafeUser } from '../types/user.js';
import type { User, UserSafe } from '../types/user.js';

const SALT_ROUNDS = 12;

function fromPrismaUser(u: {
  id: string;
  email: string;
  passwordHash: string | null;
  role: string;
  samlId: string | null;
  displayName: string | null;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: u.id,
    email: u.email,
    password_hash: u.passwordHash,
    role: u.role as User['role'],
    saml_id: u.samlId,
    display_name: u.displayName,
    created_at: u.createdAt,
    updated_at: u.updatedAt,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const u = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  return u ? fromPrismaUser(u) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const u = await prisma.user.findUnique({
    where: { id },
  });
  return u ? fromPrismaUser(u) : null;
}

export async function createUser(params: {
  email: string;
  password: string;
  role?: User['role'];
  display_name?: string | null;
}): Promise<UserSafe> {
  const { email, password, role = 'user', display_name = null } = params;
  const passwordHash = await hashPassword(password);
  const u = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      role,
      displayName: display_name,
    },
  });
  return toSafeUser(fromPrismaUser(u));
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

export async function updateUserProfile(
  userId: string,
  data: { display_name?: string | null }
): Promise<UserSafe> {
  const u = await prisma.user.update({
    where: { id: userId },
    data: { displayName: data.display_name ?? undefined },
  });
  return toSafeUser(fromPrismaUser(u));
}

export async function updateUserRole(
  userId: string,
  role: User['role']
): Promise<UserSafe> {
  const u = await prisma.user.update({
    where: { id: userId },
    data: { role },
  });
  return toSafeUser(fromPrismaUser(u));
}

export async function deleteUser(userId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      workspacesCreated: { select: { id: true } },
      _count: {
        select: {
          commits: true,
          mergeRequests: true,
          issues: true,
          tagsCreated: true,
        },
      },
    },
  });
  if (!u) {
    return { ok: false, reason: 'User not found' };
  }
  if (u.workspacesCreated.length > 0) {
    return { ok: false, reason: 'Cannot delete user: they own workspaces. Transfer or delete those workspaces first.' };
  }
  const { commits, mergeRequests, issues, tagsCreated } = u._count;
  if (commits > 0 || mergeRequests > 0 || issues > 0 || tagsCreated > 0) {
    return { ok: false, reason: 'Cannot delete user: they have commits, merge requests, issues, or tags. Reassign or remove those first.' };
  }
  try {
    await prisma.user.delete({
      where: { id: userId },
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Cannot delete user: they have associated data that must be removed first.' };
  }
}
