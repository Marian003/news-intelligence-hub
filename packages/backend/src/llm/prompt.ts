import {ENTITY_TYPES, IMPORTANCE_LEVELS} from '@nih/shared';
import type {
  ArticleAnalysisInput,
  DigestInput,
  EntityMatchInput,
} from './llm.types';

/**
 * Builds the provider-independent analysis prompt. Both adapters send the same
 * instruction and content; only the HTTP envelope differs. Keeping the wording
 * here (not in each adapter) means the actual task definition lives in one place.
 */
export function buildAnalysisPrompt(input: ArticleAnalysisInput): {
  system: string;
  user: string;
} {
  const system = [
    'You extract structured metadata from a news article.',
    'Respond with a single JSON object and nothing else. Use this exact shape:',
    '{',
    '  "summary": string,            // 1-3 sentences, neutral',
    `  "importance": ${IMPORTANCE_LEVELS.map(level => `"${level}"`).join(' | ')},`,
    '  "entities": [{ "name": string, "type": ' +
      ENTITY_TYPES.map(type => `"${type}"`).join(' | ') +
      ' }],',
    '  "categories": string[],       // names chosen from the provided list only',
    '  "axes": [{ "axis": string, "value": string }]  // one value per provided axis',
    '}',
    "Use the entity's most canonical name. Only use categories and axis values",
    'from the lists provided; if none are provided, return empty arrays.',
  ].join('\n');

  const categories =
    input.categories.length > 0
      ? input.categories
          .map(c => `- ${c.name}${c.description ? `: ${c.description}` : ''}`)
          .join('\n')
      : '(none)';

  const axes =
    input.axes.length > 0
      ? input.axes
          .map(a => `- ${a.name} (values: ${a.values.join(', ')})`)
          .join('\n')
      : '(none)';

  const user = [
    `Title: ${input.title}`,
    '',
    'Content:',
    input.content,
    '',
    'Categories to choose from:',
    categories,
    '',
    'Axes to assign:',
    axes,
  ].join('\n');

  return {system, user};
}

/**
 * Builds the digest prompt. The aggregates (top entities/categories, the article
 * set) are precomputed deterministically and passed in; the model only writes a
 * short narrative over them, returning a single JSON object.
 */
export function buildDigestPrompt(input: DigestInput): {
  system: string;
  user: string;
} {
  const system = [
    `You write a concise ${input.period} digest of technology news.`,
    'Respond with a single JSON object and nothing else, of this exact shape:',
    '{ "summary": string }   // 3-6 sentences, neutral, no markdown',
    'Ground the summary in the supplied items; do not invent facts or sources.',
  ].join('\n');

  const list = (items: string[]) =>
    items.length > 0 ? items.join(', ') : '(none)';

  const articles =
    input.articles.length > 0
      ? input.articles
          .map((a, i) => `${i + 1}. ${a.title} — ${a.summary}`)
          .join('\n')
      : '(no articles in this period)';

  const user = [
    `Period: ${input.period}`,
    `Top entities: ${list(input.topEntities)}`,
    `Top categories: ${list(input.topCategories)}`,
    '',
    'Key articles:',
    articles,
  ].join('\n');

  return {system, user};
}

/**
 * Builds the entity-matching prompt (FR-6). Asks the model only the semantic
 * question the deterministic key cannot answer: is this surface form the same
 * real-world entity as a known one (Microsoft / MSFT / Майкрософт)? The id space
 * is constrained to the supplied candidates, and the caller rejects any id not
 * in the list, so the model cannot invent a merge.
 */
export function buildEntityMatchPrompt(input: EntityMatchInput): {
  system: string;
  user: string;
} {
  const system = [
    'You decide whether a NEW named entity is the same real-world entity as one',
    'of the KNOWN entities listed, despite a different spelling (abbreviation,',
    'ticker, translation, or transliteration — e.g. Microsoft = MSFT = Майкрософт).',
    'Respond with a single JSON object of this exact shape and nothing else:',
    '{ "matchId": string | null }   // a known entity id, or null if it is new',
    'Only return an id when you are confident it is the same entity. When in',
    'doubt, return null. Never merge two genuinely different entities.',
  ].join('\n');

  const candidates = input.candidates
    .map(
      c =>
        `- id=${c.id} | ${c.canonicalName}` +
        (c.aliases.length > 0 ? ` (aliases: ${c.aliases.join(', ')})` : '')
    )
    .join('\n');

  const user = [
    `New entity type: ${input.type}`,
    `New entity name: ${input.name}`,
    '',
    'Known entities of the same type:',
    candidates,
  ].join('\n');

  return {system, user};
}
