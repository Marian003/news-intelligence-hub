import {Controller, Get, Header} from '@nestjs/common';
import {MetricsService} from './metrics.service';

/**
 * Prometheus scrape target. Deliberately unauthenticated: in the cluster it is
 * reachable only pod-to-pod (the Ingress does not route to it), and Prometheus
 * has no way to present a JWT. If this were ever exposed publicly it would need
 * a NetworkPolicy or an auth proxy in front - noted in docs/ARCHITECTURE.md.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    return this.metrics.collect();
  }
}
