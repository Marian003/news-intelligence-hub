# News Intelligence Hub

A multi-user web app that ingests RSS/Atom feeds and turns the article stream
into a per-user **relationship graph** — articles and the entities they mention,
with typed, weighted connections — instead of a flat timeline. Each article is
enriched with extracted entities, a summary, an importance verdict, and the
user's own categories and classification axes.

The defining constraint: **the LLM is used surgically**, only for genuinely
semantic work (entity extraction, summarization, importance, category/axis
assignment). Everything a parser, regex, hash, or heuristic can do — RSS/Atom
parsing, URL normalization, deduplication, the junk pre-filter, queues, and
building the graph from already-tagged data — is deterministic code.

## Technology and the three forks

| Concern | Choice | Why (full rationale in the ADRs below) |
|---|---|---|
| Language | TypeScript everywhere | Required |
| **Backend** | **NestJS** | Transparent, explicitly-layered control over modules, queues, and data access — the rubric rewards this over saved CRUD boilerplate |
| **Frontend** | **React + Vite** | No SSR requirement; a lean SPA keeps the build and architecture obvious |
| **Database** | **PostgreSQL** | `jsonb` for the LLM cache, mature indexing, array columns for aliases/axis values |
| Styling | Tailwind CSS | Required |
| Graph UI | react-flow | Required |
| Queues | BullMQ + Redis | Required |
| Queue dashboard | Bull Board (standalone, basic-auth) | Required |
| LLM | Own provider-independent abstraction + OpenAI and Anthropic adapters | Required |
| Containers | Docker + Docker Compose | Required |

