# News Intelligence Hub

A multi-user web app that ingests RSS/Atom feeds and turns the article stream
into a per-user **relationship graph** of articles and the entities they mention,
rather than a flat timeline. Each article is enriched with extracted entities, a
summary, an importance verdict, and user-defined categories/axes. The LLM is used
only for genuinely semantic work; parsing, deduplication, scheduling, and graph
assembly are deterministic code.

## Stack

TypeScript throughout. Backend: NestJS. Frontend: React + Vite. Styling: Tailwind.
Graph UI: react-flow. Queues: BullMQ + Redis. Database: PostgreSQL. Containerized
with Docker Compose.

## Repository layout

This is a pnpm workspace monorepo.

- `packages/shared` — types shared across backend and frontend.
- `packages/backend` — NestJS API and background workers _(added in a later milestone)_.
- `packages/frontend` — React app _(added in a later milestone)_.
- `scripts/check-unicode.mjs` — fails the build on non-printing Unicode characters.

## Development

```bash
pnpm install
pnpm lint     # Google TS style (gts) + the non-printing-Unicode scan
pnpm build
```

Copy `.env.example` to `.env` and fill in the values before running the stack.

> Full run instructions, demo-data loading, and the Architectural Decision
> Records are added as the corresponding features land.
