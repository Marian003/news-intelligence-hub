import {useState} from 'react';
import {
  ErrorNote,
  Skeleton,
  Spinner,
  formatTs,
  useAsync,
} from '../components/ui';
import {api, type EntityListItem} from '../lib/api';

export function EntitiesPage() {
  const entities = useAsync(() => api.entities.list(), []);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        Entities
      </h1>
      {entities.loading ? (
        <Skeleton rows={6} />
      ) : entities.error ? (
        <ErrorNote message={entities.error} />
      ) : entities.data && entities.data.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {entities.data.map(entity => (
            <EntityRow
              key={entity.id}
              entity={entity}
              onOpen={() => setOpenId(entity.id)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">
          No entities yet — process some articles first.
        </p>
      )}
      {openId && <EntityDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function EntityRow({
  entity,
  onOpen,
}: {
  entity: EntityListItem;
  onOpen: () => void;
}) {
  return (
    <li className="nih-card p-3 hover:border-slate-300">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {entity.canonicalName}
          </span>
          <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs text-slate-500">
            {entity.type}
          </span>
          <span className="ml-auto text-xs text-slate-500">
            {entity.mentionCount} mentions
          </span>
        </div>
        {entity.aliases.length > 1 && (
          <p className="mt-1 truncate text-xs text-slate-400">
            aka{' '}
            {entity.aliases.filter(a => a !== entity.canonicalName).join(', ')}
          </p>
        )}
      </button>
    </li>
  );
}

function EntityDrawer({id, onClose}: {id: string; onClose: () => void}) {
  const card = useAsync(() => api.entities.get(id), [id]);
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
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {card.data.canonicalName}
              </h2>
              <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs text-slate-500">
                {card.data.type}
              </span>
            </div>
            {card.data.description && (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {card.data.description}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <Stat label="Mentions" value={String(card.data.mentionCount)} />
              <Stat label="Aliases" value={String(card.data.aliases.length)} />
              <Stat label="First seen" value={formatTs(card.data.firstSeen)} />
              <Stat label="Last seen" value={formatTs(card.data.lastSeen)} />
            </dl>
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Known as
              </h3>
              <div className="flex flex-wrap gap-1">
                {card.data.aliases.map(a => (
                  <span
                    key={a}
                    className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>

            {card.data.relatedEntities.length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Related entities (co-mentions)
                </h3>
                <ul className="space-y-1">
                  {card.data.relatedEntities.map(r => (
                    <li
                      key={r.id}
                      className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <span>{r.canonicalName}</span>
                      <span className="text-xs text-slate-400">{r.type}</span>
                      <span className="ml-auto rounded bg-indigo-50 dark:bg-indigo-500/15 px-1.5 py-0.5 text-xs text-indigo-700 dark:text-indigo-300">
                        {r.weight}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {card.data.activity.length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Mention activity
                </h3>
                <ActivityChart activity={card.data.activity} />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 p-2">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800 dark:text-slate-200">
        {value}
      </dd>
    </div>
  );
}

function ActivityChart({
  activity,
}: {
  activity: Array<{ts: number; count: number}>;
}) {
  const max = Math.max(...activity.map(a => a.count), 1);
  return (
    <div className="flex h-16 items-end gap-1">
      {activity.map(point => (
        <div
          key={point.ts}
          className="flex-1"
          title={`${new Date(point.ts * 1000).toLocaleDateString()}: ${point.count}`}
        >
          <div
            className="w-full rounded-t bg-indigo-500 dark:bg-indigo-400"
            style={{height: `${Math.round((point.count / max) * 100)}%`}}
          />
        </div>
      ))}
    </div>
  );
}
