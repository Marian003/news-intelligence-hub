import {useEffect, useMemo, useState} from 'react';
import ReactFlow, {Background, Controls, type Edge, type Node} from 'reactflow';
import 'reactflow/dist/style.css';
import type {EntityType, GraphPayload} from '@nih/shared';
import {ErrorNote, Spinner, useAsync} from '../components/ui';
import {api} from '../lib/api';

const ENTITY_COLORS: Record<EntityType, string> = {
  person: '#f472b6',
  company: '#60a5fa',
  product: '#34d399',
  technology: '#a78bfa',
  location: '#fbbf24',
};
const IMPORTANCE_BORDER: Record<string, string> = {
  high: '#f59e0b',
  normal: '#94a3b8',
  junk: '#cbd5e1',
};

interface Selection {
  id: string;
  kind: 'article' | 'entity';
}

/** Lays the graph out radially: entities on an outer ring, articles inner. */
function toFlow(graph: GraphPayload): {nodes: Node[]; edges: Edge[]} {
  const cx = 480;
  const cy = 360;
  const entityNodes = graph.nodes.filter(n => n.kind === 'entity');
  const articleNodes = graph.nodes.filter(n => n.kind === 'article');

  const ring = (i: number, total: number, radius: number) => ({
    x: cx + radius * Math.cos((2 * Math.PI * i) / Math.max(total, 1)),
    y: cy + radius * Math.sin((2 * Math.PI * i) / Math.max(total, 1)),
  });

  const nodes: Node[] = [];
  entityNodes.forEach((node, i) => {
    nodes.push({
      id: node.id,
      position: ring(i, entityNodes.length, 360),
      data: {label: node.label, kind: 'entity'},
      style: {
        background:
          node.kind === 'entity' ? ENTITY_COLORS[node.entityType] : '#e2e8f0',
        color: '#0f172a',
        border: 'none',
        borderRadius: 999,
        fontSize: 11,
        padding: 6,
        width: 'auto',
        boxShadow: '0 1px 3px rgba(15,23,42,0.18)',
      },
    });
  });
  articleNodes.forEach((node, i) => {
    const importance = node.kind === 'article' ? node.importance : null;
    nodes.push({
      id: node.id,
      position: ring(i, articleNodes.length, 150),
      data: {
        label:
          node.label.length > 34 ? node.label.slice(0, 33) + '…' : node.label,
        kind: 'article',
      },
      style: {
        background: '#ffffff',
        border: `2px solid ${IMPORTANCE_BORDER[importance ?? 'normal']}`,
        borderRadius: 6,
        fontSize: 11,
        padding: 6,
        width: 150,
        boxShadow: '0 1px 3px rgba(15,23,42,0.10)',
      },
    });
  });

  const edges: Edge[] = graph.edges.map((edge, i) => ({
    id: `e${i}`,
    source: edge.from,
    target: edge.to,
    type: 'straight',
    // Animate the entity<->entity links so co-mention relationships stand out.
    animated: edge.kind === 'co_mention',
    style:
      edge.kind === 'co_mention'
        ? {stroke: '#6366f1', strokeWidth: Math.min(1 + (edge.weight ?? 1), 6)}
        : {stroke: '#cbd5e1', strokeWidth: 1},
  }));

  return {nodes, edges};
}

const WINDOW_SECONDS: Record<string, number> = {
  day: 86_400,
  week: 604_800,
  month: 2_592_000,
};

function windowToSince(choice: string): string | undefined {
  const span = WINDOW_SECONDS[choice];
  if (!span) return undefined;
  return String(Math.floor(Date.now() / 1000) - span);
}

/** The min/max article timestamp in the graph, or null if too few are dated. */
function timeBounds(
  graph: GraphPayload | undefined
): {min: number; max: number} | null {
  const stamps = (graph?.nodes ?? [])
    .filter(n => n.kind === 'article' && typeof n.ts === 'number')
    .map(n => (n as {ts: number}).ts);
  if (stamps.length < 2) return null;
  const min = Math.min(...stamps);
  const max = Math.max(...stamps);
  return min < max ? {min, max} : null;
}

