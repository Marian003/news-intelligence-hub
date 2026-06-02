import {parseAnalysis, parseDigest, parseEntityMatch} from './analysis.schema';
import {FetchLike, postJson} from './http';
import {
  buildAnalysisPrompt,
  buildDigestPrompt,
  buildEntityMatchPrompt,
} from './prompt';
import type {
  ArticleAnalysisInput,
  ArticleAnalysisResponse,
  DigestInput,
  DigestResponse,
  EntityMatchInput,
  EntityMatchResponse,
  LlmService,
} from './llm.types';

export interface AnthropicAdapterOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  fetchImpl?: FetchLike;
  baseUrl?: string;
}

interface AnthropicResponse {
  content?: Array<{type: string; text?: string}>;
  usage?: {input_tokens?: number; output_tokens?: number};
}

/**
 * Anthropic Messages adapter. Calls the REST API directly. Anthropic has no JSON
 * mode, so the prompt asks for JSON and {@link parseAnalysis} tolerates fences;
 * temperature 0 keeps output stable.
 */
export class AnthropicAdapter implements LlmService {
  readonly provider = 'anthropic';
  readonly model: string;
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;

  constructor(private readonly options: AnthropicAdapterOptions) {
    this.model = options.model;
    this.fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
    this.baseUrl = options.baseUrl ?? 'https://api.anthropic.com';
  }

  async analyzeArticle(
    input: ArticleAnalysisInput
  ): Promise<ArticleAnalysisResponse> {
    const {system, user} = buildAnalysisPrompt(input);
    const {text, usage} = await this.message(system, user, input.maxTokens);
    return {result: parseAnalysis(text), usage, ...this.identity()};
  }

  async buildDigest(input: DigestInput): Promise<DigestResponse> {
    const {system, user} = buildDigestPrompt(input);
    const {text, usage} = await this.message(system, user, input.maxTokens);
    return {result: parseDigest(text), usage, ...this.identity()};
  }

  async matchEntities(input: EntityMatchInput): Promise<EntityMatchResponse> {
    const {system, user} = buildEntityMatchPrompt(input);
    const {text, usage} = await this.message(system, user, input.maxTokens);
    return {result: parseEntityMatch(text), usage, ...this.identity()};
  }

  private identity() {
    return {provider: this.provider, model: this.model};
  }

  /** One Messages call; returns the text block and token usage. */
  private async message(system: string, user: string, maxTokens: number) {
    if (!this.options.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    const raw = (await postJson(
      this.fetchImpl,
      `${this.baseUrl}/v1/messages`,
      {
        'x-api-key': this.options.apiKey,
        'anthropic-version': '2023-06-01',
      },
      {
        model: this.model,
        max_tokens: maxTokens,
        temperature: 0,
        system,
        messages: [{role: 'user', content: user}],
      },
      this.options.timeoutMs
    )) as AnthropicResponse;

    const text = raw.content?.find(block => block.type === 'text')?.text;
    if (!text) {
      throw new Error('Anthropic response had no text content');
    }
    return {
      text,
      usage: {
        promptTokens: raw.usage?.input_tokens ?? 0,
        completionTokens: raw.usage?.output_tokens ?? 0,
      },
    };
  }
}
