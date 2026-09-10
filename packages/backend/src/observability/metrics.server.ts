import {createServer, type Server} from 'node:http';
import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {MetricsService} from './metrics.service';

/**
 * Minimal HTTP listener that exposes the worker's Prometheus registry.
 *
 * The worker is a Nest *application context*, not an HTTP app - it has no
 * controllers - but Prometheus scrapes per pod, and the worker is the process
 * that actually spends money on LLM calls. Rather than turn the worker into a
 * full HTTP server (and inherit the middleware, CORS and routing surface that
 * comes with it), this is a bare node:http server answering exactly two paths.
 */
@Injectable()
export class MetricsServer implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MetricsServer.name);
  private server?: Server;

  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService
  ) {}

  onModuleInit(): void {
    const port = this.config.get<number>('METRICS_PORT') ?? 9091;
    this.server = createServer((req, res) => {
      // A liveness path too, so the worker Deployment can have a real probe
      // instead of relying on "the process has not exited yet".
      if (req.url === '/healthz') {
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('ok');
        return;
      }
      if (req.url !== '/metrics') {
        res.writeHead(404).end();
        return;
      }
      this.metrics
        .collect()
        .then(body => {
          res.writeHead(200, {
            'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          });
          res.end(body);
        })
        .catch((err: unknown) => {
          // A failing scrape must never take the worker down; report 500 and
          // let the missing series be the alert.
          this.logger.warn(`Metrics collection failed: ${String(err)}`);
          res.writeHead(500).end();
        });
    });
    this.server.listen(port, () =>
      this.logger.log(`Worker metrics listening on port ${port}`)
    );
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>(resolve => this.server?.close(() => resolve()));
  }
}
