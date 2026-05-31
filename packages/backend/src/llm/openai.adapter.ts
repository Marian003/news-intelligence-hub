import {parseAnalysis} from './analysis.schema';
import {FetchLike, postJson} from './http';
import {buildAnalysisPrompt} from './prompt';
import type {
  ArticleAnalysisInput,
  ArticleAnalysisResponse,
  LlmService,
} from './llm.types';

export interface OpenAiAdapterOptions {
  apiKey: string;
  model: string;
  timeoutMs: number;
  /** Injectable for tests; defaults to Node's global fetch. */
  fetchImpl?: FetchLike;
  baseUrl?: string;
}

interface OpenAiResponse {
  choices?: Array<{message?: {content?: string}}>;
  usage?: {prompt_tokens?: number; completion_tokens?: number};
}

/**
 * OpenAI Chat Completions adapter. Calls the REST API directly (no SDK) so every
 * field sent and read is visible here. Requests JSON mode and temperature 0 for
 * stable, parseable output.
 */
export class OpenAiAdapter implements LlmService {
  readonly provider = 'openai';
  readonly model: string;
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;

  constructor(private readonly options: OpenAiAdapterOptions) {
    this.model = options.model;
    this.fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com';
  }

  async analyzeArticle(
    input: ArticleAnalysisInput
  ): Promise<ArticleAnalysisResponse> {
    if (!this.options.apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    const {system, user} = buildAnalysisPrompt(input);
    const raw = (await postJson(
      this.fetchImpl,
      `${this.baseUrl}/v1/chat/completions`,
      {authorization: `Bearer ${this.options.apiKey}`},
      {
        model: this.model,
        temperature: 0,
        max_tokens: input.maxTokens,
        response_format: {type: 'json_object'},
        messages: [
          {role: 'system', content: system},
          {role: 'user', content: user},
        ],
      },
      this.options.timeoutMs
    )) as OpenAiResponse;

    const content = raw.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI response had no message content');
    }
    return {
      result: parseAnalysis(content),
      usage: {
        promptTokens: raw.usage?.prompt_tokens ?? 0,
        completionTokens: raw.usage?.completion_tokens ?? 0,
      },
      provider: this.provider,
      model: this.model,
    };
  }
}
