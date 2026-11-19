#!/usr/bin/env bash
# Build the independent-review packet for an exact head.
#   packet.sh <worktree> <base-ref> <pr-number> <label> [narrative-file]
set -eu
WT="$1"; BASE="$2"; PR="$3"; LABEL="$4"; NARRATIVE="${5:-}"
OUT="/workspace/.fm-artifacts/review-packet-PR${PR}-${LABEL}.md"
cd "$WT"

HEAD_SHA=$(git rev-parse HEAD)
BASE_SHA=$(git rev-parse "$BASE")
TREE_SHA=$(git rev-parse "HEAD^{tree}")
RESULTS="/tmp/opencode/fm-2026-11-18/gate/${LABEL}"

{
  echo "# Independent review packet — PR #${PR} (head ${LABEL})"
  echo
  echo "- Repository: SureForgeTech/sureforge-fm-data-api"
  echo "- Working checkout: ${WT}"
  echo "- Branch: $(git rev-parse --abbrev-ref HEAD)"
  echo "- Exact head SHA under review: ${HEAD_SHA}"
  echo "- Head tree SHA: ${TREE_SHA}"
  echo "- Base ref: ${BASE} (${BASE_SHA})"
  echo "- Merge base: $(git merge-base HEAD "$BASE")"
  echo "- Commit under review:"
  git log -1 --format='  %H%n  author: %an <%ae>%n  date: %ad%n  subject: %s%n  body:%n%b' HEAD | sed 's/^/  /'
  echo
  echo "## Validation the author ran, and the actual exit status of each step"
  echo
  echo "Gate script: /tmp/opencode/fm-2026-11-18/fm-gate.sh. It runs the repository's declared"
  echo "validation in the same order as .github/workflows/ci.yml job build-test. Exit statuses:"
  echo
  echo '```'
  cat "$RESULTS.summary" 2>/dev/null || echo "(summary not yet written)"
  echo '```'
  echo
  echo "Per-step logs are under $RESULTS."
  echo
  echo "### Note on the sandbox proxy environment"
  echo
  echo "The sandbox exports HTTP_PROXY/HTTPS_PROXY. The extension's TLS/proxy code treats an"
  echo "environment proxy as 'a proxy is configured on this computer' and fails closed, so the"
  echo "outcome of 26 TLS/proxy unit tests that assert on a direct route changes. GitHub-hosted"
  echo "runners have no proxy variables, so the gate unsets the proxy variables for the test"
  echo "steps and keeps it only for the two steps that need the network (npm ci, npm audit) — the"
  echo "sandbox cannot resolve DNS without it. On unmodified main in this same sandbox those"
  echo "26 tests fail with the proxy set and pass with it unset; that was reproduced before any"
  echo "change was made."
  echo
  echo "## Repository rules that bound this change"
  echo
  echo "- AGENTS.md (repo root, read the checked-out copy)."
  echo "- Merge rule: a fresh independent review of the exact head must have zero unresolved P0/P1 findings."
  echo "- Validation gate: npm ci, npm run lint, npm run typecheck, npm run mock:check -w extension,"
  echo "  npm run test:coverage, npm run build, npm test -w designer-ui -w runtime-next, npm run package:check,"
  echo "  plus npm audit --omit=dev --audit-level=high and the VSIX size budget."
  echo "- Synthetic/mock FileMaker data only. Never real customer data or credentials."
  echo "- Preserve exact layout, script and field names; do not trim them."
  echo
  echo "## What this change does"
  echo
  if [ -n "$NARRATIVE" ] && [ -f "$NARRATIVE" ]; then cat "$NARRATIVE"; fi
  echo
  echo "## Complete git-generated diff (${BASE}...HEAD)"
  echo
  echo 'This diff is produced verbatim by git. Every changed path and hunk is included;'
  echo 'nothing is summarized, reformatted or truncated.'
  echo
  echo '```diff'
  git diff --no-color "$BASE"...HEAD
  echo '```'
  echo
  echo "## Commits on the branch (${BASE}..HEAD)"
  echo
  git log --no-color --format='%H %s' "$BASE"..HEAD
} > "$OUT"

echo "$OUT"
wc -l "$OUT"
