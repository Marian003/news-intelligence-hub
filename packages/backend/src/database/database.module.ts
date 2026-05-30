import {
  Global,
  Inject,
  Module,
  OnModuleDestroy,
  type Provider,
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Pool} from 'pg';

/** Injection token for the shared PostgreSQL connection pool. */
export const DATABASE_POOL = Symbol('DATABASE_POOL');

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

/**
 * Owns the single `pg` connection pool for the process. Global so any module
 * can inject {@link DATABASE_POOL} without re-importing. The pool is closed on
 * shutdown (enabled via `enableShutdownHooks`) so connections drain cleanly.
 */
@Global()
@Module({
  providers: [poolProvider],
  exports: [DATABASE_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
