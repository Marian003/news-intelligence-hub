import {ConfigService} from '@nestjs/config';
import type {RedisOptions} from 'ioredis';

/**
 * Connection options for BullMQ. BullMQ manages its own Redis connections
 * (separate from the app's shared client) and requires `maxRetriesPerRequest:
 * null` so its blocking commands aren't aborted by ioredis' retry cap.
 */
export function bullConnection(config: ConfigService): RedisOptions {
  return {
    host: config.getOrThrow<string>('REDIS_HOST'),
    port: config.getOrThrow<number>('REDIS_PORT'),
    maxRetriesPerRequest: null,
  };
}
