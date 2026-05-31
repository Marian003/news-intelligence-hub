/**
 * Deterministic URL normalization, used as the primary article-dedup key. Two
 * links that point at the same resource but differ cosmetically (scheme/host
 * case, a default port, a trailing slash, tracking params, fragment, query
 * order) must normalize to the same string. This is plain code — no LLM.
 */

// Query parameters that never identify the resource (analytics/click tracking)
// and so are dropped before comparing.
const TRACKING_PARAMS = new Set([
  'gclid',
  'fbclid',
  'mc_eid',
  'mc_cid',
  'igshid',
  'ref',
  'ref_src',
]);

function isTrackingParam(key: string): boolean {
  return key.startsWith('utm_') || TRACKING_PARAMS.has(key);
}

export function normalizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    // Not a parseable absolute URL; fall back to a trimmed form so callers still
    // get a stable string rather than throwing mid-ingestion.
    return raw.trim();
  }

  const protocol = url.protocol.toLowerCase();
  const host = url.host.toLowerCase(); // host keeps a non-default port, drops 80/443

  let path = url.pathname;
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  const params = [...url.searchParams.entries()]
    .filter(([key]) => !isTrackingParam(key.toLowerCase()))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const search = new URLSearchParams(params).toString();

  return `${protocol}//${host}${path}${search ? `?${search}` : ''}`;
}
