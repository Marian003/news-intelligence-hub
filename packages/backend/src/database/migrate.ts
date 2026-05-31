import {join} from 'node:path';
import {Logger} from '@nestjs/common';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {Pool} from 'pg';
import {validateEnv} from '../config/env.validation';

/**
 * Standalone migration runner. Run as its own short-lived process (a dedicated
 * compose service) before the backend starts, so schema changes are applied
 * exactly once and the API never races to migrate on boot. Applies every
 * committed SQL file under ./drizzle in order, then exits.
 */
async function run(): Promise<void> {
  const env = validateEnv(process.env);
  const logger = new Logger('Migrate');
  const pool = new Pool({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
  });
  try {
    const db = drizzle(pool);
    // ./drizzle sits next to the compiled dist/ in the image (and in the repo).
    const migrationsFolder = join(__dirname, '..', '..', 'drizzle');
    await migrate(db, {migrationsFolder});
    logger.log('Migrations applied');
  } finally {
    await pool.end();
  }
}

run().catch((err: unknown) => {
  new Logger('Migrate').error('Migration failed', err);
  // Non-zero exit so the compose dependency fails fast instead of starting the
  // backend against an un-migrated database. The process ends once the event
  // loop drains (the pool is already closed in run()'s finally block).
  process.exitCode = 1;
});
