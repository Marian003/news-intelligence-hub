/**
 * Deterministic pre-filter — the first line of LLM cost control. Articles that
 * are empty, too short, or obviously low-information (templated SEO filler) are
 * rejected here and never sent to the provider. Pure code, no LLM.
 */

export interface PreFilterThresholds {
  minChars: number;
  minWords: number;
}

export type PreFilterReason =
  | 'empty'
  | 'too_short'
  | 'too_few_words'
  | 'low_information';

export interface PreFilterResult {
  accepted: boolean;
  reason?: PreFilterReason;
  textLength: number;
  wordCount: number;
}

// Below this unique-to-total word ratio (with enough words to judge), the text
// is mostly repetition — a common shape for templated/boilerplate filler.
const LOW_INFO_RATIO = 0.25;

/** Strips HTML tags and collapses whitespace to get plain comparable text. */
export function stripToText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function preFilter(
  input: {content?: string},
  thresholds: PreFilterThresholds
): PreFilterResult {
  const text = stripToText(input.content ?? '');
  const words = text.length === 0 ? [] : text.split(' ');
  const result = {textLength: text.length, wordCount: words.length};

  if (text.length === 0) {
    return {...result, accepted: false, reason: 'empty'};
  }
  if (text.length < thresholds.minChars) {
    return {...result, accepted: false, reason: 'too_short'};
  }
  if (words.length < thresholds.minWords) {
    return {...result, accepted: false, reason: 'too_few_words'};
  }

  const uniqueWords = new Set(words.map(word => word.toLowerCase())).size;
  if (uniqueWords / words.length < LOW_INFO_RATIO) {
    return {...result, accepted: false, reason: 'low_information'};
  }

  return {...result, accepted: true};
}
