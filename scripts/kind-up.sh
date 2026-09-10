#!/usr/bin/env bash
# Creates the local kind cluster and installs the ingress-nginx controller.
# Idempotent: re-running with the cluster already present just re-checks ingress.
set -euo pipefail
cd "$(dirname "$0")/.."

CLUSTER=news-hub
CTX="kind-${CLUSTER}"

command -v kind >/dev/null || { echo "error: kind is not installed." >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "error: Docker is not running." >&2; exit 1; }

if kind get clusters 2>/dev/null | grep -qx "$CLUSTER"; then
  echo "[kind-up] Cluster '$CLUSTER' already exists - reusing it."
else
  echo "[kind-up] Creating cluster '$CLUSTER'..."
  kind create cluster --config k8s/kind-cluster.yaml
fi

echo "[kind-up] Installing ingress-nginx (kind provider manifest)..."
kubectl --context "$CTX" apply -f \
  https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

echo "[kind-up] Waiting for the ingress controller to become ready..."
# The admission Job races the controller Deployment on a cold cluster, so wait
# on the controller pod itself rather than on the whole namespace.
kubectl --context "$CTX" wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s

echo "[kind-up] Cluster ready. Context: $CTX"
