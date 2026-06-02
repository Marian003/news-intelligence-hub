import {Inject, Injectable, Logger} from '@nestjs/common';
import {Queue} from 'bullmq';
import {DigestRow} from '../database/schema';
import {
  BuildDigestPayload,
  DIGEST_QUEUE,
  DigestJob,
} from '../queue/queue.constants';
import {DigestPeriodValue, DigestsRepository} from './digests.repository';

export interface CreateDigestInput {
  period: DigestPeriodValue;
  categoryIds: string[];
  entityIds: string[];
}

/**
 * API side of digests: persists a pending row and enqueues the build. The actual
 * aggregation + LLM call happen in the worker (Principle 3), so the HTTP request
 * returns immediately with a row the UI can poll.
 */
@Injectable()
export class DigestsService {
  private readonly logger = new Logger(DigestsService.name);

  constructor(
    private readonly digests: DigestsRepository,
    @Inject(DIGEST_QUEUE) private readonly queue: Queue
  ) {}

  async request(userId: string, input: CreateDigestInput): Promise<DigestRow> {
    const digest = await this.digests.createPending(
      userId,
      input.period,
      input.categoryIds,
      input.entityIds
    );
    await this.queue.add(DigestJob.Build, {
      digestId: digest.id,
    } satisfies BuildDigestPayload);
    this.logger.log(`Digest ${digest.id} (${input.period}) enqueued`);
    return digest;
  }

  list(userId: string): Promise<DigestRow[]> {
    return this.digests.listForUser(userId);
  }

  get(id: string, userId: string): Promise<DigestRow | undefined> {
    return this.digests.findForUser(id, userId);
  }
}
