import { PrismaClient } from "@prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"

// Prisma 7: PrismaLibSql takes a libSQL Config object directly
// (constructor(config: Config, options?)). No createClient wrapper needed.
// Name changed from PrismaLibSQL (v6) to PrismaLibSql (v7) — camelCase.
const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// `as any` is intentional — Prisma 7.8's PrismaClient constructor types
// don't yet advertise the `adapter` param in the public d.ts, but it works
// at runtime. This cast disappears once @prisma/client's types catch up.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter } as any)

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
