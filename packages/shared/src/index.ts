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
