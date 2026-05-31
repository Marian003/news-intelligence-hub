import {z} from 'zod';

/**
 * Schema for the environment the backend reads. Validated once at startup so a
 * misconfigured deployment fails loudly and immediately instead of throwing
 * obscure errors deep in a request. Only the variables the backend currently
 * uses are declared here; each later milestone adds the ones it introduces.
 *
 * `passthrough` keeps any other variables (e.g. those only the workers or the
 * frontend read) available rather than stripping them.
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    BACKEND_PORT: z.coerce.number().int().positive().default(3000),
    // Public origin used to build links (e.g. the dev email-confirmation link).
    APP_PUBLIC_URL: z.string().url().default('http://localhost:3000'),

    POSTGRES_HOST: z.string().min(1),
    POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
    POSTGRES_DB: z.string().min(1),
    POSTGRES_USER: z.string().min(1),
    POSTGRES_PASSWORD: z.string().min(1),

    REDIS_HOST: z.string().min(1),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),

    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    JWT_EXPIRES_IN: z.string().min(1).default('1h'),

    // LLM: active provider + per-call budget. Keys are optional so the stack
    // boots without them; the active adapter fails loudly only when actually
    // called without its key.
    LLM_PROVIDER: z.enum(['openai', 'anthropic']).default('anthropic'),
    LLM_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    LLM_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
    OPENAI_API_KEY: z.string().default(''),
    OPENAI_MODEL: z.string().min(1).default('gpt-4o-mini'),
    ANTHROPIC_API_KEY: z.string().default(''),
    ANTHROPIC_MODEL: z.string().min(1).default('claude-haiku-4-5-20251001'),

    // Pre-filter: articles whose extractable text is below either threshold are
    // marked `filtered` and never reach the LLM.
    PREFILTER_MIN_CHARS: z.coerce.number().int().nonnegative().default(200),
    PREFILTER_MIN_WORDS: z.coerce.number().int().nonnegative().default(40),

    // Cron expression for the scheduled poll of all active feeds.
    FEED_POLL_CRON: z.string().min(1).default('*/15 * * * *'),
    // Abort a feed HTTP fetch after this many milliseconds.
    FEED_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
    // How many jobs a worker processes concurrently.
    WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),

    BULLBOARD_PORT: z.coerce.number().int().positive().default(3100),
    BULLBOARD_USER: z.string().min(1).default('admin'),
    BULLBOARD_PASSWORD: z.string().min(1, 'BULLBOARD_PASSWORD must be set'),
  })
  .passthrough();

export type Env = z.infer<typeof envSchema>;

/**
 * Validates raw environment variables, throwing a readable error listing every
 * problem. Wired into `ConfigModule.forRoot({validate})`.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
