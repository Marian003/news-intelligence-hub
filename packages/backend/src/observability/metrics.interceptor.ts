import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type {Request, Response} from 'express';
import {Observable, tap} from 'rxjs';
import {MetricsService} from './metrics.service';

/**
 * Records duration + status for every HTTP request.
 *
 * Labels use the matched route pattern (`/articles/:id`) rather than the
 * concrete URL, so metric cardinality stays proportional to the number of
 * endpoints instead of growing with traffic.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const stop = this.metrics.httpDuration.startTimer();

    const record = (status: number): void => {
      stop({
        method: request.method,
        route: routeOf(request),
        status: String(status),
      });
    };

    // Both handlers, so failed requests are measured too - a latency chart
    // that silently drops errors hides exactly the incidents you built it to
    // catch. `tap` does not swallow the error; it re-throws after recording.
    return next.handle().pipe(
      tap({
        next: () => record(response.statusCode),
        error: (err: {status?: number}) => record(err?.status ?? 500),
      })
    );
  }
}

function routeOf(request: Request): string {
  const route = (request as {route?: {path?: string}}).route?.path;
  return route ?? 'unmatched';
}
