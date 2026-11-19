#!/usr/bin/env bash
# Full repository validation gate, in CI (.github/workflows/ci.yml) order.
#
# Sandbox network model:
#   * Outbound DNS/HTTP only works through the sandbox proxy (http://192.168.5.2:18090);
#     a direct connection fails with getaddrinfo EAI_AGAIN.
#   * The extension's TLS/proxy code treats the presence of HTTPS_PROXY as
#     "a proxy is configured on this computer" and changes 26 TLS/proxy unit
#     test outcomes that assert on a direct route. GitHub-hosted runners have
#     no proxy, so the test steps must run with the proxy variables unset.
#   => Network steps keep the proxy; every test/verify step unsets it.
set -u
cd "$1" || exit 99

LOG=/workspace/.fm-artifacts/gate-$(basename "$1").log
RESULTS=/workspace/.fm-artifacts/gate-$(basename "$1").results
: > "$LOG"
: > "$RESULTS"

# Steps that may use the network: keep the sandbox proxy as-is.
net_step() {
  local label="$1"; shift
  echo "=== $label ===" >> "$LOG"
  "$@" >> "$LOG" 2>&1
  local code=$?
  echo "EXIT[$label]=$code" >> "$RESULTS"
  echo "EXIT[$label]=$code"
}

# Steps that must observe a direct route: unset every proxy variable.
step() {
  local label="$1"; shift
  echo "=== $label ===" >> "$LOG"
  env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
      -u http_proxy -u https_proxy -u all_proxy \
      -u NO_PROXY -u no_proxy \
      "$@" >> "$LOG" 2>&1
  local code=$?
  echo "EXIT[$label]=$code" >> "$RESULTS"
  echo "EXIT[$label]=$code"
}

net_step "npm-ci"            npm ci
net_step "audit"             npm audit --omit=dev --audit-level=high
step   "lint"               npm run lint
step   "ci-workflow-tests"  node --test .github/tests/ci.test.mjs
step   "script-tests"       node --test scripts/*.test.mjs
step   "build-shared"       npm run build -w shared
step   "mock-check"         npm run mock:check -w extension
step   "typecheck"          npm run typecheck
step   "test-coverage"      npm run test:coverage
step   "build"              npm run build
step   "test-designer-runtime" npm test -w designer-ui -w runtime-next
step   "package-check"      npm run package:check

# VSIX size budget (CI step "Enforce VSIX size budget")
VSIX_BUDGET_BYTES=3145728
VSIX_PATH="$(echo artifacts/*.vsix)"
if [ ! -f "$VSIX_PATH" ]; then
  echo "EXIT[vsix-size-budget]=1 (no VSIX found in artifacts/)" >> "$RESULTS"
  echo "EXIT[vsix-size-budget]=1 (no VSIX found in artifacts/)"
else
  ACTUAL=$(wc -c < "$VSIX_PATH" | tr -d ' ')
  echo "VSIX $VSIX_PATH = $ACTUAL bytes (budget $VSIX_BUDGET_BYTES)" >> "$LOG"
  if [ "$ACTUAL" -gt "$VSIX_BUDGET_BYTES" ]; then
    echo "EXIT[vsix-size-budget]=1 ($ACTUAL > $VSIX_BUDGET_BYTES)" >> "$RESULTS"
    echo "EXIT[vsix-size-budget]=1 ($ACTUAL > $VSIX_BUDGET_BYTES)"
  else
    echo "EXIT[vsix-size-budget]=0 ($ACTUAL bytes)" >> "$RESULTS"
    echo "EXIT[vsix-size-budget]=0 ($ACTUAL bytes)"
  fi
fi

echo "=== GATE SUMMARY ==="
cat "$RESULTS"