/**
 * Reveals the graph as it grew up to `cutoff`: keeps article nodes at/before the
 * cutoff, the entities those articles mention, and edges between survivors. This
 * is the timeline replay — drag back to watch a story's entities accumulate.
 */
function filterByTime(graph: GraphPayload, cutoff: number): GraphPayload {
  const visible = new Set<string>();
  for (const node of graph.nodes) {
    if (node.kind === 'article' && (node.ts === null || node.ts <= cutoff)) {
      visible.add(node.id);
    }
  }
  // An entity is shown once a visible article mentions it.
  for (const edge of graph.edges) {
    if (edge.kind === 'mentions' && visible.has(edge.from)) {
      visible.add(edge.to);
    }
  }
  return {
    nodes: graph.nodes.filter(n => visible.has(n.id)),
    edges: graph.edges.filter(e => visible.has(e.from) && visible.has(e.to)),
  };
}

/** Short date label for the timeline slider readout. */
function formatCutoff(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function GraphPage() {
  const categories = useAsync(() => api.categories.list(), []);
  const [showArticles, setShowArticles] = useState(true);
  const [showEntities, setShowEntities] = useState(true);
  const [importance, setImportance] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [timeWindow, setTimeWindow] = useState('');
  const [search, setSearch] = useState('');

  const nodeTypes = [
    ...(showArticles ? ['article'] : []),
    ...(showEntities ? ['entity'] : []),
  ].join(',');

  const graph = useAsync(
    () =>
      api.graph({
        nodeTypes: nodeTypes || 'article',
        importance: importance || undefined,
        categoryId: categoryId || undefined,
        since: windowToSince(timeWindow),
        q: search.trim() || undefined,
      }),
    [nodeTypes, importance, categoryId, timeWindow, search]
  );
  const [selected, setSelected] = useState<Selection | null>(null);

  // Timeline: the article-node timestamp range drives a "reveal up to" slider.
  const bounds = useMemo(() => timeBounds(graph.data), [graph.data]);
  const [cutoff, setCutoff] = useState<number | null>(null);
  // Reset the slider to "show all" whenever a new graph loads.
  useEffect(() => setCutoff(null), [graph.data]);

  const effectiveCutoff = cutoff ?? bounds?.max ?? null;
  const visibleGraph = useMemo(
    () =>
      graph.data && bounds && effectiveCutoff !== null
        ? filterByTime(graph.data, effectiveCutoff)
        : graph.data,
    [graph.data, bounds, effectiveCutoff]
  );

  const flow = useMemo(
    () => (visibleGraph ? toFlow(visibleGraph) : {nodes: [], edges: []}),
    [visibleGraph]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        Relationship graph
      </h1>

      <div className="flex flex-wrap items-center gap-3 nih-card p-3 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={showArticles}
            onChange={e => setShowArticles(e.target.checked)}
          />
          Articles
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={showEntities}
            onChange={e => setShowEntities(e.target.checked)}
          />
          Entities
        </label>
        <select
          className="nih-input px-2 py-1.5"
          value={importance}
          onChange={e => setImportance(e.target.value)}
        >
          <option value="">Any importance</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="junk">Junk</option>
        </select>
        <select
          className="nih-input px-2 py-1.5"
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.data?.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="nih-input px-2 py-1.5"
          value={timeWindow}
          onChange={e => setTimeWindow(e.target.value)}
        >
          <option value="">Any time</option>
          <option value="day">Last 24 hours</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
        </select>
        <input
          className="nih-input px-2 py-1.5"
          placeholder="Search nodes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="ml-auto text-xs text-slate-400">
          {flow.nodes.length} nodes · {flow.edges.length} edges
        </span>
      </div>

      {bounds && effectiveCutoff !== null && (
        <div className="flex items-center gap-3 nih-card p-3 text-sm">
          <span className="whitespace-nowrap text-slate-600 dark:text-slate-300">
            Timeline
          </span>
          <input
            type="range"
            className="flex-1 accent-slate-900"
            min={bounds.min}
            max={bounds.max}
            step={3600}
            value={effectiveCutoff}
            onChange={e => setCutoff(Number(e.target.value))}
          />
          <span className="w-28 whitespace-nowrap text-right text-xs text-slate-500">
            up to {formatCutoff(effectiveCutoff)}
          </span>
          {cutoff !== null && cutoff < bounds.max && (
            <button
              onClick={() => setCutoff(null)}
              className="text-xs text-slate-400 hover:text-slate-700 dark:text-slate-300"
            >
              Reset
            </button>
          )}
        </div>
      )}

      <div className="relative h-[70vh] overflow-hidden nih-card">
        {graph.loading ? (
          <Spinner />
        ) : graph.error ? (
          <ErrorNote message={graph.error} />
        ) : (
          <ReactFlow
            nodes={flow.nodes}
            edges={flow.edges}
            fitView
            onNodeClick={(_, node) =>
              setSelected({
                id: node.id,
                kind: (node.data as {kind: 'article' | 'entity'}).kind,
              })
            }
          >
            <Background color="#e2e8f0" />
            <Controls />
          </ReactFlow>
        )}
        {!graph.loading && !graph.error && flow.nodes.length > 0 && (
          <GraphLegend />
        )}
        {selected && (
          <NodeDetail selection={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  );
}

function GraphLegend() {
  return (
    <div className="absolute left-3 top-3 z-10 nih-card/90 p-2 text-[11px] shadow-sm backdrop-blur">
      <div className="mb-1 font-semibold text-slate-500">Entities</div>
      <div className="flex flex-col gap-0.5">
        {(Object.keys(ENTITY_COLORS) as EntityType[]).map(type => (
          <span key={type} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{background: ENTITY_COLORS[type]}}
            />
            <span className="capitalize text-slate-600 dark:text-slate-300">
              {type}
            </span>
          </span>
        ))}
      </div>
      <div className="mb-1 mt-2 font-semibold text-slate-500">Edges</div>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-slate-300" />
        <span className="text-slate-600 dark:text-slate-300">mentions</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 bg-indigo-500" />
        <span className="text-slate-600 dark:text-slate-300">co-mention</span>
      </span>
    </div>
  );
}

function NodeDetail({
  selection,
  onClose,
}: {
  selection: Selection;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-3 top-3 z-10 w-72 nih-card p-4 shadow-lg">
      <button
        onClick={onClose}
        className="mb-2 text-xs text-slate-400 hover:text-slate-700 dark:text-slate-300"
      >
        ✕ Close
      </button>
      {selection.kind === 'article' ? (
        <ArticleDetail id={selection.id} />
      ) : (
        <EntityDetail id={selection.id} />
      )}
    </div>
  );
}

function ArticleDetail({id}: {id: string}) {
  const card = useAsync(() => api.articles.get(id), [id]);
  if (card.loading) return <Spinner />;
  if (card.error) return <ErrorNote message={card.error} />;
  if (!card.data) return null;
  return (
    <div className="space-y-2">
      <span className="text-xs uppercase tracking-wide text-slate-400">
        Article
      </span>
      <h3 className="font-medium text-slate-900 dark:text-slate-100">
        {card.data.title}
      </h3>
      {card.data.summary && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {card.data.summary}
        </p>
      )}
      <a
        href={card.data.url}
        target="_blank"
        rel="noreferrer"
        className="block break-all text-xs text-indigo-600 dark:text-indigo-400 underline"
      >
        Open source
      </a>
    </div>
  );
}

function EntityDetail({id}: {id: string}) {
  const card = useAsync(() => api.entities.get(id), [id]);
  if (card.loading) return <Spinner />;
  if (card.error) return <ErrorNote message={card.error} />;
  if (!card.data) return null;
  return (
    <div className="space-y-2">
      <span className="text-xs uppercase tracking-wide text-slate-400">
        {card.data.type}
      </span>
      <h3 className="font-medium text-slate-900 dark:text-slate-100">
        {card.data.canonicalName}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {card.data.mentionCount} mentions · {card.data.aliases.length} aliases
      </p>
      {card.data.aliases.length > 1 && (
        <p className="text-xs text-slate-400">{card.data.aliases.join(', ')}</p>
      )}
    </div>
  );
}
