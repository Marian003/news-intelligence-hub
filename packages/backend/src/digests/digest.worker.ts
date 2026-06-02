import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Job, Worker} from 'bullmq';
import {bullConnection} from '../queue/bull-connection';
import {BuildDigestPayload, DIGEST_QUEUE_NAME} from '../queue/queue.constants';
import {DigestBuilderService} from './digest-builder.service';

/**
 * BullMQ consumer for the digest queue. Thin glue around
 * {@link DigestBuilderService}; failures propagate so BullMQ retries with the
 * queue's backoff, and the digest row is marked `failed` for the UI.
 */
@Injectable()
export class DigestWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DigestWorker.name);
  private worker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly builder: DigestBuilderService
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      DIGEST_QUEUE_NAME,
      (job: Job) =>
        this.builder.build((job.data as BuildDigestPayload).digestId),
      {connection: bullConnection(this.config), concurrency: 1}
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Digest job ${job?.id ?? '?'} failed: ${err.message}`)
    );
    this.logger.log('Digest worker listening');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
