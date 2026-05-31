import {createHash} from 'node:crypto';

/**
 * Collapses whitespace and lowercases so that cosmetically different copies of
 * the same text hash identically.
 */
export function normalizeForHash(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Stable content fingerprint over an article's title and body. Used two ways:
 * to detect the identical article arriving from a second source, and as the key
 * for the LLM result cache (identical content -> reuse the analysis, no new
 * provider call). Deterministic — no LLM.
 */
export function contentHash(input: {title?: string; body?: string}): string {
  const normalized = `${normalizeForHash(input.title ?? '')}\n${normalizeForHash(
    input.body ?? ''
  )}`;
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}
