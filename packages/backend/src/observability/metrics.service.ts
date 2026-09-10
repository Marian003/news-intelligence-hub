import {Inject, Injectable, OnModuleInit} from '@nestjs/common';
import {Queue} from 'bullmq';
import {Counter, Histogram, Registry, collectDefaultMetrics} from 'prom-client';
import {
  ARTICLE_PROCESS_QUEUE,
  DIGEST_QUEUE,
  FEED_POLL_QUEUE,
} from '../queue/queue.constants';

/**
 * Owns the Prometheus registry and the app's custom metrics.
 *
 * A private registry (rather than prom-client's global default) keeps the test
 * suite from leaking metric state between suites and makes it explicit what
 * this process exposes.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  /** Latency histogram, also the source of the request-rate and error-rate. */
  readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    // Route, not full path: /articles/:id keeps cardinality bounded, whereas
    // one label value per article id would eventually kill the scrape.
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  /**
   * LLM calls by provider and outcome. This is the metric that matters for this
   * app: it is the only line item that costs real money per unit of work, so it
   * gets a first-class counter rather than being inferred from logs.
   */
  readonly llmCalls = new Counter({
    name: 'llm_calls_total',
    help: 'LLM API calls by provider and outcome',
    labelNames: ['provider', 'outcome'] as const,
    registers: [this.registry],
  });

  constructor(
    @Inject(FEED_POLL_QUEUE) private readonly feedPoll: Queue,
    @Inject(ARTICLE_PROCESS_QUEUE) private readonly articleProcess: Queue,
    @Inject(DIGEST_QUEUE) private readonly digest: Queue
  ) {}

  onModuleInit(): void {
    // Node process metrics: heap, event-loop lag, GC, open handles.
    collectDefaultMetrics({register: this.registry, prefix: 'nodejs_'});
  }

  /**
   * Queue depth is read from Redis at scrape time rather than tracked in a
   * gauge the API mutates. The API is not the only producer (the worker
   * enqueues follow-up jobs too), so a locally-maintained gauge would drift;
   * BullMQ's own counts are the single source of truth.
   */
  async collect(): Promise<string> {
    const queues: Array<[string, Queue]> = [
      ['feed-poll', this.feedPoll],
      ['article-process', this.articleProcess],
      ['digest', this.digest],
    ];
    const lines: string[] = [
      '# HELP bullmq_queue_jobs Jobs in a BullMQ queue by state',
      '# TYPE bullmq_queue_jobs gauge',
    ];
    for (const [name, queue] of queues) {
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
        'completed'
      );
      for (const [state, value] of Object.entries(counts)) {
        lines.push(
          `bullmq_queue_jobs{queue="${name}",state="${state}"} ${value ?? 0}`
        );
      }
    }
    const registryMetrics = await this.registry.metrics();
    return `${registryMetrics}\n${lines.join('\n')}\n`;
  }
}
