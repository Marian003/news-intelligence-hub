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


# The SPA's API base URL is baked into the bundle at build time. curl against
# the Ingress cannot catch a wrong one (curl never executes the JS), so assert
# on the bundle itself: it must call the relative /api, and must contain
# neither the dev fallback nor an MSYS-mangled Windows path.
echo
echo "== SPA bundle base URL =="
bundle_path=$(curl -s http://localhost/ | grep -o '/assets/index-[^"]*\.js' | head -1)
if [ -z "$bundle_path" ]; then
  echo "  FAIL  could not find the bundle in index.html"
  fail=1
else
  bundle=$(curl -s "http://localhost${bundle_path}")
  if printf '%s' "$bundle" | grep -q 'Program Files'; then
    echo "  FAIL  bundle contains an MSYS-mangled path (rebuild with MSYS_NO_PATHCONV=1)"
    fail=1
  else
    echo "  PASS  no MSYS-mangled path in $bundle_path"
  fi
  if printf '%s' "$bundle" | grep -q 'localhost:3000'; then
    echo "  FAIL  bundle contains the dev fallback http://localhost:3000"
    fail=1
  else
    echo "  PASS  no dev fallback baked into the bundle"
  fi
fi

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
