import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ConfigService} from '@nestjs/config';
import type {EntityRow} from '../database/schema';
import type {LlmUsageRepository} from '../llm/llm-usage.repository';
import type {EntityMatchResponse, LlmService} from '../llm/llm.types';
import type {EntitiesRepository} from './entities.repository';
import {EntityResolutionService} from './entity-resolution.service';

function entity(id: string, canonicalName: string, key: string): EntityRow {
  return {
    id,
    userId: 'u1',
    canonicalName,
    normalizedKey: key,
    type: 'company',
    aliases: [canonicalName],
    description: null,
    createdAt: new Date(),
  };
}

function matchResponse(matchId: string | null): EntityMatchResponse {
  return {
    result: {matchId},
    usage: {promptTokens: 1, completionTokens: 1},
    provider: 'openai',
    model: 'm',
  };
}

/** Fake repo: only the methods the resolver touches, each a spy. */
function makeRepo() {
  return {
    findByKey: vi.fn(async () => undefined as EntityRow | undefined),
    findByAliasKey: vi.fn(async () => undefined as EntityRow | undefined),
    candidatesForType: vi.fn(async () => [] as Array<{id: string}>),
    findById: vi.fn(async () => undefined as EntityRow | undefined),
    addAliasKey: vi.fn(async () => {}),
    upsertCanonical: vi.fn(async (_u, _t, key, name) =>
      entity('new', name, key)
    ),
    addAlias: vi.fn(async () => {}),
    replaceLinks: vi.fn(async () => {}),
  };
}

function makeService(
  repo: ReturnType<typeof makeRepo>,
  llm: {matchEntities: ReturnType<typeof vi.fn>},
  matchingEnabled: boolean
) {
  const config = {
    getOrThrow: (key: string) =>
      key === 'LLM_ENTITY_MATCHING'
        ? matchingEnabled
        : key === 'ENTITY_MATCH_MAX_CANDIDATES'
          ? 20
          : 1024,
  } as unknown as ConfigService;
  const usage = {
    record: vi.fn(async () => {}),
  } as unknown as LlmUsageRepository;
  return new EntityResolutionService(
    repo as unknown as EntitiesRepository,
    usage,
    config,
    llm as unknown as LlmService
  );
}

const article = {id: 'a1', userId: 'u1'};
const mention = [{name: 'MSFT', type: 'company' as const}];

describe('EntityResolutionService fuzzy matching', () => {
  let llm: {matchEntities: ReturnType<typeof vi.fn>};

  beforeEach(() => {
    llm = {matchEntities: vi.fn()};
  });

  it('uses the deterministic key and never calls the LLM when it hits', async () => {
    const repo = makeRepo();
    repo.findByKey.mockResolvedValue(entity('e1', 'Microsoft', 'msft'));
    const service = makeService(repo, llm, true);

    await service.resolveForArticle(article, mention);

    expect(llm.matchEntities).not.toHaveBeenCalled();
    expect(repo.upsertCanonical).not.toHaveBeenCalled();
  });

  it('creates a new entity without the LLM when matching is disabled', async () => {
    const repo = makeRepo();
    const service = makeService(repo, llm, false);

    await service.resolveForArticle(article, mention);

    expect(llm.matchEntities).not.toHaveBeenCalled();
    expect(repo.upsertCanonical).toHaveBeenCalledOnce();
  });

  it('resolves via the alias-key cache without calling the LLM', async () => {
    const repo = makeRepo();
    repo.findByAliasKey.mockResolvedValue(entity('e1', 'Microsoft', 'msft'));
    const service = makeService(repo, llm, true);

    await service.resolveForArticle(article, mention);

    expect(llm.matchEntities).not.toHaveBeenCalled();
    expect(repo.upsertCanonical).not.toHaveBeenCalled();
  });

  it('matches a novel form to an existing entity and caches the verdict', async () => {
    const repo = makeRepo();
    repo.candidatesForType.mockResolvedValue([{id: 'e1'}]);
    repo.findById.mockResolvedValue(entity('e1', 'Microsoft', 'microsoft'));
    llm.matchEntities.mockResolvedValue(matchResponse('e1'));
    const service = makeService(repo, llm, true);

    await service.resolveForArticle(article, mention);

    expect(llm.matchEntities).toHaveBeenCalledOnce();
    expect(repo.addAliasKey).toHaveBeenCalledWith(
      'u1',
      'company',
      'msft',
      'e1'
    );
    expect(repo.upsertCanonical).not.toHaveBeenCalled();
  });

  it('rejects a hallucinated id not among the candidates and creates instead', async () => {
    const repo = makeRepo();
    repo.candidatesForType.mockResolvedValue([{id: 'e1'}]);
    llm.matchEntities.mockResolvedValue(matchResponse('does-not-exist'));
    const service = makeService(repo, llm, true);

    await service.resolveForArticle(article, mention);

    expect(repo.addAliasKey).not.toHaveBeenCalled();
    expect(repo.upsertCanonical).toHaveBeenCalledOnce();
  });

  it('skips the LLM when there are no candidates to match against', async () => {
    const repo = makeRepo();
    repo.candidatesForType.mockResolvedValue([]);
    const service = makeService(repo, llm, true);

    await service.resolveForArticle(article, mention);

    expect(llm.matchEntities).not.toHaveBeenCalled();
    expect(repo.upsertCanonical).toHaveBeenCalledOnce();
  });
});
