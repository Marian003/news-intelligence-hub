import {z} from 'zod';

const feedUrl = z
  .string()
  .url()
  .refine(value => /^https?:\/\//i.test(value), 'URL must use http or https');

const feedTitle = z.string().trim().min(1).max(200);

export const createFeedSchema = z.object({
  url: feedUrl,
  title: feedTitle.optional(),
});
export type CreateFeedInput = z.infer<typeof createFeedSchema>;

export const updateFeedSchema = z
  .object({
    title: feedTitle.optional(),
    // A user may pause or re-activate a feed; the `error` state is system-set.
    status: z.enum(['active', 'paused']).optional(),
  })
  .refine(value => value.title !== undefined || value.status !== undefined, {
    message: 'Provide at least one field to update',
  });
export type UpdateFeedInput = z.infer<typeof updateFeedSchema>;
