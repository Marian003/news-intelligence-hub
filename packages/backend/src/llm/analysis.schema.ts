import {ENTITY_TYPES, IMPORTANCE_LEVELS} from '@nih/shared';
import {z} from 'zod';
import type {ArticleAnalysisResult} from './llm.types';

/**
 * The exact JSON shape the model must return. Validated before anything touches
 * the database — invalid model output is rejected, never persisted. The entity
 * and importance enums are built from the shared source of truth so they can't
 * drift from the rest of the app.
 */
export const analysisSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  importance: z.enum(IMPORTANCE_LEVELS),
  entities: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        type: z.enum(ENTITY_TYPES),
      })
    )
    .max(50),
  categories: z.array(z.string().trim().min(1)).max(50).default([]),
  axes: z
    .array(
      z.object({
        axis: z.string().trim().min(1),
        value: z.string().trim().min(1),
      })
    )
    .max(50)
    .default([]),
});

export type AnalysisOutput = z.infer<typeof analysisSchema>;

/**
 * Extracts the JSON object from raw model text. Models sometimes wrap JSON in
 * markdown fences or add a stray sentence; we take the outermost {...} span.
 * Throws if no JSON object is present.
 */
function extractJsonObject(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in model output');
  }
  return candidate.slice(start, end + 1);
}

/**
 * Parses and validates raw model text into the analysis result. Throws on
 * malformed JSON or schema violations so the caller can retry or mark the
 * article failed — bad markup is never silently accepted.
 */
export function parseAnalysis(raw: string): ArticleAnalysisResult {
  let json: unknown;
  try {
    json = JSON.parse(extractJsonObject(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Model output was not valid JSON: ${message}`);
  }

  const parsed = analysisSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Model output failed validation: ${issues}`);
  }
  return parsed.data;
}
