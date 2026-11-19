#!/usr/bin/env bash
# Baseline validation gate for sureforge-fm-data-api.
# Order mirrors .github/workflows/ci.yml job build-test exactly (incl. build -w shared).
# NOTE: the sandbox exports HTTP_PROXY/HTTPS_PROXY; the extension's TLS code treats a
# configured proxy as "a proxy is configured on this computer" and fails closed, so the
# test steps unset them, as the hosted runners have no proxy. npm ci and npm audit keep
# them, because the sandbox cannot resolve DNS without them.
# Usage: fm-gate.sh <worktree-dir> <label>
set -u
PROXY_ENV=()
for v in HTTP_PROXY HTTPS_PROXY http_proxy https_proxy; do
  [ -n "${!v:-}" ] && PROXY_ENV+=("$v=${!v}")
done
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy
WT="${1:-/workspace/sureforge-fm-data-api-wt-setup}"
LABEL="${2:-setup}"
cd "$WT" || exit 99

LOGDIR="/tmp/opencode/fm-2026-11-18/gate/$LABEL"
mkdir -p "$LOGDIR"

run_step() {
  local name="$1"; shift
  local start end rc
  echo "=== STEP[$LABEL]: $name ==="
  start=$(date +%s)
  "$@" >"$LOGDIR/$name.log" 2>&1
  rc=$?
  end=$(date +%s)
  echo "--- exit=$rc duration=$((end-start))s log=$LOGDIR/$name.log"
  tail -6 "$LOGDIR/$name.log"
  echo "--- end[$LABEL] $name"
  return 0
}

run_step "01-scripts-test" node --test scripts/*.test.mjs
run_step "02-audit" env "${PROXY_ENV[@]}" npm audit --omit=dev --audit-level=high
run_step "03-lint" npm run lint
run_step "04-ci-test" node --test .github/tests/ci.test.mjs
run_step "05-build-shared" npm run build -w shared
run_step "06-mock-check" npm run mock:check -w extension
run_step "07-typecheck" npm run typecheck
run_step "08-test-coverage" npm run test:coverage
run_step "09-build" npm run build
run_step "10-designer-runtime-test" npm test -w designer-ui -w runtime-next
run_step "11-package-check" npm run package:check
vsix_budget() {
  local vsix actual
  vsix=$(ls -1 artifacts/*.vsix 2>/dev/null | head -1)
  if [ -z "$vsix" ]; then echo "NO VSIX FOUND"; return 1; fi
  actual=$(stat -c %s "$vsix")
  echo "VSIX size: $actual bytes ($vsix); budget 3145728"
  [ "$actual" -le 3145728 ]
}
run_step "12-vsix-size-budget" vsix_budget

echo "=== ALL STEPS DONE[$LABEL] ==="