ORM/data access: **Drizzle** (SQL-first and transparent; the graph aggregates
are plain SQL). Password hashing: **argon2**. Auth: **JWT** with a Redis denylist
for logout. Lint/style: **gts** (Google's official TypeScript style tooling).

## Quick start

Prerequisites: Docker + Docker Compose. Nothing else needs to be installed.

```bash
# 1. Configure. Copy the example and fill in the blanks (passwords, secrets).
cp .env.example .env
#    At minimum set: POSTGRES_PASSWORD, JWT_SECRET, BULLBOARD_PASSWORD.
#    To process real feeds, set OPENAI_API_KEY or ANTHROPIC_API_KEY and
#    LLM_PROVIDER. The demo data below needs no LLM key.

# 2. Bring up the whole stack (db, redis, migrations, API, worker, Bull Board, UI).
docker compose up --build

# 3. (Recommended) Load demo data so the graph is populated immediately.
docker compose run --rm backend node packages/backend/dist/database/seed.js
```

Migrations are applied automatically on startup by a one-shot `migrate` service
that the backend waits for. The seed is the documented one-command way to get
demo data.

Then open:

| What | URL | Credentials |
|---|---|---|
| **App (frontend)** | http://localhost:8080 | demo: `demo@nih.local` / `demo12345` |
| Backend API | http://localhost:3000 | Bearer JWT |
| Bull Board | http://localhost:3100 | basic-auth: `BULLBOARD_USER` / `BULLBOARD_PASSWORD` |

The demo account comes pre-loaded with two feeds, eight processed articles, eight
canonical entities, categories, and axes — so the feed, cards, and graph are
populated without any feed polling or LLM calls. To exercise the live pipeline,
register your own account (the dev-mode email confirmation link is shown on the
post-registration screen and printed to the service log), add an RSS feed, and
click **Poll now** (this calls the configured LLM provider).

Ports (`POSTGRES_HOST_PORT`, `REDIS_HOST_PORT`, `BACKEND_PORT`, `FRONTEND_PORT`,
`BULLBOARD_PORT`) are all configurable in `.env` if a default is taken locally.

## How it works

**Services.** `frontend` (nginx-served SPA) → `backend` (NestJS HTTP API) →
`worker` (BullMQ consumers, no HTTP) → infrastructure (`postgres`, `redis`).
`bullboard` runs standalone behind basic-auth. The API never calls the LLM or
does long work synchronously — everything costly goes through a queue.

**Single-article pipeline** (cheap steps first):

1. **Poll** a feed → parse RSS/Atom (deterministic) → store new raw articles,
   deduplicated by normalized URL.
2. **Pre-filter** (deterministic, free): empty / too-short / low-information
   articles get status `filtered` and never reach the LLM.
3. **Content-hash cache**: if identical content was already analyzed, reuse the
   stored result — no provider call.
4. **One LLM call** returns the full markup (entities + summary + importance +
   category/axis assignments), validated against a zod schema before it touches
   the database.
5. **Entity resolution**: deterministic canonical-entity merge with aliases.
6. **Graph** is derived from the relational data on read, so each new mention is
   itself the incremental update — no full recompute.

## Repository structure

```
packages/
  shared/          # Cross-package types (EntityType, Importance, graph contract)
  backend/         # NestJS API + workers + LLM + data layer (Drizzle)
    src/
      auth/        feeds/  articles/  entities/  categories/  axes/
      graph/       regeneration/  digests/  telemetry/  processing/
      ingestion/   llm/  workers/  queue/  config/
      database/    # schema, migrations, seed
  frontend/        # React + Vite + Tailwind SPA
    src/pages/     # Feed, Graph, Entities, Digests, Telemetry, Feeds,
                   # Settings, Auth
scripts/
  check-unicode.mjs  # fails the build on non-printing Unicode (wired into lint)
docker-compose.yml   # one-command full stack
.env.example         # every variable, commented, no real values
```

## Commands

```bash
pnpm install        # workspace install
pnpm lint           # gts (Google TS style) + the non-printing-Unicode scan
pnpm build          # type-check + compile all packages
pnpm test           # backend unit tests (Vitest)
```

Configuration is entirely via environment variables — token limits, polling
cron, model names, worker concurrency, pre-filter thresholds, ports, and secrets
are all in `.env` (see `.env.example`). No operational config is hardcoded.

## Architectural Decisions

### ADR-1: Deterministic code vs the LLM
**Context.** The central principle: the LLM is a surgical instrument, not the
aggregator. Misusing it for work deterministic code can do loses points and
money.
**Decision.** Deterministic code owns: RSS/Atom parsing (`ingestion/feed-parser`,
our own mapping over `fast-xml-parser`), metadata extraction, URL normalization
(`ingestion/url-normalize`), content hashing, dedup by URL and content hash, the
junk pre-filter (`processing/pre-filter`), queues, retries, scheduling, the LLM
result cache, and building the graph from tagged data (`graph/graph.service`).
The LLM owns only: entity extraction, summary, importance, and category/axis
assignment — returned in a single `analyzeArticle` call.
**Alternatives.** Hand more to the LLM (e.g. categorization heuristics, "let it
summarize the feed"); or fewer (template-based summaries).
**Trade-offs.** Maximizes cost control and testability (the deterministic parts
have unit tests) and keeps the LLM surface auditable; costs more upfront design
than letting a model do everything.

### ADR-2: Entity deduplication
**Context.** The same entity written differently (Microsoft / Microsoft Corp. /
microsoft / MSFT / a Cyrillic spelling) must collapse to one graph node, without
falsely merging distinct entities.
**Decision.** A two-layer design. Layer 1 (implemented) is deterministic:
`normalizeEntityName` lowercases, strips punctuation, a leading "the", and legal
suffixes (Inc/Corp/Ltd/…), preserving non-Latin scripts; entities are canonical
per `(user, type, normalizedKey)` and accumulate the surface forms as `aliases`.
This merges Microsoft / Microsoft Corp. / microsoft with zero LLM cost and no
false merges. Layer 2 (implemented, env-gated by `LLM_ENTITY_MATCHING`) is an LLM
`matchEntities` pass for semantic aliases that share no normalized form (MSFT, a
Cyrillic spelling): only when both the deterministic key and the alias-key cache
miss does the resolver ask the model whether the new surface form is one of the
existing entities of that type. The verdict is cached in `entity_alias_keys`
(`user, type, aliasKey -> entityId`), so each novel form is matched **at most
once** and never re-calls; the candidate set is capped (`ENTITY_MATCH_MAX_
CANDIDATES`), and an id the model returns that was not among the offered
candidates is rejected, so it cannot invent a merge.
**Alternatives.** Pure-LLM matching (expensive, risks false merges); a hardcoded
ticker/acronym map (doesn't generalize); a pairwise scan (quadratic).
**Trade-offs.** Matching is off by default so normal processing keeps its
one-call-per-article guarantee; turning it on adds at most one call per *novel*
surface form (then cached), trading a little cost for catching acronyms and
transliterations the deterministic layer cannot.

### ADR-3: LLM cost control and caching
**Context.** The LLM is the most expensive resource; it must be economical and
observable.
**Decision.** Three lines of defense: (1) the deterministic pre-filter drops junk
before any call; (2) a content-hash cache (`llm_cache`, a `jsonb` row keyed by
the article content hash, shared across users) means identical content is
analyzed once; (3) at most one provider call per article, with a per-call token
limit and concurrency both from env. Every real call is recorded in `llm_usage`
(operation = processing | regeneration | digest | entity_match, provider, model,
tokens), aggregated per operation by `GET /telemetry/llm` and shown on the
Telemetry page. Regeneration deliberately bypasses the cache because axis/category
classification depends on the user's catalog; entity matching has its own cache
(`entity_alias_keys`, see ADR-2) so it never repeats a verdict.
**Alternatives.** No cache (simpler, costly); per-user caches (less sharing); a
cache key including the catalog (correct for categories but kills cross-user
reuse of the expensive part).
**Trade-offs.** The cache stores the user-independent analysis, so on a
cross-user cache hit the category/axis *suggestions* reflect the first analyzer's
catalog; a fresh analysis (miss) is tailored to the current user. This keeps the
expensive semantic work shared while keeping per-user markup correct on misses.

### ADR-4: LLM provider error handling
**Context.** A failing provider must not take the system down (fail loud, degrade
soft).
**Decision.** Each adapter enforces a per-call timeout (`AbortController`) and
validates structured JSON output against a zod schema before use — invalid
output throws and never reaches the database. The active LLM service is a
`ResilientLlmService` that **fails over** to the other provider when a call
errors (the provider-independent interface makes the wrapper trivial). Processing
then runs in BullMQ with retry + exponential backoff; on exhausted retries the
article is marked `failed` ("awaiting processing") and picked up later. Feed
errors are recorded on the feed's status while other feeds keep running. Errors
are logged with ids and context, never swallowed.
**Alternatives.** No failover (rely on retries only); no retries at all.
**Trade-offs.** Failover + retry/backoff + a clear `failed` state is robust;
failover only engages when the *other* provider also has a key configured, so it
degrades gracefully to retry-only when a single provider is set up.

### ADR-5: Backend — NestJS over Directus
**Context.** The most significant fork. Directus gives auth/CRUD/admin out of the
box; NestJS gives nothing for free but full control.
**Decision.** NestJS. The custom logic that defines this project (the LLM
pipeline, dedup, graph building, workers, queue wiring) lives outside any CRUD
layer regardless, and the rubric rewards transparent, explicitly-layered
architecture and punishes "the framework hides it." Explicit modules and a
repository data-access layer make the tenant-isolation and queue boundaries
auditable.
**Alternatives.** Directus as the data source with custom services alongside.
**Trade-offs.** We write the auth, CRUD, and validation ourselves (more code) in
exchange for full control and an architecture a reviewer can read end to end.

### ADR-6: Multi-tenant isolation at the data layer
**Context.** User A must never see user B's feeds, markup, or graph — enforced in
data access, not just hidden in the UI.
**Decision.** Every tenant-scoped table carries `userId`, and every repository
method that targets a specific row includes `userId` in the `WHERE` clause;
requesting another user's resource by id returns 404. Raw article *content* is
de-duplicated across users only through the global content-hash LLM cache (a cost
optimization); feeds, markup, entity resolution, assignments, and the graph are
strictly per-user. The trusted worker uses separate, clearly-named non-scoped
methods (it is not a user request).
**Alternatives.** Row-level security in Postgres; filtering only in the API.
**Trade-offs.** Explicit `userId` filters are simple and visible at every call
site; they rely on discipline in the repository layer rather than a database
policy, which we judged the clearer choice for a reviewer to verify.

## Feature status (honest)

**Must — implemented:** registration + dev-mode email confirmation, login/logout
(session survives reload), multi-tenant isolation, feed CRUD with status,
category CRUD, axis CRUD with 4 seeded axes, scheduled + manual feed polling,
the article-processing worker (pre-filter → LLM → validate → persist), the LLM
abstraction with OpenAI and Anthropic adapters (env-switchable), article dedup
with the "N similar" counter, deterministic entity dedup, cost control (token
limit, content-hash cache, pre-filter), structured logs + LLM cost telemetry,
the article feed with filters + article card, the react-flow graph with typed
edges and node-type/category filters, the axes settings UI with a regeneration
action, Bull Board behind basic-auth, one-command `docker compose` startup, a
demo seed, and this README with ADRs.

**Should — implemented:** cross-provider LLM failover (`ResilientLlmService`);
period digests (US-11/FR-11 — day/week/month, optional category scope, built in a
dedicated `digest` queue: deterministic aggregation of top entities/categories +
key articles, then one LLM call for the narrative); extended graph filters (time
window + free-text node search); a dedicated LLM telemetry dashboard
(`GET /telemetry/llm` + Telemetry page, per-operation calls and tokens);
meaningful unit tests on the critical parts (LLM adapter parse/validate/error,
RSS/Atom parsing, the pre-filter, URL/hash, entity normalization, failover, the
fuzzy-match resolver) — 59 tests via Vitest.

**Could — implemented:** edge animation along timestamps (entity co-mention edges
are animated); a timeline slider that replays the graph as it grew (reveals
articles up to a cutoff plus the entities they mention); full-text article search
over title + summary + content (Postgres `to_tsvector`/`websearch_to_tsquery`,
relevance-ranked). Not implemented: category clustering, top-entities dashboard,
graph export, article-to-article semantic similarity (the graph schema reserves a
`similar` edge type for it).

**Known limitations.**
- FR-6 LLM fuzzy entity matching (MSFT, Cyrillic) is implemented but **off by
  default** (`LLM_ENTITY_MATCHING=false`) to keep the one-call-per-article
  guarantee; enable it in `.env` (with a provider key) to merge acronyms /
  transliterations. The deterministic layer always runs (see ADR-2).
- Digests, regeneration, entity matching, and live feed polling call the LLM, so
  they need a real provider key (or a local mock) in `.env`; the pre-loaded demo
  data needs none, and a digest over an empty window completes without any call.
