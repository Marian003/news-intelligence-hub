#!/usr/bin/env bash
# Verifies the deployed stack end to end and prints the evidence.
# Exits non-zero on the first real failure, so it is usable as a smoke test.
set -uo pipefail
cd "$(dirname "$0")/.."

CTX=kind-news-hub
NS=news-hub
K="kubectl --context $CTX -n $NS"
fail=0

check() { # check <description> <expected> <actual>
  if [ "$2" = "$3" ]; then
    printf '  PASS  %s\n' "$1"
  else
    printf '  FAIL  %s (expected %s, got %s)\n' "$1" "$2" "$3"
    fail=1
  fi
}

echo "== Pods =="
$K get pods -o wide || exit 1

echo
echo "== Workload readiness =="
for d in api worker web postgres redis; do
  ready=$($K get deploy "$d" -o jsonpath='{.status.readyReplicas}' 2>/dev/null)
  want=$($K get deploy "$d" -o jsonpath='{.spec.replicas}' 2>/dev/null)
  check "deployment/$d ready" "${want:-?}" "${ready:-0}"
done
job=$($K get job db-migrate -o jsonpath='{.status.succeeded}' 2>/dev/null)
check "job/db-migrate succeeded" "1" "${job:-0}"

echo
echo "== Ingress routing =="
health=$(curl -s -o /dev/null -w '%{http_code}' http://localhost/api/health)
check "GET /api/health" "200" "$health"

spa=$(curl -s -o /dev/null -w '%{http_code}' http://localhost/)
check "GET / (SPA)" "200" "$spa"

deep=$(curl -s -o /dev/null -w '%{http_code}' http://localhost/graph)
check "GET /graph (SPA fallback)" "200" "$deep"

# A 401 proves the request reached the Nest auth guard, i.e. the /api prefix was
# stripped correctly - a routing failure would surface as 404 from nginx.
guarded=$(curl -s -o /dev/null -w '%{http_code}' http://localhost/api/feeds)
check "GET /api/feeds (auth guard reached)" "401" "$guarded"

echo
echo "== Health payload =="
curl -s http://localhost/api/health; echo

echo
echo "== Metrics =="
$K exec deploy/api -- node -e "
fetch('http://localhost:3000/metrics').then(r=>r.text()).then(t=>{
  const keep = l => l.startsWith('http_request_duration_seconds_count')
    || l.startsWith('bullmq_queue_jobs{');
  console.log(t.split('\n').filter(keep).slice(0,6).join('\n'));
});" 2>/dev/null || echo "  (api metrics unavailable)"

$K exec deploy/worker -- node -e "
fetch('http://localhost:9091/healthz').then(r=>r.text())
  .then(t=>console.log('  worker /healthz ->', t));" 2>/dev/null \
  || echo "  (worker healthz unavailable)"

echo
if [ "$fail" -eq 0 ]; then
  echo "All checks passed. UI: http://localhost"
else
  echo "Some checks FAILED (see above)." >&2
fi
exit "$fail"
