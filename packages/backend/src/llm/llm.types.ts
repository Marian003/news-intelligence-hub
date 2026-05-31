import type {EntityType, Importance} from '@nih/shared';

/** A category the user defined, offered to the model to choose from. */
export interface CategoryOption {
  name: string;
  description?: string;
}

/** A classification axis (e.g. "reader level") with its allowed values. */
export interface AxisOption {
  name: string;
  values: string[];
  description?: string;
}

/** Everything the model needs to analyze one article. */
export interface ArticleAnalysisInput {
  title: string;
  content: string;
  categories: CategoryOption[];
  axes: AxisOption[];
  maxTokens: number;
}

export interface ExtractedEntity {
  name: string;
  type: EntityType;
}

export interface AxisAssignment {
  axis: string;
  value: string;
}

/** The validated markup the model returns for one article. */
export interface ArticleAnalysisResult {
  summary: string;
  importance: Importance;
  entities: ExtractedEntity[];
  categories: string[];
  axes: AxisAssignment[];
}

/** Token usage for cost telemetry. */
export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface ArticleAnalysisResponse {
  result: ArticleAnalysisResult;
  usage: LlmUsage;
  provider: string;
  model: string;
}

/**
 * Provider-independent LLM interface. Adapters (OpenAI, Anthropic) implement it;
 * the active one is selected by env. Extended with matchEntities/buildDigest in
 * the milestones that need them.
 */
export interface LlmService {
  readonly provider: string;
  readonly model: string;
  analyzeArticle(input: ArticleAnalysisInput): Promise<ArticleAnalysisResponse>;
}
