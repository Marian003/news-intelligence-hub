/**
 * Deterministic entity-name normalization — the merge key for canonical
 * entities. Surface forms that differ only by case, punctuation, a leading
 * "the", or a trailing legal suffix (Inc, Corp, Ltd, …) collapse to the same
 * key, so "Microsoft", "microsoft", and "Microsoft Corp." are one entity with
 * zero LLM cost. Genuinely different surface forms (e.g. "MSFT") stay separate
 * here; semantic alias matching across them is the LLM's job (kept out of this
 * deterministic step to avoid a per-entity call storm).
 */

// Trailing tokens treated as company-form noise, not part of the name.
const LEGAL_SUFFIXES = new Set([
  'inc',
  'corp',
  'corporation',
  'incorporated',
  'ltd',
  'limited',
  'llc',
  'co',
  'company',
  'gmbh',
  'plc',
  'sa',
  'ag',
  'nv',
  'group',
  'holdings',
  'holding',
]);

export function normalizeEntityName(name: string): string {
  let value = name.toLowerCase().normalize('NFKC');
  // Punctuation -> space (keeps letters of any script, including Cyrillic).
  value = value.replace(/[.,&/\\()'’"`:;!?]/g, ' ');
  value = value.replace(/\s+/g, ' ').trim();
  value = value.replace(/^the\s+/, '');

  const words = value.split(' ').filter(Boolean);
  while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1])) {
    words.pop();
  }
  return words.join(' ');
}
