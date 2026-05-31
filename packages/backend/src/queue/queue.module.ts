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
import {FEED_POLL_QUEUE, FEED_POLL_QUEUE_NAME} from './queue.constants';

const feedPollQueueProvider: Provider = {
  provide: FEED_POLL_QUEUE,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    new Queue(FEED_POLL_QUEUE_NAME, {
      connection: bullConnection(config),
      defaultJobOptions: {
        // Exponential backoff on transient failures; keep history bounded so
        // Redis doesn't grow without limit.
        attempts: 3,
        backoff: {type: 'exponential', delay: 5000},
        removeOnComplete: {count: 200},
        removeOnFail: {count: 500},
      },
    }),
};

/**
 * Provides the BullMQ queues as producers. Global so both the API (which
 * enqueues manual polls) and the worker process can inject them. Queues are
 * closed on shutdown.
 */
@Global()
@Module({
  providers: [feedPollQueueProvider],
  exports: [FEED_POLL_QUEUE],
})
export class QueueModule implements OnModuleDestroy {
  constructor(@Inject(FEED_POLL_QUEUE) private readonly feedPoll: Queue) {}

  async onModuleDestroy(): Promise<void> {
    await this.feedPoll.close();
  }
}
