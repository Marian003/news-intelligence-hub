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
