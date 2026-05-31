import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Job, Worker} from 'bullmq';
import {bullConnection} from '../queue/bull-connection';
import {
  ARTICLE_PROCESS_QUEUE_NAME,
  ProcessArticlePayload,
} from '../queue/queue.constants';
import {ProcessingService} from './processing.service';

/**
 * BullMQ consumer for the article-process queue. Thin glue around
 * {@link ProcessingService}; concurrency is env-driven. Failures propagate so
 * BullMQ applies the queue's retry/backoff.
 */
@Injectable()
export class ProcessingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessingWorker.name);
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly processing: ProcessingService
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      ARTICLE_PROCESS_QUEUE_NAME,
      (job: Job) => {
        const payload = job.data as ProcessArticlePayload;
        return this.processing.processArticle(payload.articleId, payload.mode);
      },
      {
        connection: bullConnection(this.config),
        concurrency: this.config.getOrThrow<number>('WORKER_CONCURRENCY'),
      }
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Job ${job?.id ?? '?'} failed: ${err.message}`)
    );
    this.logger.log('Article-process worker listening');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
