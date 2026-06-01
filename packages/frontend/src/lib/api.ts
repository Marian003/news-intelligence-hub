import type {EntityType, GraphPayload, Importance} from '@nih/shared';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'nih_token';

let token: string | null = localStorage.getItem(TOKEN_KEY);

export function setToken(value: string | null): void {
  token = value;
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return token;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: {method?: string; body?: unknown} = {}
): Promise<T> {
  const response = await fetch(BASE + path, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const message =
      (data as {message?: string})?.message ?? response.statusText;
    throw new ApiError(response.status, message);
  }
  return data as T;
}

export interface AuthUser {
  id: string;
  email: string;
}
export interface RegisterResult {
  id: string;
  email: string;
  emailConfirmed: boolean;
  confirmationUrl?: string;
}
export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}
export interface Feed {
  id: string;
  url: string;
  title: string | null;
  status: 'active' | 'paused' | 'error';
  lastError: string | null;
  lastPolledAt: string | null;
  createdAt: string;
}
export interface Category {
  id: string;
  name: string;
  color: string | null;
}
export interface Axis {
  id: string;
  name: string;
  values: string[];
}
export interface ArticleListItem {
  id: string;
  title: string;
  url: string;
  author: string | null;
  feedId: string;
  status: string;
  importance: Importance | null;
  summary: string | null;
  publishedAt: number | null;
  ingestedAt: number;
  similarCount: number;
  categories: string[];
}
export interface ArticleCard extends ArticleListItem {
  content: string | null;
  entities: Array<{id: string; canonicalName: string; type: EntityType}>;
  axisValues: Array<{axis: string; value: string}>;
  similar: Array<{id: string; title: string; url: string; feedId: string}>;
}
export interface EntityListItem {
  id: string;
  canonicalName: string;
  type: EntityType;
  aliases: string[];
  description: string | null;
  mentionCount: number;
  firstSeen: number | null;
  lastSeen: number | null;
}
export interface EntityCard extends EntityListItem {
  mentionArticleIds: string[];
  relatedEntities: Array<{
    id: string;
    canonicalName: string;
    type: EntityType;
    weight: number;
  }>;
  activity: Array<{ts: number; count: number}>;
}

export interface ArticleFilters {
  status?: string;
  feedId?: string;
  importance?: string;
  categoryId?: string;
  q?: string;
}

function query(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v);
  if (entries.length === 0) return '';
  return (
    '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&')
  );
}

export const api = {
  register: (email: string, password: string) =>
    request<RegisterResult>('/auth/register', {
      method: 'POST',
      body: {email, password},
    }),
  confirm: (token: string) =>
    request<{confirmed: true}>(
      `/auth/confirm?token=${encodeURIComponent(token)}`
    ),
  login: (email: string, password: string) =>
    request<LoginResult>('/auth/login', {
      method: 'POST',
      body: {email, password},
    }),
  me: () => request<AuthUser>('/auth/me'),
  logout: () => request<void>('/auth/logout', {method: 'POST'}),

  feeds: {
    list: () => request<Feed[]>('/feeds'),
    create: (url: string, title?: string) =>
      request<Feed>('/feeds', {method: 'POST', body: {url, title}}),
    update: (id: string, patch: {status?: string; title?: string}) =>
      request<Feed>(`/feeds/${id}`, {method: 'PATCH', body: patch}),
    remove: (id: string) => request<void>(`/feeds/${id}`, {method: 'DELETE'}),
    refresh: (id: string) =>
      request<{enqueued: true}>(`/feeds/${id}/refresh`, {method: 'POST'}),
  },
  categories: {
    list: () => request<Category[]>('/categories'),
    create: (name: string, color?: string) =>
      request<Category>('/categories', {method: 'POST', body: {name, color}}),
    update: (id: string, patch: {name?: string; color?: string | null}) =>
      request<Category>(`/categories/${id}`, {method: 'PATCH', body: patch}),
    remove: (id: string) =>
      request<void>(`/categories/${id}`, {method: 'DELETE'}),
  },
  axes: {
    list: () => request<Axis[]>('/axes'),
    create: (name: string, values: string[]) =>
      request<Axis>('/axes', {method: 'POST', body: {name, values}}),
    update: (id: string, patch: {name?: string; values?: string[]}) =>
      request<Axis>(`/axes/${id}`, {method: 'PATCH', body: patch}),
    remove: (id: string) => request<void>(`/axes/${id}`, {method: 'DELETE'}),
  },
  articles: {
    list: (filters: ArticleFilters = {}) =>
      request<ArticleListItem[]>(
        '/articles' + query(filters as Record<string, string | undefined>)
      ),
    get: (id: string) => request<ArticleCard>(`/articles/${id}`),
  },
  entities: {
    list: () => request<EntityListItem[]>('/entities'),
    get: (id: string) => request<EntityCard>(`/entities/${id}`),
  },
  graph: (params: {
    nodeTypes?: string;
    importance?: string;
    categoryId?: string;
    limit?: string;
  }) => request<GraphPayload>('/graph' + query(params)),
  regenerate: {
    start: () => request<{enqueued: number}>('/regenerate', {method: 'POST'}),
    status: () => request<{inProgress: number}>('/regenerate/status'),
  },
};
