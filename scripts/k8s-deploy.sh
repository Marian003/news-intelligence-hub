#!/usr/bin/env bash
# Builds the images, loads them into the kind node, applies the manifests, runs
# the migration Job, and waits for every workload to be Ready.
#
# Safe to re-run: it is the normal way to ship a code change to the cluster.
set -euo pipefail
cd "$(dirname "$0")/.."

CLUSTER=news-hub
CTX="kind-${CLUSTER}"
NS=news-hub
API_IMAGE=news-hub/api:local
WEB_IMAGE=news-hub/web:local

kubectl config get-contexts "$CTX" >/dev/null 2>&1 || {
  echo "error: context $CTX not found. Run scripts/kind-up.sh first." >&2
  exit 1
}

echo "[deploy] 1/6 Building images..."
# The build context is the repo root: the Dockerfiles need the workspace
# lockfile and packages/shared, which live above each package directory.
docker build -f packages/backend/Dockerfile -t "$API_IMAGE" .
# VITE_API_URL is baked into the bundle at build time. '/api' (relative) makes
# the browser call the same origin it loaded the page from, which is what the
# Ingress routes - so no CORS and no hardcoded hostname.
#
# MSYS_NO_PATHCONV=1 is required on Git Bash for Windows: MSYS rewrites any
# argument that looks like a Unix absolute path into a Windows one, silently
# turning `/api` into `C:/Program Files/Git/api`. That still builds and still
# serves the SPA, but every fetch from the browser then targets a file:// URL
# and fails - a failure invisible to `curl` against the Ingress, because curl
# never executes the bundle. It is a harmless no-op on macOS/Linux.
MSYS_NO_PATHCONV=1 docker build -f packages/frontend/Dockerfile \
  --build-arg VITE_API_URL=/api -t "$WEB_IMAGE" .

echo "[deploy] 2/6 Loading images into the kind node..."
# kind nodes have their own container runtime and cannot see the host's image
# store, so images must be pushed in explicitly. This is why the manifests use
# imagePullPolicy: IfNotPresent - :local exists on the node but in no registry.
kind load docker-image "$API_IMAGE" --name "$CLUSTER"
kind load docker-image "$WEB_IMAGE" --name "$CLUSTER"

echo "[deploy] 3/6 Rendering the Secret from .env..."
bash scripts/k8s-secret.sh

echo "[deploy] 4/6 Applying manifests..."
kubectl --context "$CTX" apply -f k8s/00-namespace.yaml
kubectl --context "$CTX" apply -f k8s/10-config.yaml -f k8s/secret.yaml
kubectl --context "$CTX" apply -f k8s/20-postgres.yaml -f k8s/21-redis.yaml

echo "[deploy] 5/6 Running database migrations..."
# A completed Job's pod template is immutable, so replace rather than re-apply.
kubectl --context "$CTX" delete job db-migrate -n "$NS" --ignore-not-found
kubectl --context "$CTX" apply -f k8s/30-migrate-job.yaml
if ! kubectl --context "$CTX" wait --for=condition=complete job/db-migrate \
     -n "$NS" --timeout=300s; then
  echo "error: migration Job did not complete. Logs:" >&2
  kubectl --context "$CTX" logs job/db-migrate -n "$NS" --tail=50 >&2 || true
  exit 1
fi

echo "[deploy] 6/6 Applying app workloads..."
kubectl --context "$CTX" apply \
  -f k8s/40-api.yaml -f k8s/41-worker.yaml -f k8s/42-web.yaml -f k8s/50-ingress.yaml

# `apply` on an unchanged Deployment is a no-op, so force a restart to pick up a
# rebuilt image that kept the same :local tag.
kubectl --context "$CTX" rollout restart deployment/api deployment/worker deployment/web -n "$NS"

for d in api worker web; do
  echo "[deploy] Waiting for rollout: $d"
  kubectl --context "$CTX" rollout status "deployment/$d" -n "$NS" --timeout=300s
done

echo "[deploy] Done. Open http://localhost"
kubectl --context "$CTX" get pods -n "$NS"
