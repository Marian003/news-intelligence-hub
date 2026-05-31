import {defineConfig} from 'drizzle-kit';

/**
 * Drizzle Kit config — used only as a dev tool to generate SQL migration files
 * from the schema (`pnpm --filter @nih/backend drizzle:generate`). The generated
 * SQL is committed and applied at runtime by `src/database/migrate.ts`, so the
 * production image never needs drizzle-kit.
 */
export default defineConfig({
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? 'news_hub',
    password: process.env.POSTGRES_PASSWORD ?? '',
    database: process.env.POSTGRES_DB ?? 'news_hub',
    ssl: false,
  },
});
