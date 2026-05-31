import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Job, Queue, Worker} from 'bullmq';
import {bullConnection} from '../queue/bull-connection';
import {
  FEED_POLL_QUEUE,
  FEED_POLL_QUEUE_NAME,
  FeedPollJob,
  PollFeedPayload,
} from '../queue/queue.constants';
import {FeedPollService} from './feed-poll.service';

/**
 * BullMQ consumer for the feed-poll queue. Thin glue: it owns the Worker
 * lifecycle and dispatches by job name to {@link FeedPollService}. `poll-all`
 * fans out one `poll-feed` job per active feed so each feed is an independent,
 * retryable unit of work.
 */
@Injectable()
export class FeedPollWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FeedPollWorker.name);
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly pollService: FeedPollService,
    @Inject(FEED_POLL_QUEUE) private readonly queue: Queue
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(FEED_POLL_QUEUE_NAME, job => this.process(job), {
      connection: bullConnection(this.config),
      concurrency: this.config.getOrThrow<number>('WORKER_CONCURRENCY'),
    });
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Job ${job?.id ?? '?'} failed: ${err.message}`)
    );
    this.logger.log('Feed-poll worker listening');
  }

  private async process(job: Job): Promise<unknown> {
    if (job.name === FeedPollJob.PollAll) {
      const ids = await this.pollService.activeFeedIds();
      await this.queue.addBulk(
        ids.map(feedId => ({
          name: FeedPollJob.PollFeed,
          data: {feedId} satisfies PollFeedPayload,
        }))
      );
      return {enqueued: ids.length};
    }
    if (job.name === FeedPollJob.PollFeed) {
      const {feedId} = job.data as PollFeedPayload;
      return this.pollService.pollFeed(feedId);
    }
    throw new Error(`Unknown job name: ${job.name}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
