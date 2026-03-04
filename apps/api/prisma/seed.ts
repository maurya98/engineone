import bcrypt from 'bcrypt';
import { prisma } from '../src/db/prisma.js';
import { config } from '../src/config.js';

const SALT_ROUNDS = 12;

async function seed() {
  const existing = await prisma.user.findFirst({
    where: { role: 'super_admin' },
  });
  if (existing) {
    console.log('Superadmin already exists:', existing.email);
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

seed()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
