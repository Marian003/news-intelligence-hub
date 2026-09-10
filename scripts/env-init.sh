#!/usr/bin/env bash
# Creates a local .env from .env.example, generating strong random values for
# the three secrets that have no default (JWT_SECRET, POSTGRES_PASSWORD,
# BULLBOARD_PASSWORD). Idempotent: an existing .env is left untouched, so
# re-running never clobbers keys you have already pasted in.
#
# .env is git-ignored and is the only place secrets live. LLM API keys are NOT
# generated here - add them by hand after this runs.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo "[env-init] .env already exists - leaving it untouched."
  exit 0
fi

rand() { openssl rand -hex "$1"; }

cp .env.example .env

# Fill in the three required-but-empty secrets, in place.
set_var() {
  # Replace `KEY=` (empty value) with `KEY=<value>`; portable across GNU/BSD sed.
  python - "$1" "$2" <<'PY'
import sys, io
key, value = sys.argv[1], sys.argv[2]
path = ".env"
with io.open(path, encoding="utf-8") as fh:
    lines = fh.readlines()
out = []
for line in lines:
    if line.rstrip("\r\n") == f"{key}=":
        out.append(f"{key}={value}\n")
    else:
        out.append(line)
with io.open(path, "w", encoding="utf-8", newline="\n") as fh:
    fh.writelines(out)
PY
}

set_var JWT_SECRET "$(rand 32)"
set_var POSTGRES_PASSWORD "$(rand 16)"
set_var BULLBOARD_PASSWORD "$(rand 12)"

echo "[env-init] Wrote .env with generated secrets."
echo "[env-init] Add your LLM key by hand: ANTHROPIC_API_KEY= (or OPENAI_API_KEY=)."
