#!/usr/bin/env bash
# Tears down the local deployment.
#   scripts/kind-down.sh          -> delete the app namespace, keep the cluster
#   scripts/kind-down.sh --all    -> delete the whole kind cluster
set -euo pipefail
CLUSTER=news-hub
CTX="kind-${CLUSTER}"

if [ "${1:-}" = "--all" ]; then
  echo "[down] Deleting the kind cluster '$CLUSTER' (this also frees host :80)..."
  kind delete cluster --name "$CLUSTER"
else
  echo "[down] Deleting namespace 'news-hub' (cluster and ingress stay up)..."
  # Deleting the namespace also deletes the PVC, so Postgres data is discarded.
  kubectl --context "$CTX" delete namespace news-hub --ignore-not-found
  echo "[down] Cluster still running. Use --all to remove it entirely."
fi
