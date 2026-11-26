import { resolve } from 'node:path';

// Load .env if present (built into Node >= 20.12 / 22).
try { process.loadEnvFile(resolve(process.cwd(), '.env')); } catch { /* no .env file - fine */ }

export function loadConfig(overrides = {}) {
  const env = process.env;
  return {
    port: Number(env.PORT ?? 8000),
    databasePath: env.DATABASE_PATH ?? './talenthub.db', // ':memory:' for an in-memory database
    secretKey: env.SECRET_KEY ?? 'dev-only-secret-change-me-in-production',
    accessTokenExpireMinutes: Number(env.ACCESS_TOKEN_EXPIRE_MINUTES ?? 60),
    coordinatorUsername: env.COORDINATOR_USERNAME ?? 'coordinator',
    coordinatorPassword: env.COORDINATOR_PASSWORD ?? 'Coordinator@123',
    pbkdf2Iterations: 200_000,
    ...overrides,
  };
}
