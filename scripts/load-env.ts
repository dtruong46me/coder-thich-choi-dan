// Loads .env.local (and friends) the same way `next dev` does. Import it first, before anything that reads process.env.
// @next/env is CommonJS: under ESM only the default import works (drizzle.config.ts, loaded as CJS, uses the named one).
import nextEnv from '@next/env'

nextEnv.loadEnvConfig(process.cwd())
