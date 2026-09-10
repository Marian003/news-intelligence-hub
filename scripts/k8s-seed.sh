#!/usr/bin/env bash
# Loads the demo dataset into the deployed cluster, as a Job.
#
# Uses the repo's existing LLM-free seed (packages/backend/src/database/seed.ts),
# so the cluster gets exactly the dataset the README documents. Idempotent: the
# seed drops and recreates the demo user under a fixed id, so re-running is safe
# and leaves an existing login session valid.
#
# Deliberately NOT run by k8s-deploy.sh - a redeploy should not silently rewrite
# demo data.
set -euo pipefail
cd "$(dirname "$0")/.."

CTX=kind-news-hub
NS=news-hub
K="kubectl --context $CTX -n $NS"

$K get ns "$NS" >/dev/null 2>&1 || {
  echo "error: namespace $NS not found. Run scripts/k8s-deploy.sh first." >&2
  exit 1
}

echo "[seed] Running the demo seed as a Job..."
# A completed Job's pod template is immutable, so replace rather than re-apply.
$K delete job db-seed --ignore-not-found
$K apply -f k8s/31-seed-job.yaml

if ! $K wait --for=condition=complete job/db-seed --timeout=300s; then
  echo "error: seed Job did not complete. Logs:" >&2
  $K logs job/db-seed --tail=50 >&2 || true
  exit 1
fi

$K logs job/db-seed --tail=20
echo
echo "[seed] Done. Sign in at http://localhost with:"
echo "[seed]   demo@nih.local / demo12345"
