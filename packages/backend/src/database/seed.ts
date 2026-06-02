import {Logger} from '@nestjs/common';
import {hash} from '@node-rs/argon2';
import {eq} from 'drizzle-orm';
import {drizzle} from 'drizzle-orm/node-postgres';
import {Pool} from 'pg';
import type {EntityType, Importance} from '@nih/shared';
import {validateEnv} from '../config/env.validation';
import {PRESET_AXES} from '../axes/axis-presets';
import {contentHash} from '../ingestion/content-hash';
import {normalizeUrl} from '../ingestion/url-normalize';
import {normalizeEntityName} from '../entities/entity-normalize';
import * as schema from './schema';

/**
 * Loads a self-contained demo dataset (one confirmed user with feeds, already-
 * processed articles, canonical entities, and category/axis assignments) so a
 * reviewer sees a populated feed and graph within seconds — no LLM keys needed.
 * Re-runnable: it deletes the demo user (cascading all its data) and recreates it.
 *
 * Documented command: `docker compose run --rm backend \
 *   node packages/backend/dist/database/seed.js`
 */
const DEMO_EMAIL = 'demo@nih.local';
const DEMO_PASSWORD = 'demo12345';
// Fixed id so re-running the seed keeps the same user — an existing login
// session (whose JWT carries this id) stays valid across re-seeds.
const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';

const ENTITIES: Array<{name: string; type: EntityType; aliases?: string[]}> = [
  {name: 'Microsoft', type: 'company', aliases: ['MSFT', 'Microsoft Corp.']},
  {name: 'OpenAI', type: 'company'},
  {name: 'Google', type: 'company'},
  {name: 'Nvidia', type: 'company'},
  {name: 'Azure', type: 'product'},
  {name: 'GitHub', type: 'product'},
  {name: 'Ethereum', type: 'technology'},
  {name: 'Satya Nadella', type: 'person'},
];

interface DemoArticle {
  title: string;
  url: string;
  feed: number;
  importance: Importance;
  publishedDaysAgo: number;
  summary: string;
  content: string;
  entities: string[];
  categories: string[];
  axes: Array<{axis: string; value: string}>;
}

// Two stories share the same content (a wire story republished) to demonstrate
// the "N similar in other sources" counter.
const RUNTIME_STORY =
  'Microsoft unveiled a new artificial intelligence runtime built for ' +
  'enterprise workloads, integrating closely with its Azure platform and ' +
  'partner models from OpenAI to cut latency and simplify deployment across ' +
  'cloud and edge environments. Executives said the runtime targets developers ' +
  'building production applications in finance, healthcare, and manufacturing, ' +
  'and described it as a step toward making generative technology dependable ' +
  'enough for regulated industries that have so far moved cautiously.';

