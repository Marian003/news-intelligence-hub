import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import {Pool} from 'pg';
import type {Redis} from 'ioredis';
import {DATABASE_POOL} from '../database/database.module';
import {REDIS_CLIENT} from '../redis/redis.module';

interface DependencyCheck {
  ok: boolean;
  error?: string;
}

interface HealthReport {
  status: 'ok' | 'error';
  checks: {database: DependencyCheck; redis: DependencyCheck};
}

/**
 * Liveness/readiness endpoint. Actively pings PostgreSQL and Redis so the
 * compose healthcheck (and any future orchestrator) only reports the backend
 * ready once its dependencies answer. Returns 503 if either is unreachable.
 */
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis
  ) {}

  @Get()
  async check(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);
    const report: HealthReport = {
      status: database.ok && redis.ok ? 'ok' : 'error',
      checks: {database, redis},
    };
    if (report.status === 'error') {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }

  private async checkDatabase(): Promise<DependencyCheck> {
    try {
      await this.pool.query('SELECT 1');
      return {ok: true};
    } catch (err) {
      return {ok: false, error: messageOf(err)};
    }
  }

  private async checkRedis(): Promise<DependencyCheck> {
    try {
      const reply = await this.redis.ping();
      return reply === 'PONG' ? {ok: true} : {ok: false, error: reply};
    } catch (err) {
      return {ok: false, error: messageOf(err)};
    }
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
