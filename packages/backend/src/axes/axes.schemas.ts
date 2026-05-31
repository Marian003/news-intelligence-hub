import {z} from 'zod';

const name = z.string().trim().min(1).max(60);
const values = z
  .array(z.string().trim().min(1).max(40))
  .min(1, 'an axis needs at least one value')
  .max(20)
  // De-duplicate while preserving order.
  .transform(vs => [...new Map(vs.map(v => [v.toLowerCase(), v])).values()]);

export const createAxisSchema = z.object({name, values});
export type CreateAxisInput = z.infer<typeof createAxisSchema>;

export const updateAxisSchema = z
  .object({name: name.optional(), values: values.optional()})
  .refine(v => v.name !== undefined || v.values !== undefined, {
    message: 'Provide at least one field to update',
  });
export type UpdateAxisInput = z.infer<typeof updateAxisSchema>;
