/**
 * Minimal fetch surface the adapters use. Declaring our own type (rather than
 * `typeof fetch`) lets unit tests pass a fake implementation without constructing
 * real Request/Response objects. Node's global fetch satisfies it structurally.
 */
export interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  }
) => Promise<FetchResponse>;

/** POSTs JSON with an abort-based timeout; throws on non-2xx with a body snippet. */
export async function postJson(
  fetchImpl: FetchLike,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {'content-type': 'application/json', ...headers},
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const snippet = (await response.text()).slice(0, 500);
      throw new Error(
        `HTTP ${response.status} ${response.statusText}: ${snippet}`
      );
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
