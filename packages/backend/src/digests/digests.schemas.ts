import {z} from 'zod';

/** Body for requesting a digest: a period and optional scope filters. */
export const createDigestSchema = z.object({
  period: z.enum(['day', 'week', 'month']),
  categoryIds: z.array(z.string().uuid()).max(50).default([]),
  entityIds: z.array(z.string().uuid()).max(50).default([]),
});

export type CreateDigestBody = z.infer<typeof createDigestSchema>;