const ARTICLES: DemoArticle[] = [
  {
    title: 'Microsoft ships new AI runtime',
    url: 'https://arstechnica.com/ai/',
    feed: 0,
    importance: 'high',
    publishedDaysAgo: 1,
    summary:
      'Microsoft launched an enterprise AI runtime tied to Azure and OpenAI models.',
    content: RUNTIME_STORY,
    entities: ['Microsoft', 'OpenAI', 'Azure'],
    categories: ['AI Infrastructure'],
    axes: [
      {axis: 'Content Type', value: 'news'},
      {axis: 'Reader Level', value: 'intermediate'},
      {axis: 'Region', value: 'global'},
      {axis: 'Tone', value: 'neutral'},
    ],
  },
  {
    title: 'Microsoft ships new AI runtime',
    url: 'https://www.theverge.com/ai-artificial-intelligence',
    feed: 1,
    importance: 'high',
    publishedDaysAgo: 1,
    summary:
      'Microsoft launched an enterprise AI runtime tied to Azure and OpenAI models.',
    content: RUNTIME_STORY,
    entities: ['Microsoft', 'OpenAI', 'Azure'],
    categories: ['AI Infrastructure'],
    axes: [{axis: 'Content Type', value: 'news'}],
  },
  {
    title: 'OpenAI and Microsoft expand their partnership',
    url: 'https://arstechnica.com/information-technology/',
    feed: 0,
    importance: 'high',
    publishedDaysAgo: 2,
    summary:
      'The two firms deepened their multiyear collaboration on AI infrastructure.',
    content:
      'OpenAI and Microsoft announced an expanded multiyear partnership ' +
      'covering preferred model access and substantial Azure compute ' +
      'commitments over the next several years. The two companies framed the ' +
      'arrangement as a strategic alignment intended to accelerate research, ' +
      'safety tooling, and enterprise productivity software, even as analysts ' +
      'questioned how the deepening relationship would affect competition and ' +
      'pricing across the rapidly consolidating market for foundation models.',
    entities: ['OpenAI', 'Microsoft'],
    categories: ['AI Infrastructure'],
    axes: [
      {axis: 'Content Type', value: 'news'},
      {axis: 'Tone', value: 'neutral'},
    ],
  },
  {
    title: 'Nvidia unveils next-generation GPUs for AI training',
    url: 'https://www.theverge.com/tech',
    feed: 1,
    importance: 'high',
    publishedDaysAgo: 3,
    summary:
      'Nvidia revealed new accelerators aimed at large-scale model training.',
    content:
      'Nvidia introduced its next-generation GPUs, promising large gains for ' +
      'both training and inference, with early interest from Google and other ' +
      'major cloud providers. The company emphasized improved memory bandwidth ' +
      'and energy efficiency, positioning the accelerators for the largest ' +
      'language-model workloads. Supply remains a constraint, executives ' +
      'acknowledged, and customers are negotiating multi-year allocations to ' +
      'secure capacity well ahead of general availability.',
    entities: ['Nvidia', 'Google'],
    categories: ['AI Infrastructure'],
    axes: [
      {axis: 'Content Type', value: 'news'},
      {axis: 'Reader Level', value: 'expert'},
    ],
  },
  {
    title: 'GitHub rolls out new developer tooling',
    url: 'https://arstechnica.com/gadgets/',
    feed: 0,
    importance: 'normal',
    publishedDaysAgo: 4,
    summary: 'GitHub shipped tooling updates for code review and automation.',
    content:
      'GitHub, owned by Microsoft, released a set of developer tools focused ' +
      'on code review automation and continuous integration workflows. The ' +
      'update folds machine assistance into pull requests, suggesting fixes ' +
      'and summarizing changes for reviewers. Maintainers of large open-source ' +
      'projects were given early access, and the company said the features ' +
      'aim to reduce the time engineers spend on routine review without ' +
      'removing human judgment from the loop.',
    entities: ['GitHub', 'Microsoft'],
    categories: ['DevTools'],
    axes: [
      {axis: 'Content Type', value: 'announcement'},
      {axis: 'Reader Level', value: 'intermediate'},
    ],
  },
  {
    title: 'Satya Nadella on the future of cloud and AI',
    url: 'https://www.theverge.com/microsoft',
    feed: 1,
    importance: 'normal',
    publishedDaysAgo: 5,
    summary:
      'Microsoft’s CEO outlined a long-term view of cloud and AI convergence.',
    content:
      'In a wide-ranging interview, Satya Nadella discussed how Microsoft sees ' +
      'Azure and artificial intelligence reshaping enterprise software over the ' +
      'coming decade. He argued that durable value will come from integrating ' +
      'models into everyday workflows rather than from standalone demos, and ' +
      'stressed reliability, governance, and cost control as the questions ' +
      'enterprise buyers actually ask. He also addressed the energy footprint ' +
      'of large data centers and the partnerships needed to sustain growth.',
    entities: ['Satya Nadella', 'Microsoft', 'Azure'],
    categories: ['AI Infrastructure'],
    axes: [
      {axis: 'Content Type', value: 'analysis'},
      {axis: 'Tone', value: 'positive'},
    ],
  },
  {
    title: 'EU advances its crypto regulation framework',
    url: 'https://arstechnica.com/tech-policy/',
    feed: 0,
    importance: 'high',
    publishedDaysAgo: 6,
    summary:
      'European regulators moved forward on rules affecting digital assets.',
    content:
      'The European Union advanced a regulatory framework for digital assets, ' +
      'with provisions that touch Ethereum-based protocols and stablecoins. ' +
      'Lawmakers said the rules aim to protect consumers and bring ' +
      'transparency to trading venues while leaving room for legitimate ' +
      'innovation. Industry groups warned that compliance costs could push ' +
      'smaller projects out of the bloc, and pointed to uneven enforcement ' +
      'across member states as a lingering source of uncertainty for builders.',
    entities: ['Ethereum'],
    categories: ['Crypto Regulation'],
    axes: [
      {axis: 'Content Type', value: 'news'},
      {axis: 'Region', value: 'europe'},
      {axis: 'Tone', value: 'critical'},
    ],
  },
  {
    title: 'Google expands its AI research labs',
    url: 'https://www.theverge.com/google',
    feed: 1,
    importance: 'normal',
    publishedDaysAgo: 7,
    summary:
      'Google grew its research footprint amid intensifying AI competition.',
    content:
      'Google announced an expansion of its AI research labs, positioning ' +
      'itself against OpenAI and others in the race to commercialize models. ' +
      'The company said it would hire across several regions and deepen work ' +
      'on multimodal systems, retrieval, and on-device inference. Executives ' +
      'cast the investment as a long-term bet rather than a response to any ' +
      'single competitor, while acknowledging that talent and compute remain ' +
      'the scarcest resources in the field today.',
    entities: ['Google', 'OpenAI'],
    categories: ['AI Infrastructure'],
    axes: [{axis: 'Content Type', value: 'news'}],
  },
];

