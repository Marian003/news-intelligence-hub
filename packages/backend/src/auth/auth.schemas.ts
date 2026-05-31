import {z} from 'zod';

const email = z
  .string()
  .email()
  .transform(value => value.toLowerCase());

export const registerSchema = z.object({
  email,
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;
