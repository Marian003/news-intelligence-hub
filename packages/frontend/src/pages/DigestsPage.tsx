import {useEffect, useState, type ReactNode} from 'react';
import {Badge, Button, ErrorNote, Skeleton, useAsync} from '../components/ui';
import {useToast} from '../components/Toast';
import {api, type Category, type Digest} from '../lib/api';

const PERIODS: Array<Digest['period']> = ['day', 'week', 'month'];

/** Request and read period digests (US-11). */
export function DigestsPage() {
  const {notify} = useToast();
  const categories = useAsync(() => api.categories.list(), []);
  const digests = useAsync(() => api.digests.list(), []);
  const [period, setPeriod] = useState<Digest['period']>('week');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (id: string) =>
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );

  const generate = async () => {
    setError(null);
    try {
      const digest = await api.digests.create({
        period,
        categoryIds: selectedCategories,
      });
      notify('Digest queued — building in the background', 'success');
      setOpenId(digest.id);
      digests.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        Digests
      </h1>

      <section className="space-y-3 nih-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-300">
            Period
          </span>
          <select
            className="nih-input px-2 py-1.5 text-sm"
            value={period}
            onChange={e => setPeriod(e.target.value as Digest['period'])}
          >
            {PERIODS.map(p => (
              <option key={p} value={p}>
                Last {p}
              </option>
            ))}
          </select>
          <span className="ml-auto">
            <Button onClick={generate}>Generate digest</Button>
          </span>
        </div>
        {categories.data && categories.data.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-slate-400">
              Scope to categories (optional):
            </span>
            {categories.data.map((c: Category) => (
              <button
                key={c.id}
                onClick={() => toggleCategory(c.id)}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  selectedCategories.includes(c.id)
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        {error && <ErrorNote message={error} />}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_1fr]">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500">Recent</h2>
          {digests.loading ? (
            <Skeleton rows={4} />
          ) : digests.data && digests.data.length > 0 ? (
            <ul className="space-y-1.5">
              {digests.data.map(d => (
                <li key={d.id}>
                  <button
                    onClick={() => setOpenId(d.id)}
                    className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition-colors hover:border-slate-300 dark:bg-slate-900 dark:hover:border-slate-600 ${
                      openId === d.id
                        ? 'border-indigo-500 dark:border-indigo-500'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <span className="font-medium capitalize text-slate-800 dark:text-slate-200">
                      {d.period}
                    </span>
                    <DigestStatusBadge status={d.status} />
                    <span className="ml-auto text-xs text-slate-400">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No digests yet.</p>
          )}
        </section>

        <section>
          {openId ? (
            <DigestDetail id={openId} onReady={() => digests.reload()} />
          ) : (
            <p className="nih-card p-6 text-sm text-slate-500">
              Generate a digest or pick one from the list to read it.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function DigestStatusBadge({status}: {status: Digest['status']}) {
  const tone =
    status === 'ready'
      ? 'bg-green-100 text-green-700'
      : status === 'failed'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700';
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] ${tone}`}>
      {status}
    </span>
  );
}

function DigestDetail({id, onReady}: {id: string; onReady: () => void}) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const data = await api.digests.get(id);
        if (!active) return;
        setDigest(data);
        if (data.status === 'pending') {
          timer = setTimeout(poll, 1500);
        } else {
          onReady();
        }
      } catch (err) {
        if (active) setError((err as Error).message);
      }
    };

    setDigest(null);
    setError(null);
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // Re-run only when the digest id changes; onReady just signals list refresh.
  }, [id]);

  if (error) return <ErrorNote message={error} />;
  if (!digest) return <Skeleton rows={6} />;

  if (digest.status === 'pending') {
    return (
      <div className="nih-card p-6 text-sm text-slate-500">
        Building this {digest.period} digest…
      </div>
    );
  }
  if (digest.status === 'failed' || !digest.result) {
    return <ErrorNote message={digest.error ?? 'Digest failed to build.'} />;
  }

  const r = digest.result;
  return (
    <div className="space-y-5 nih-card p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold capitalize text-slate-900 dark:text-slate-100">
          {digest.period} digest
        </h2>
        <Badge kind="status" value={`${r.articleCount} articles`} />
      </div>

      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {r.summary}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Panel title="Top entities">
          {r.topEntities.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {r.topEntities.map(e => (
                <li key={e.name} className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300">
                    {e.name}
                    <span className="text-slate-400"> · {e.type}</span>
                  </span>
                  <span className="text-slate-400">{e.mentions}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </Panel>
        <Panel title="Top categories">
          {r.topCategories.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {r.topCategories.map(c => (
                <li key={c.name} className="flex justify-between">
                  <span className="text-slate-700 dark:text-slate-300">
                    {c.name}
                  </span>
                  <span className="text-slate-400">{c.articles}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty />
          )}
        </Panel>
      </div>

      <Panel title="Key articles">
        {r.keyArticles.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {r.keyArticles.map(a => (
              <li key={a.id}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {a.title}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <Empty />
        )}
      </Panel>
    </div>
  );
}

function Panel({title, children}: {title: string; children: ReactNode}) {
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
  return <p className="text-sm text-slate-400">none</p>;
}
