import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// WAL mode for Litestream
prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL').catch(() => {})

export default prisma