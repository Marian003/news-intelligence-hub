import {useState, type ReactNode} from 'react';
import {
  Badge,
  ErrorNote,
  Skeleton,
  Spinner,
  formatTs,
  useAsync,
} from '../components/ui';
import {api, type ArticleFilters, type ArticleListItem} from '../lib/api';

const selectClass = 'nih-input px-2 py-1.5 text-sm';

const WINDOW_SECONDS: Record<string, number> = {
  day: 86_400,
  week: 604_800,
  month: 2_592_000,
};

/** Maps a time-window choice to a Unix-second lower bound for the `since` filter. */
function windowToSince(choice: string): string | undefined {
  const span = WINDOW_SECONDS[choice];
  if (!span) return undefined;
  return String(Math.floor(Date.now() / 1000) - span);
}

export function FeedPage() {
  const feeds = useAsync(() => api.feeds.list(), []);
  const categories = useAsync(() => api.categories.list(), []);
  const [filters, setFilters] = useState<ArticleFilters>({status: 'processed'});
  const [timeWindow, setTimeWindow] = useState('');
  const articles = useAsync(
    () => api.articles.list(filters),
    [JSON.stringify(filters)]
  );
  const [openId, setOpenId] = useState<string | null>(null);

  const set = (patch: Partial<ArticleFilters>) =>
    setFilters(prev => ({...prev, ...patch}));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        Article feed
      </h1>

      <div className="flex flex-wrap gap-2 nih-card p-3">
        <input
          className="flex-1 nih-input px-3 py-1.5 text-sm"
          placeholder="Search articles…"
          value={filters.q ?? ''}
          onChange={e => set({q: e.target.value || undefined})}
        />
        <select
          className={selectClass}
          value={filters.feedId ?? ''}
          onChange={e => set({feedId: e.target.value || undefined})}
        >
          <option value="">All feeds</option>
          {feeds.data?.map(f => (
            <option key={f.id} value={f.id}>
              {f.title ?? f.url}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={filters.categoryId ?? ''}
          onChange={e => set({categoryId: e.target.value || undefined})}
        >
          <option value="">All categories</option>
          {categories.data?.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={filters.importance ?? ''}
          onChange={e => set({importance: e.target.value || undefined})}
        >
          <option value="">Any importance</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="junk">Junk</option>
        </select>
        <select
          className={selectClass}
          value={filters.status ?? ''}
          onChange={e => set({status: e.target.value || undefined})}
        >
          <option value="processed">Processed</option>
          <option value="">Any status</option>
          <option value="pending">Pending</option>
          <option value="filtered">Filtered</option>
          <option value="failed">Failed</option>
        </select>
        <select
          className={selectClass}
          value={timeWindow}
          onChange={e => {
            setTimeWindow(e.target.value);
            set({since: windowToSince(e.target.value)});
          }}
        >
          <option value="">Any time</option>
          <option value="day">Last 24 hours</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
        </select>
      </div>

      {articles.loading ? (
        <Skeleton rows={6} />
      ) : articles.error ? (
        <ErrorNote message={articles.error} />
      ) : articles.data && articles.data.length > 0 ? (
        <ul className="space-y-2">
          {articles.data.map(article => (
            <ArticleRow
              key={article.id}
              article={article}
              onOpen={() => setOpenId(article.id)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">
          No articles match. Add a feed and poll it, or relax the filters.
        </p>
      )}

      {openId && <ArticleDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ArticleRow({
  article,
  onOpen,
}: {
  article: ArticleListItem;
  onOpen: () => void;
}) {
  return (
    <li className="nih-card p-3 hover:border-slate-300">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start gap-2">
          {article.importance && (
            <Badge kind="importance" value={article.importance} />
          )}
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {article.title}
          </span>
        </div>
        {article.source && (
          <p className="mt-0.5 text-xs font-medium text-slate-400">
            {article.source}
          </p>
        )}
        {article.summary && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
            {article.summary}
          </p>
        )}
        {article.entities.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {article.entities.slice(0, 6).map(e => (
              <span
                key={e.name}
                className="rounded bg-slate-50 dark:bg-slate-800/60 px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700"
              >
                {e.name}
              </span>
            ))}
            {article.entities.length > 6 && (
              <span className="px-1 text-xs text-slate-400">
                +{article.entities.length - 6}
              </span>
            )}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-500">
          {article.categories.map(c => (
            <span
              key={c}
              className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5"
            >
              {c}
            </span>
          ))}
          {article.similarCount > 0 && (
            <span className="rounded bg-indigo-50 dark:bg-indigo-500/15 px-1.5 py-0.5 text-indigo-700 dark:text-indigo-300">
              {article.similarCount} similar in other sources
            </span>
          )}
          <span className="ml-auto">{formatTs(article.publishedAt)}</span>
        </div>
      </button>
    </li>
  );
}

function ArticleDrawer({id, onClose}: {id: string; onClose: () => void}) {
  const card = useAsync(() => api.articles.get(id), [id]);
  return (
    <div
      className="nih-fade-in fixed inset-0 z-20 flex justify-end bg-slate-900/30"
      onClick={onClose}
    >
      <div
        className="nih-slide-in h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl dark:bg-slate-900"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="mb-3 text-sm text-slate-400 hover:text-slate-700 dark:text-slate-300"
        >
          ✕ Close
        </button>
        {card.loading ? (
          <Spinner />
        ) : card.error ? (
          <ErrorNote message={card.error} />
        ) : card.data ? (
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                {card.data.importance && (
                  <Badge kind="importance" value={card.data.importance} />
                )}
                <Badge kind="status" value={card.data.status} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {card.data.title}
              </h2>
              {card.data.source && (
                <p className="text-xs font-medium text-slate-400">
                  {card.data.source}
                </p>
              )}
              <a
                href={card.data.url}
                target="_blank"
                rel="noreferrer"
                className="break-all text-xs text-indigo-600 dark:text-indigo-400 underline"
              >
                {card.data.url}
              </a>
            </div>

            {card.data.summary && (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {card.data.summary}
              </p>
            )}

            <Section title="Entities">
              <div className="flex flex-wrap gap-1">
                {card.data.entities.map(e => (
                  <span
                    key={e.id}
                    className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-300"
                  >
                    {e.canonicalName}
                    <span className="text-slate-400"> · {e.type}</span>
                  </span>
                ))}
                {card.data.entities.length === 0 && <Empty />}
              </div>
            </Section>

            <Section title="Categories">
              <div className="flex flex-wrap gap-1">
                {card.data.categories.map(c => (
                  <span
                    key={c}
                    className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs"
                  >
                    {c}
                  </span>
                ))}
                {card.data.categories.length === 0 && <Empty />}
              </div>
            </Section>

            <Section title="Axes">
              <div className="flex flex-wrap gap-1">
                {card.data.axisValues.map(a => (
                  <span
                    key={a.axis}
                    className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs"
                  >
                    {a.axis}: <span className="font-medium">{a.value}</span>
                  </span>
                ))}
                {card.data.axisValues.length === 0 && <Empty />}
              </div>
            </Section>

            {card.data.similar.length > 0 && (
              <Section
                title={`Similar in other sources (${card.data.similar.length})`}
              >
                <ul className="space-y-1 text-xs">
                  {card.data.similar.map(s => (
                    <li
                      key={s.id}
                      className="truncate text-slate-600 dark:text-slate-300"
                    >
                      {s.title}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Section({title, children}: {title: string; children: ReactNode}) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Empty() {
  return <span className="text-xs text-slate-400">none</span>;
}
