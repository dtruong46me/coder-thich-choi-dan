import { loadEnvConfig } from '@next/env'
import { defineConfig } from 'drizzle-kit'

// drizzle-kit does not read .env.local on its own.
loadEnvConfig(process.cwd())

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  // Migrations run with a separate, schema-owning role (MIGRATION_DATABASE_URL in CI).
  dbCredentials: { url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
})
