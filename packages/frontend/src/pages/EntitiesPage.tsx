import {useState} from 'react';
import {ErrorNote, Spinner, formatTs, useAsync} from '../components/ui';
import {api, type EntityListItem} from '../lib/api';

export function EntitiesPage() {
  const entities = useAsync(() => api.entities.list(), []);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Entities</h1>
      {entities.loading ? (
        <Spinner />
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
    <li className="rounded-lg border bg-white p-3 hover:border-slate-300">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">
            {entity.canonicalName}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
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
      className="fixed inset-0 z-20 flex justify-end bg-slate-900/30"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="mb-3 text-sm text-slate-400 hover:text-slate-700"
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
              <h2 className="text-lg font-semibold text-slate-900">
                {card.data.canonicalName}
              </h2>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                {card.data.type}
              </span>
            </div>
            {card.data.description && (
              <p className="text-sm text-slate-700">{card.data.description}</p>
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
                    className="rounded bg-slate-100 px-1.5 py-0.5 text-xs"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-md bg-slate-50 p-2">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
