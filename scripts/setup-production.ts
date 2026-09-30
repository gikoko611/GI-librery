import { createClient } from "@libsql/client"
import bcrypt from "bcryptjs"
import crypto from "node:crypto"

async function main() {
  const url = process.env.DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  const email = process.env.GI_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.GI_ADMIN_PASSWORD

  if (!url) throw new Error("DATABASE_URL is not set")
  if (!authToken) throw new Error("TURSO_AUTH_TOKEN is not set")
  if (!email) throw new Error("GI_ADMIN_EMAIL is not set")
  if (!password) throw new Error("GI_ADMIN_PASSWORD is not set")

  const db = createClient({ url, authToken })

  await db.execute(`PRAGMA foreign_keys = ON`)

  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS "Book" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "title" TEXT NOT NULL,
        "author" TEXT NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "category" TEXT NOT NULL,
        "language" TEXT NOT NULL DEFAULT 'English',
        "cover_url" TEXT NOT NULL,
        "pdf_url" TEXT NOT NULL,
        "page_count" INTEGER NOT NULL DEFAULT 0,
        "file_size" TEXT NOT NULL DEFAULT 'Unknown',
        "tags" TEXT NOT NULL DEFAULT '',
        "published" INTEGER NOT NULL DEFAULT 0,
        "download_count" INTEGER NOT NULL DEFAULT 0,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "email" TEXT NOT NULL UNIQUE,
        "passwordHash" TEXT NOT NULL,
        "name" TEXT,
        "isAdmin" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS "Account" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "userId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "providerAccountId" TEXT NOT NULL,
        "refresh_token" TEXT,
        "access_token" TEXT,
        "expires_at" INTEGER,
        "token_type" TEXT,
        "scope" TEXT,
        "id_token" TEXT,
        "session_state" TEXT,
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
        UNIQUE ("provider", "providerAccountId")
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS "Session" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "sessionToken" TEXT NOT NULL UNIQUE,
        "userId" TEXT NOT NULL,
        "expires" DATETIME NOT NULL,
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS "VerificationToken" (
        "identifier" TEXT NOT NULL,
        "token" TEXT NOT NULL UNIQUE,
        "expires" DATETIME NOT NULL,
        UNIQUE ("identifier", "token")
      )`,
      args: [],
    },
  ])

  const passwordHash = await bcrypt.hash(password, 12)

  const existing = await db.execute({
    sql: `SELECT "id" FROM "User" WHERE "email" = ? LIMIT 1`,
    args: [email],
  })

  if (existing.rows.length > 0) {
    await db.execute({
      sql: `UPDATE "User"
            SET "passwordHash" = ?, "isAdmin" = 1, "name" = ?
            WHERE "email" = ?`,
      args: [passwordHash, "Library Admin", email],
    })
  } else {
    await db.execute({
      sql: `INSERT INTO "User"
            ("id", "email", "passwordHash", "name", "isAdmin")
            VALUES (?, ?, ?, ?, 1)`,
      args: [
        crypto.randomUUID(),
        email,
        passwordHash,
        "Library Admin",
      ],
    })
  }

  console.log("Turso schema ready.")
  console.log("Admin ready.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
