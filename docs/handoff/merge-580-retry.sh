#!/usr/bin/env bash
# Squash-merges PR #580 as soon as it has an eligible approving review and green checks.
# The merge API still refuses without the approval; this only retries, it does not bypass.
set -uo pipefail
export GH_TOKEN="$(tr -d '\n' < /var/lib/opencode-github/github.token)"
REPO=SureForgeTech/sureforge-fm-data-api
for attempt in $(seq 1 "${1:-1}"); do
  state=$(gh api "repos/$REPO/pulls/580" --jq '"\(.state) \(.mergeable_state) \(.reviewDecision) head=\(.head.sha[0:8])"' 2>&1 | head -1)
  out=$(gh api --method PUT "repos/$REPO/pulls/580/merge" --input /tmp/opencode/fm-2026-11-18/merge-580.json --jq '"\(.merged) \(.sha)"' 2>&1 | head -3)
  echo "attempt $attempt: [$state] -> $out"
  case "$out" in true*) echo "MERGED"; exit 0;; esac
  [ "$attempt" = "${1:-1}" ] && break
  sleep 60
done
echo "not merged"
