# Screenshots

Captured from the app running on the local kind cluster (`http://localhost`),
signed in as the demo account, with the demo dataset loaded. These are the real
deployed UI, not mockups.

| File | Screen | What it shows |
|---|---|---|
| `01-login.png` | `/login` | Sign-in screen |
| `02-feed.png` | `/` | Article feed: importance badge, source, summary, entity tags, category, and the "N similar in other sources" dedup counter |
| `03-article-detail.png` | `/` (card opened) | Enriched article: typed entities, categories, and all four classification axes (content type, reader level, region, tone) |
| `04-entity-graph.png` | `/graph` | Relationship graph: 16 nodes / 26 edges, entities coloured by type, `mentions` vs `co-mention` edges, timeline filter |
| `05-entities.png` | `/entities` | Canonical entities with their merged alias forms (ADR-2) |
| `pods.txt` | — | `kubectl get pods/svc/ingress/jobs/pvc -n news-hub` |

## Reproducing them

```bash
bash scripts/kind-up.sh        # cluster + ingress-nginx
bash scripts/k8s-deploy.sh     # build, load, migrate, roll out
bash scripts/k8s-seed.sh       # demo data (no LLM calls)

# Playwright is not a repo dependency - it is a ~115MB browser download used
# only to produce these images, so it is installed ad hoc:
npx --yes playwright@latest install chromium
node scripts/screenshots.mjs   # needs `playwright` resolvable; see the script header
```

The demo credentials are `demo@nih.local` / `demo12345`, created by the seed.

> The data is **synthetic** - the seed writes pre-analyzed articles directly to
> Postgres and makes no LLM calls, so these screens cost nothing to reproduce.
> Live processing of real RSS feeds needs `ANTHROPIC_API_KEY` (or
> `OPENAI_API_KEY`) in `.env`.
