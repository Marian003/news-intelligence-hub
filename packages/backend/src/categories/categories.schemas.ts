import {z} from 'zod';

const name = z.string().trim().min(1).max(60);
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'color must be a hex code like #1e88e5');

export const createCategorySchema = z.object({
  name,
  color: color.optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({name: name.optional(), color: color.nullable().optional()})
  .refine(v => v.name !== undefined || v.color !== undefined, {
    message: 'Provide at least one field to update',
  });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
