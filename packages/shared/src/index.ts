/**
 * Contracts shared between the backend and the frontend. Kept deliberately
 * small: only types that genuinely cross the package boundary live here, so
 * both ends agree on the same shape without duplicating it.
 */

/**
 * The kinds of named entity the pipeline extracts and the graph renders. This
 * union is the single source of truth for an entity's type on both the domain
 * model (backend) and the graph node schema (frontend).
 */
export type EntityType =
  | 'person'
  | 'company'
  | 'product'
  | 'technology'
  | 'location';
