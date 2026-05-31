import {
  Global,
  Inject,
  Module,
  OnModuleDestroy,
  type Provider,
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {drizzle, type NodePgDatabase} from 'drizzle-orm/node-postgres';
import {Pool} from 'pg';
import * as schema from './schema';

/** Injection token for the shared PostgreSQL connection pool. */
export const DATABASE_POOL = Symbol('DATABASE_POOL');

/** Injection token for the Drizzle query builder bound to our schema. */
export const DRIZZLE = Symbol('DRIZZLE');

/** Drizzle database type, schema-aware, for typed injection in repositories. */
export type DrizzleDb = NodePgDatabase<typeof schema>;

const poolProvider: Provider = {
  provide: DATABASE_POOL,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    new Pool({
      host: config.getOrThrow<string>('POSTGRES_HOST'),
      port: config.getOrThrow<number>('POSTGRES_PORT'),
      database: config.getOrThrow<string>('POSTGRES_DB'),
      user: config.getOrThrow<string>('POSTGRES_USER'),
      password: config.getOrThrow<string>('POSTGRES_PASSWORD'),
    }),
};

const drizzleProvider: Provider = {
  provide: DRIZZLE,
  inject: [DATABASE_POOL],
  useFactory: (pool: Pool): DrizzleDb => drizzle(pool, {schema}),
};

/**
 * Owns the single `pg` connection pool for the process and the Drizzle instance
 * built on top of it. Global so any module can inject {@link DRIZZLE} (typed
 * queries) or {@link DATABASE_POOL} (raw SQL, e.g. the health check) without
 * re-importing. The pool is closed on shutdown (via `enableShutdownHooks`).
 */
@Global()
@Module({
  providers: [poolProvider, drizzleProvider],
  exports: [DATABASE_POOL, DRIZZLE],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
