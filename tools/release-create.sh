#!/usr/bin/env bash
# Create the GitHub release for a tag, or complete it when a previous run already published it.
#
# `gh release create` is not idempotent: a job that is cancelled after GitHub published the
# release cannot be rerun, because the server refuses a second release for the same tag and the
# job fails with a duplicate-release error even though the assets are already in place. This
# script is rerun-safe. It publishes the release when it does not exist yet; when it does, it
# checks that the release carries the expected assets and notes, uploads the assets that are
# missing, sets the notes when they are missing, and says exactly what is missing when it cannot
# finish.
#
# Usage: release-create.sh <tag> <notes-file> <asset>...
#
# Environment:
#   GH_CLI  the GitHub CLI to use (default: gh)
#   REPO    the repository as owner/name (default: the repository this script is run from)
#   NODE    the Node binary to use (default: node)
set -euo pipefail

usage() {
  echo "usage: $0 <tag> <notes-file> <asset>..." >&2
  echo "example: $0 v1.9.1 release-notes.md artifacts/extension.vsix" >&2
}

if [ "$#" -lt 3 ]; then
  usage
  exit 2
fi

tag="$1"
notes_file="$2"
shift 2
assets=("$@")

gh_cli="${GH_CLI:-gh}"
repo="${REPO:-}"
node_bin="${NODE:-node}"

if [ ! -s "$notes_file" ]; then
  echo "release-create: no release notes at $notes_file" >&2
  exit 1
fi

for asset in "${assets[@]}"; do
  if [ ! -f "$asset" ]; then
    echo "release-create: asset not found: $asset" >&2
    exit 1
  fi
done

# What the published release carries: one "asset:<name>" line per asset, and one "body:<text>"
# line with its notes. An empty body means the release has no notes yet.
#
# The GitHub CLI reports a release that is not there and a failure the same way: it exits
# non-zero. Only a message that says the release is not there means there is no release. Any
# other failure - an authentication error, a network error, a server error, an answer that cannot
# be read - is a failure to report, not a release to create: treating it as "no release" would
# make the script try to publish a release that is already there.
published() {
  local error_file
  error_file="$(mktemp)"
  if ! "$gh_cli" release view "$tag" ${repo:+--repo "$repo"} --json assets,body >"$error_file.json" 2>"$error_file"; then
    if grep -qiE 'not found|http 404' "$error_file"; then
      rm -f "$error_file" "$error_file.json"
      return 3
    fi
    echo "release-create: cannot read the release $tag:" >&2
    cat "$error_file" >&2
    if [ -s "$error_file.json" ]; then cat "$error_file.json" >&2; fi
    rm -f "$error_file" "$error_file.json"
    return 1
  fi
  rm -f "$error_file"
  # The answer has to be read, and a failure to read it - an answer that is not JSON, or no Node
  # to read it with - is a failure to report, not a release with nothing in it.
  if ! "$node_bin" -e '
let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  const release = JSON.parse(input || "{}");
  for (const asset of release.assets ?? []) console.log("asset:" + asset.name);
  console.log("body:" + String(release.body ?? "").replace(/\n/g, " "));
});
' <"$error_file.json"; then
    echo "release-create: cannot read the release $tag: the answer could not be read" >&2
    rm -f "$error_file.json"
    return 1
  fi
  rm -f "$error_file.json"
}

# The name of an asset path.
asset_name() {
  basename "$1"
}

state=""
status=0
state="$(published)" || status=$?

if [ "$status" = "3" ]; then
  # No release for this tag yet: publish it.
  "$gh_cli" release create "$tag" "${assets[@]}" ${repo:+--repo "$repo"} \
    --title "$tag" --notes-file "$notes_file"
  echo "release-create: published $tag"
  exit 0
fi
if [ "$status" != "0" ]; then
  # The release could not be read, for a reason other than it not being there. The script must not
  # publish in that case: the release may exist, and publishing again is what this script exists
  # to prevent.
  exit "$status"
fi

# A release with no assets, or with no notes, has none of the lines the greps look for, and a grep
# that finds nothing is a failure the script must not treat as one.
published_assets="$(printf '%s\n' "$state" | grep '^asset:' | sed 's/^asset://' || true)"
published_body="$(printf '%s\n' "$state" | grep '^body:' | sed 's/^body://' || true)"

# The assets the release is missing.
missing_paths=()
for asset in "${assets[@]}"; do
  if ! printf '%s\n' "$published_assets" | grep -Fxq "$(asset_name "$asset")"; then
    missing_paths+=("$asset")
  fi
done

if [ "${#missing_paths[@]}" -gt 0 ]; then
  echo "release-create: $tag exists and is missing ${#missing_paths[@]} asset(s): ${missing_paths[*]}" >&2
  "$gh_cli" release upload "$tag" "${missing_paths[@]}" ${repo:+--repo "$repo"} --clobber
fi

if [ -z "$published_body" ]; then
  echo "release-create: $tag exists and has no notes" >&2
  "$gh_cli" release edit "$tag" ${repo:+--repo "$repo"} --notes-file "$notes_file"
fi

# Confirm what the release carries now.
state=""
status=0
state="$(published)" || status=$?
if [ "$status" != "0" ]; then
  echo "release-create: cannot read the release $tag after completing it" >&2
  exit 1
fi
published_assets="$(printf '%s\n' "$state" | grep '^asset:' | sed 's/^asset://' || true)"

for asset in "${assets[@]}"; do
  if ! printf '%s\n' "$published_assets" | grep -Fxq "$(asset_name "$asset")"; then
    echo "release-create: $tag is still missing $(asset_name "$asset")" >&2
    exit 1
  fi
done

echo "release-create: $tag already existed and now carries every expected asset"
exit 0
