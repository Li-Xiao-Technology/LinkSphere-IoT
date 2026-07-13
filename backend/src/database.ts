import { prisma } from './prisma/client';

export { prisma };

export function setupDatabase(): void {
  console.log('Database initialized with Prisma');
}

export function getDatabase() {
  return prisma;
}

export function closeDatabase(): void {
  console.log('Database connection handled by Prisma');
}
