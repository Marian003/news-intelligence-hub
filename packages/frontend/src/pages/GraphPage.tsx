import {useMemo, useState} from 'react';
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
      },
    });
  });

  const edges: Edge[] = graph.edges.map((edge, i) => ({
    id: `e${i}`,
    source: edge.from,
    target: edge.to,
    type: 'straight',
    style:
      edge.kind === 'co_mention'
        ? {stroke: '#6366f1', strokeWidth: Math.min(1 + (edge.weight ?? 1), 6)}
        : {stroke: '#cbd5e1', strokeWidth: 1},
  }));

  return {nodes, edges};
}

export function GraphPage() {
  const categories = useAsync(() => api.categories.list(), []);
  const [showArticles, setShowArticles] = useState(true);
  const [showEntities, setShowEntities] = useState(true);
  const [importance, setImportance] = useState('');
  const [categoryId, setCategoryId] = useState('');

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
      }),
    [nodeTypes, importance, categoryId]
  );
  const [selected, setSelected] = useState<Selection | null>(null);

  const flow = useMemo(
    () => (graph.data ? toFlow(graph.data) : {nodes: [], edges: []}),
    [graph.data]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">
        Relationship graph
      </h1>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3 text-sm">
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
          className="rounded-md border border-slate-300 px-2 py-1.5"
          value={importance}
          onChange={e => setImportance(e.target.value)}
        >
          <option value="">Any importance</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="junk">Junk</option>
        </select>
        <select
          className="rounded-md border border-slate-300 px-2 py-1.5"
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
        <span className="ml-auto text-xs text-slate-400">
          {flow.nodes.length} nodes · {flow.edges.length} edges
        </span>
      </div>

      <div className="relative h-[70vh] overflow-hidden rounded-lg border bg-white">
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
        {selected && (
          <NodeDetail selection={selected} onClose={() => setSelected(null)} />
        )}
      </div>
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
    <div className="absolute right-3 top-3 z-10 w-72 rounded-lg border bg-white p-4 shadow-lg">
      <button
        onClick={onClose}
        className="mb-2 text-xs text-slate-400 hover:text-slate-700"
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
      <h3 className="font-medium text-slate-900">{card.data.title}</h3>
      {card.data.summary && (
        <p className="text-sm text-slate-600">{card.data.summary}</p>
      )}
      <a
        href={card.data.url}
        target="_blank"
        rel="noreferrer"
        className="block break-all text-xs text-indigo-600 underline"
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
      <h3 className="font-medium text-slate-900">{card.data.canonicalName}</h3>
      <p className="text-sm text-slate-600">
        {card.data.mentionCount} mentions · {card.data.aliases.length} aliases
      </p>
      {card.data.aliases.length > 1 && (
        <p className="text-xs text-slate-400">{card.data.aliases.join(', ')}</p>
      )}
    </div>
  );
}
