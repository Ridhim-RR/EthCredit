/**
 * Prisma Client singleton to avoid connection exhaustion.
 * The PrismaClient is instantiated only once and reused across the app.
 */

const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

module.exports = prisma;