async function run(): Promise<void> {
  const env = validateEnv(process.env);
  const logger = new Logger('Seed');
  const pool = new Pool({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
  });

  try {
    const db = drizzle(pool, {schema});

    // Re-runnable: drop the demo user and everything that cascades from it.
    await db.delete(schema.users).where(eq(schema.users.email, DEMO_EMAIL));

    const [user] = await db
      .insert(schema.users)
      .values({
        id: DEMO_USER_ID,
        email: DEMO_EMAIL,
        passwordHash: await hash(DEMO_PASSWORD),
        emailConfirmed: true,
      })
      .returning();
    const userId = user.id;

    await db.insert(schema.axes).values(
      PRESET_AXES.map(preset => ({
        userId,
        name: preset.name,
        values: [...preset.values],
      }))
    );

    const categoryRows = await db
      .insert(schema.categories)
      .values(
        ['AI Infrastructure', 'Crypto Regulation', 'DevTools'].map(name => ({
          userId,
          name,
        }))
      )
      .returning();
    const categoryByName = new Map(categoryRows.map(c => [c.name, c.id]));

    const axisRows = await db
      .select()
      .from(schema.axes)
      .where(eq(schema.axes.userId, userId));
    const axisByName = new Map(axisRows.map(a => [a.name, a]));

    const feedRows = await db
      .insert(schema.feeds)
      .values([
        // Real, pollable RSS feeds, seeded paused so the scheduler doesn't fetch
        // them automatically; "Poll now" works on demand (needs an LLM key/mock).
        {
          userId,
          url: 'https://feeds.arstechnica.com/arstechnica/index',
          title: 'Ars Technica',
          status: 'paused',
        },
        {
          userId,
          url: 'https://www.theverge.com/rss/index.xml',
          title: 'The Verge',
          status: 'paused',
        },
      ])
      .returning();

    const entityRows = await db
      .insert(schema.entities)
      .values(
        ENTITIES.map(entity => ({
          userId,
          canonicalName: entity.name,
          normalizedKey: normalizeEntityName(entity.name),
          type: entity.type,
          aliases: [entity.name, ...(entity.aliases ?? [])],
        }))
      )
      .returning();
    const entityByName = new Map(entityRows.map(e => [e.canonicalName, e.id]));

    const now = Date.now();
    for (const article of ARTICLES) {
      const publishedAt = new Date(
        now - article.publishedDaysAgo * 24 * 60 * 60 * 1000
      );
      const [row] = await db
        .insert(schema.articles)
        .values({
          userId,
          feedId: feedRows[article.feed].id,
          url: article.url,
          normalizedUrl: normalizeUrl(article.url),
          contentHash: contentHash({
            title: article.title,
            body: article.content,
          }),
          title: article.title,
          content: article.content,
          publishedAt,
          status: 'processed',
          summary: article.summary,
          importance: article.importance,
          processedAt: new Date(),
        })
        .returning();

      await db.insert(schema.articleEntities).values(
        article.entities.map(name => ({
          articleId: row.id,
          userId,
          entityId: entityByName.get(name)!,
          name,
          type: ENTITIES.find(e => e.name === name)!.type,
        }))
      );

      const categoryIds = article.categories
        .map(name => categoryByName.get(name))
        .filter((id): id is string => Boolean(id));
      if (categoryIds.length > 0) {
        await db.insert(schema.articleCategories).values(
          categoryIds.map(categoryId => ({
            articleId: row.id,
            categoryId,
            userId,
          }))
        );
      }

      const axisValues = article.axes
        .map(({axis, value}) => {
          const match = axisByName.get(axis);
          return match
            ? {articleId: row.id, axisId: match.id, userId, value}
            : null;
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);
      if (axisValues.length > 0) {
        await db.insert(schema.articleAxisValues).values(axisValues);
      }
    }

    logger.log(
      `Seeded demo data for ${DEMO_EMAIL} (password: ${DEMO_PASSWORD}): ` +
        `${ARTICLES.length} articles, ${ENTITIES.length} entities.`
    );
  } finally {
    await pool.end();
  }
}

run().catch((err: unknown) => {
  new Logger('Seed').error('Seeding failed', err);
  process.exitCode = 1;
});
