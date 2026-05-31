import {Inject, Injectable, Logger, OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Queue} from 'bullmq';
import {FEED_POLL_QUEUE, FeedPollJob} from '../queue/queue.constants';

/**
 * Registers the recurring "poll all active feeds" job from the configured cron
 * expression. A fixed repeat job id keeps it idempotent across worker restarts
 * (re-adding the same schedule does not pile up duplicates).
 */
@Injectable()
export class FeedPollScheduler implements OnModuleInit {
  private readonly logger = new Logger(FeedPollScheduler.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(FEED_POLL_QUEUE) private readonly queue: Queue
  ) {}

  async onModuleInit(): Promise<void> {
    const pattern = this.config.getOrThrow<string>('FEED_POLL_CRON');
    await this.queue.add(
      FeedPollJob.PollAll,
      {},
      {repeat: {pattern}, jobId: 'scheduled-poll-all'}
    );
    this.logger.log(`Scheduled feed poll registered: "${pattern}"`);
  }
}
