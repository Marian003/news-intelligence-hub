import {parseAnalysis} from './analysis.schema';
import {FetchLike, postJson} from './http';
import {buildAnalysisPrompt} from './prompt';
import type {
  ArticleAnalysisInput,
  ArticleAnalysisResponse,
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
    if (!this.options.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    const {system, user} = buildAnalysisPrompt(input);
    const raw = (await postJson(
      this.fetchImpl,
      `${this.baseUrl}/v1/messages`,
      {
        'x-api-key': this.options.apiKey,
        'anthropic-version': '2023-06-01',
      },
      {
        model: this.model,
        max_tokens: input.maxTokens,
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
      result: parseAnalysis(text),
      usage: {
        promptTokens: raw.usage?.input_tokens ?? 0,
        completionTokens: raw.usage?.output_tokens ?? 0,
      },
      provider: this.provider,
      model: this.model,
    };
  }
}
