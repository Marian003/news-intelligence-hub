import {timingSafeEqual} from 'node:crypto';
import {Logger} from '@nestjs/common';
import {createBullBoard} from '@bull-board/api';
import {BullMQAdapter} from '@bull-board/api/bullMQAdapter';
import {ExpressAdapter} from '@bull-board/express';
import {Queue} from 'bullmq';
import express, {type NextFunction, type Request, type Response} from 'express';
import {validateEnv} from './config/env.validation';
import {
  ARTICLE_PROCESS_QUEUE_NAME,
  DIGEST_QUEUE_NAME,
  FEED_POLL_QUEUE_NAME,
} from './queue/queue.constants';

/**
 * Bull Board queue dashboard, run as its own small Express service (not mounted
 * inside the API) and guarded by HTTP basic-auth from env. Read-only visibility
 * into queue state for operators; it never shares the app's request surface.
 */

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function basicAuth(user: string, password: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization ?? '';
    if (header.startsWith('Basic ')) {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      const givenUser = decoded.slice(0, separator);
      const givenPass = decoded.slice(separator + 1);
      if (safeEqual(givenUser, user) && safeEqual(givenPass, password)) {
        next();
        return;
      }
    }
    res
      .set('WWW-Authenticate', 'Basic realm="Bull Board"')
      .status(401)
      .send('Authentication required');
  };
}

function main(): void {
  const env = validateEnv(process.env);
  const connection = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: null,
  };
  const queues = [
    FEED_POLL_QUEUE_NAME,
    ARTICLE_PROCESS_QUEUE_NAME,
    DIGEST_QUEUE_NAME,
  ].map(name => new Queue(name, {connection}));

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/');
  createBullBoard({
    queues: queues.map(queue => new BullMQAdapter(queue)),
    serverAdapter,
  });

  const app = express();
  app.use(basicAuth(env.BULLBOARD_USER, env.BULLBOARD_PASSWORD));
  app.use('/', serverAdapter.getRouter());
  app.listen(env.BULLBOARD_PORT, () =>
    new Logger('BullBoard').log(`Bull Board listening on ${env.BULLBOARD_PORT}`)
  );
}

main();
