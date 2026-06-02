import {
  Global,
  Inject,
  Module,
  OnModuleDestroy,
  type Provider,
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Queue} from 'bullmq';
import {bullConnection} from './bull-connection';
import {
  ARTICLE_PROCESS_QUEUE,
  ARTICLE_PROCESS_QUEUE_NAME,
  DIGEST_QUEUE,
  DIGEST_QUEUE_NAME,
  FEED_POLL_QUEUE,
  FEED_POLL_QUEUE_NAME,
} from './queue.constants';

// Shared defaults: exponential backoff on transient failures, bounded history.
const defaultJobOptions = {
  attempts: 3,
  backoff: {type: 'exponential' as const, delay: 5000},
  removeOnComplete: {count: 200},
  removeOnFail: {count: 500},
};

const feedPollQueueProvider: Provider = {
  provide: FEED_POLL_QUEUE,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    new Queue(FEED_POLL_QUEUE_NAME, {
      connection: bullConnection(config),
      defaultJobOptions,
    }),
};

const articleProcessQueueProvider: Provider = {
  provide: ARTICLE_PROCESS_QUEUE,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    new Queue(ARTICLE_PROCESS_QUEUE_NAME, {
      connection: bullConnection(config),
      defaultJobOptions,
    }),
};

const digestQueueProvider: Provider = {
  provide: DIGEST_QUEUE,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    new Queue(DIGEST_QUEUE_NAME, {
      connection: bullConnection(config),
      defaultJobOptions,
    }),
};

/**
 * Provides the BullMQ queues as producers. Global so both the API (which
 * enqueues manual polls) and the worker process can inject them. Queues are
 * closed on shutdown.
 */
@Global()
@Module({
  providers: [
    feedPollQueueProvider,
    articleProcessQueueProvider,
    digestQueueProvider,
  ],
  exports: [FEED_POLL_QUEUE, ARTICLE_PROCESS_QUEUE, DIGEST_QUEUE],
})
export class QueueModule implements OnModuleDestroy {
  constructor(
    @Inject(FEED_POLL_QUEUE) private readonly feedPoll: Queue,
    @Inject(ARTICLE_PROCESS_QUEUE) private readonly articleProcess: Queue,
    @Inject(DIGEST_QUEUE) private readonly digest: Queue
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.feedPoll.close(),
      this.articleProcess.close(),
      this.digest.close(),
    ]);
  }
}
