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
