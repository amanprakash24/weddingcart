import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

// Prisma 7 requires a driver adapter — the connection string is read here, not
// in prisma.config.ts (that file is CLI-only: generate/migrate/studio).
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const adapter = new PrismaPg({ connectionString });

declare global {
  var prisma: PrismaClient | undefined;
}

// Same global-cache pattern as lib/mongodb.ts — avoids exhausting Postgres
// connections across Next.js dev hot-reloads.
export const prisma = global.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
