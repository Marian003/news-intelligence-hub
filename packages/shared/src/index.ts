/**
 * Contracts shared between the backend and the frontend. Kept deliberately
 * small: only types that genuinely cross the package boundary live here, so
 * both ends agree on the same shape without duplicating it.
 */

/**
 * The kinds of named entity the pipeline extracts and the graph renders. The
 * runtime array is the single source of truth (the backend builds its zod enum
 * from it; the frontend reuses it for filters), and {@link EntityType} is
 * derived from it so they can never drift apart.
 */
export const ENTITY_TYPES = [
  'person',
  'company',
  'product',
  'technology',
  'location',
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

/** Importance verdict assigned to an article (matches the graph node schema). */
export const IMPORTANCE_LEVELS = ['high', 'normal', 'junk'] as const;

export type Importance = (typeof IMPORTANCE_LEVELS)[number];

// --- Graph contract (shared by the backend graph endpoint and the react-flow UI) ---

export type GraphEdgeKind = 'mentions' | 'co_mention' | 'similar';

export interface GraphArticleNode {
  id: string;
  kind: 'article';
  label: string;
  ts: number | null; // Unix seconds
  importance: Importance | null;
}

export interface GraphEntityNode {
  id: string;
  kind: 'entity';
  label: string;
  entityType: EntityType;
}

export type GraphNode = GraphArticleNode | GraphEntityNode;

export interface GraphEdge {
  from: string;
  to: string;
  kind: GraphEdgeKind;
  weight?: number; // co_mention: times the pair co-occurred
  score?: number; // similar: 0..1
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
