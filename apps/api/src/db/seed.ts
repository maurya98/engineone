import bcrypt from 'bcrypt';
import { prisma } from './prisma.js';
import { config } from '../config.js';

const SALT_ROUNDS = 12;

export async function seedSuperadmin(): Promise<void> {
  const existing = await prisma.user.findFirst({
    where: { role: 'super_admin' },
  });
  if (existing) {
    return;
  }
  const passwordHash = await bcrypt.hash(config.superadmin.password, SALT_ROUNDS);
  await prisma.user.create({
    data: {
      email: config.superadmin.email,
      passwordHash,
      role: 'super_admin',
      displayName: 'Super Admin',
    },
  });
  console.log('Created default superadmin:', config.superadmin.email);
}
