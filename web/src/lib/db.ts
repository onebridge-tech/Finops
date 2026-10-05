import { PrismaClient } from "@prisma/client";

// One client per process. In dev the instance is kept on globalThis across hot
// reloads, and rebuilt when `prisma generate` produced a new client class, so a
// schema change doesn't leave the server talking through a stale client.
const g = globalThis as unknown as { prisma?: PrismaClient; prismaClass?: typeof PrismaClient };

if (!g.prisma || g.prismaClass !== PrismaClient) {
  void g.prisma?.$disconnect();
  g.prisma = new PrismaClient();
  g.prismaClass = PrismaClient;
}

export const db = g.prisma;
