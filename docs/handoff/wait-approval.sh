#!/usr/bin/env bash
# Poll for the reviewer app's approval on a pull request.
#   wait-approval.sh <repo> <pr-number> <head-sha> [max-minutes]
set -u
REPO="$1"; PR="$2"; HEAD="$3"; MAX="${4:-60}"
for i in $(seq 1 $((MAX * 6))); do
  TOK=$(cat /var/lib/opencode-github/github.token)
  OUT=$(GH_TOKEN="$TOK" gh api "repos/SureForgeTech/$REPO/pulls/$PR/reviews" \
        --jq ".[] | select(.user.login==\"abd-oss-lane-reviewer[bot]\") | \"\(.state) \(.commit_id)\"" 2>/dev/null | tail -3)
  if [ -n "$OUT" ]; then
    echo "APPROVAL FOUND after $((i / 6)) min: $OUT"
    exit 0
  fi
  if [ $((i % 6)) -eq 0 ]; then echo "still waiting ($((i / 6)) min)..."; fi
  sleep 10
done
echo "TIMEOUT after ${MAX} min"
exit 1
