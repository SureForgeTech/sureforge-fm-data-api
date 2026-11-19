#!/usr/bin/env bash
# Build the independent-review packet for an exact head.
#   packet.sh <worktree> <base-ref> <pr-number>
set -eu
WT="$1"; BASE="$2"; PR="$3"
OUT=/workspace/.fm-artifacts/review-packet-PR${PR}.md
cd "$WT"

HEAD_SHA=$(git rev-parse HEAD)
BASE_SHA=$(git rev-parse "$BASE")
TREE_SHA=$(git rev-parse "HEAD^{tree}")

{
  echo "# Independent review packet — PR #${PR}"
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
  echo "Gate script: /workspace/.fm-artifacts/gate.sh. Exit statuses:"
  echo
  echo '```'
  cat "/workspace/.fm-artifacts/gate-$(basename "${WT}").results" 2>/dev/null || echo "(gate still running)"
  echo '```'
  echo
  echo "Full output: /workspace/.fm-artifacts/gate-$(basename "${WT}").log"
  echo
  echo "### Note on the sandbox proxy environment"
  echo
  echo "The sandbox exports HTTP_PROXY/HTTPS_PROXY. The extension's TLS/proxy code treats an"
  echo "environment proxy as 'a proxy is configured on this computer', which changes the"
  echo "outcome of 26 TLS/proxy unit tests that assert on a direct route. GitHub-hosted"
  echo "runners have no proxy, so the gate unsets the proxy variables for every test step"
  echo "and keeps it only for the two steps that need the network (npm ci, npm audit) — the"
  echo "sandbox cannot resolve DNS without it. On unmodified main in this same sandbox those"
  echo "26 tests fail with the proxy set and pass with it unset; that was reproduced before"
  echo "any change was made."
  echo
  echo "## Acceptance criteria (from the pull request)"
  echo
  gh pr view "$PR" --repo SureForgeTech/sureforge-fm-data-api --json body --jq '.body' 2>/dev/null \
    | sed -n '/## Acceptance criteria mirror/,/## Test plan/p' || true
  echo
  echo "## Repository rules that bound this change"
  echo
  echo "- AGENTS.md (repo root, read the checked-out copy)."
  echo "- Merge rule: a fresh independent review of the exact head must have zero unresolved P0/P1 findings."
  echo "- Validation gate: npm ci, npm run lint, npm run typecheck, npm run mock:check -w extension,"
  echo "  npm run test:coverage, npm run build, npm test -w designer-ui -w runtime-next, npm run package:check,"
  echo "  plus npm audit --omit=dev --audit-level=high and the VSIX size budget."
  echo "- Synthetic/mock FileMaker data only. Never real customer data or credentials."
  echo
  echo "## What this branch changes, and what the previous review round changed"
  echo
  echo "This branch adds prompt-based FileMaker form drafting: a new module parses a free-text"
  echo "prompt and suggests which writable layout fields the user meant; the create wizard gains a"
  echo "'draft' source that shows the prompt, pre-picks the suggestions and opens the visual editor."
  echo
  echo "A previous independent review of this branch (at 8ef606a148a3c30b46bcef6d815f822454bf20c3,"
  echo "before the merge of main and before the fix below) returned four findings. The tip commit"
  echo "here fixes them. Your review must judge the CURRENT head, independently:"
  echo
  echo "  F1 (was P1) A bare 'not' was not read as an exclusion. 'Include email but not phone.'"
  echo "       suggested phone. Fix: 'not' is now a negation directive."
  echo "  F2 (was P1) A coordinated item inherited the polarity of the item before it rather than"
  echo "       the list head. 'Include email, don't include phone, and notes.' dropped notes"
  echo "       entirely — neither suggested nor reported. Fix: a coordinated item now inherits the"
  echo "       polarity of the list head."
  echo "  F3 (was P2) An unterminated quote split the clause and dropped the instruction before it."
  echo "       Fix: the closing quote is optional in the clause pattern."
  echo "  F4 (was P3) An empty field selection returned silently instead of surfacing the"
  echo "       'Choose between 1 and 100 writable, nonglobal fields.' error. Fix: restored."
  echo
  echo "The fix also makes 'not required' read as optional and 'not optional' as required, because"
  echo "the previous qualifier read 'required' out of 'not required' and marked the field required."
  echo
  echo "### Behaviour decisions the author made, which you should check against the code"
  echo
  echo "1. A coordinated item inherits the LIST HEAD's polarity, so these two differ by design:"
  echo "   - \"Don't include phone, notes.\"  -> phone and notes are both excluded, because the head"
  echo "     of the list is the negated 'Don't include phone' and 'notes' is its coordinated object."
  echo "   - \"Include email, don't include phone, and notes.\" -> email and notes are suggested and"
  echo "     phone is excluded, because 'and notes' coordinates with the head 'Include email'."
  echo "   This matches the branch's existing test 'scopes exclusions to their own fields'. Check"
  echo "   that the code implements exactly this rule and that no third case breaks it."
  echo "2. 'not required' / 'not optional' are read as a requirement, never as an exclusion."
  echo
  echo "### Differential evidence the author produced"
  echo
  echo "The author diffed the old and new parser over a corpus of prompts and layouts. The file"
  echo "/workspace/.fm-artifacts/differential.txt lists every difference between the parser before"
  echo "the fix and the parser after it. Read it. Every listed difference should be one of the"
  echo "intended changes above. If you find a difference that is NOT intended, that is a finding."
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
  echo
  echo "## The fix commit on its own (the previous review's findings)"
  echo
  echo '```diff'
  git diff --no-color 04a7402e0917c568f2623620b76bd49c23b97199..HEAD
  echo '```'
} > "$OUT"

echo "$OUT"
wc -l "$OUT"
