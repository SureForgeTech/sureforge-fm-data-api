# HANDOFF — sureforge-fm-data-api: landing the pending PRs and adding the FileMaker home

## Goal

Finish the two pull requests that were open on `SureForgeTech/sureforge-fm-data-api`
(#567 prompt-based form drafting, #569 the mock FileMaker lost-receipt test) and build the
next feature the owner asked for: a FileMaker home that leads a first-time user to
Build a Web App, Connect and Test, Browse Data and Help.

## What is done, and whether it is tested

All three pull requests are merged and verified. Nothing is left half-finished in the
repository.

| PR | Reviewed head | Merge commit | Verification |
| --- | --- | --- | --- |
| #567 prompt-based form drafting | `a6f5f8752e268eb880dd94d12d6527fa56e2fbef` | `882d2884f617ca58a2d07755df4db550f9e6dd37` | merged tree byte-identical to the reviewed head; five independent review rounds on the exact head |
| #569 mock lost-receipt test | `76b738d531d3f6622d617f7d5edbde2a6ea9a1ba` | `162e35a4ed788c6994a353978c9c1d1f3474d554` | merged tree byte-identical to the reviewed head; the branch was refreshed with the new `main` by a merge commit, both changelog entries and the direct and proxy tests survived |
| #579 FileMaker home (this session's new work) | `69588ab977822377161faa9545d3bb92b3f8dd58` | `9b2b845511c1509af036277e3df87986f65537e3` | merged tree byte-identical to the reviewed head; six independent review rounds, the last with no P0/P1/P2/P3 |

`main` is `9b2b845` and is green on `build-test`, `e2e-ui-smoke`, both cross-platform jobs,
`build`, CodeQL, the documentation build and the deploy. Issues #566, #568 and #578 are
closed. There are **zero open pull requests**.

Testing: the repository's full Node 22 gate (`build-test` order — `npm ci`,
`npm audit --omit=dev --audit-level=high`, lint, the workflow regression tests, the
rotation parser tests, `npm run build -w shared`, `npm run mock:check -w extension`,
typecheck, `npm run test:coverage`, `npm run build`, `npm test -w designer-ui -w runtime-next`,
`npm run package:check` and the VSIX size budget) passed on every head this session
shipped. The exit statuses and the full output are in `docs/handoff/gate-*.results`
and `docs/handoff/gate-*.log` on the `wip/fm-data-api-home` branch (the #567 and #569
runs are in `wip-session-records/` on the same branch, committed earlier in the
session).

## What is half-done

Nothing in the repository. The next features named by the owner were **not started**:
the Cursor/VS Code AI host integration, the responses grid, the searchable directory, the
dashboard and the work tracker (issue #574 lists them). The packaged-VSIX browser
measurement is blocked, not unfinished — see "Blockers".

## The exact next step

Nothing is mid-edit, so the next step is a fresh task, not a continuation of a file. The
next unit of work is the AI host integration (issue #574, "Keep AI drafting optional…"):
a shared draft schema plus a mapping validator used by both a VS Code language-model tool
and the local MCP shim, so an assistant proposes fields, the extension checks the exact
names against the selected layout, flags missing or ambiguous mappings, and opens a draft
for review — with no live writes from a draft.

Start it from `main` (`9b2b845`) in a fresh linked worktree, per `AGENTS.md`.

## Branch, latest commit, pull request

- Branch: `wip/fm-data-api-home` (this session's preservation branch; nothing on it is
  intended to merge)
- Latest commit: see `git log -1 wip/fm-data-api-home`
- Open pull requests: none
- The delivered work is on `main` at `9b2b845` (PR #579 merged), plus `882d288` (#567) and
  `162e35a` (#569)

## Decisions made, and why

- **The Command Palette cannot group commands.** VS Code registers that menu with
  `supportsSubmenus: false` (`src/vs/workbench/services/actions/common/menusExtensionPoint.ts`,
  at tag `1.96.0` and on `main`), so a `submenu` property on a `menus.commandPalette`
  entry is dropped. The first attempt at #579 used palette submenus and an independent
  review rejected it with that evidence; the home is a panel instead.
- **The home is an allowlisted launcher, not a second command surface.** The page can ask
  only for a command the authored catalogue names, `executeCommand` is called with the
  command id alone so the page cannot pass arguments, and every catalogue value that
  reaches the HTML is escaped.
- **The home uses the shared screen stylesheet and the shared `--muted` token.** A review
  found the home dimming its secondary text with `opacity`, which measured 3.5–3.9:1 in the
  Light+ theme against the repository's own 4.5:1 bar. The theme audit now measures the
  home's text too.
- **The branch was never force-pushed.** The ruleset is strict (the branch must be up to
  date with `main`), so `main` was merged into the branch, and the branch was pushed as a
  fast-forward.
- **No approving review of its own.** The organisation ruleset now has
  `required_approving_review_count` 0, so #579 merged on a clean independent review, green
  required checks and resolved threads. The verdict was posted on the pull request in the
  `review-verdict: <sha> P0=0 P1=0` form the reviewer app reads.
- **The gate keeps the sandbox proxy for `npm ci` and `npm audit` and unsets it for every
  test step.** The sandbox cannot resolve DNS without the proxy, but the extension's
  TLS code treats a proxy in the environment as "a proxy is configured on this computer",
  which fails 26 TLS/proxy tests that assert a direct route. GitHub-hosted runners have no
  proxy variables. This was reproduced on unmodified `main` before any change.

## Blockers

- **The packaged-VSIX browser journey cannot run in this sandbox** (issue #575). The
  e2e-ui harness downloads VS Code from `update.code.visualstudio.com`; DNS for that host
  does not resolve here and the proxy resets the connection, so the harness cannot start.
  Exact symptom: `curl -s -o /dev/null -w "%{http_code}" https://update.code.visualstudio.com/api/releases/stable`
  returns `000` (exit 56, connection reset). The elapsed time, the deliberate choices and
  the cold dependency setup are therefore still unmeasured. Fixing it needs a machine that
  can reach that host.
- **The reviewer providers ran out during the session.** Kimi reported
  `You've reached your 5-hour usage limit. Your quota will reset when the current 5-hour window ends.`,
  the OpenCode Go pool reported `OpenCode Go usage limit reached (5-hour, resets in 13m).`
  and later `Model access is disabled.`, and the OpenCode free tier reported
  `Free usage limit reached.`. Reviews continued on the session's own provider
  (`minimax-coding-plan/MiniMax-M3.1-Flash`), which is a fresh context and counts under
  the delivery rules; two rounds ran on `opencode-go/grok-4.7` while that pool was still
  available. No paid endpoint and no other account was used.

## Ignored or untracked files that matter

From `git status --ignored --short` in `/workspace/sureforge-fm-data-api` (the state as
recorded before this preservation branch was created):

```
!! designer-ui/coverage/
!! designer-ui/node_modules/
!! extension/.mock-check/
!! extension/node_modules/
!! node_modules/
!! runtime-next/coverage/
!! runtime-next/node_modules/
!! shared/coverage/
!! shared/dist/
!! shared/node_modules/
```

All of them are build output or installed dependencies — reproducible from the lockfile
(`npm ci`) and the build scripts, and none of them carries session work. `npm ci` in the
root plus `npm run build -w shared` restores `shared/dist/`, which the extension's
typecheck needs; `extension/.mock-check/` is the mock contract check's scratch output.

There are no untracked files and no stashes:

```
=== git status ===
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean

=== git stash list ===
(empty)

=== git worktree list ===
/workspace/sureforge-fm-data-api  9b2b845 [main]
```

The session's own out-of-repository material (the gate and packet scripts, the gate logs,
the review packets given to each reviewer, the parser differential harnesses, the scratch
review harnesses and a copy of the operator-local run record) is preserved on the
`wip/fm-data-api-home` branch under `wip-artifacts/`, because a rebuild that restores the
repository from GitHub would otherwise lose it. The unredacted run record also remains at
`/workspace/sureforge-fm-data-api-session-record.md` on the sandbox; the copy on the branch
redacts the two host paths that say where credentials are served.

## Local branches left in place (all pushed, all merged)

`codex/prompt-form-draft` (a6f5f87), `codex/mock-registration-lost-receipt` (76b738d),
`feat/first-run-wizard` (e7740ea), `fix/prompt-trailing-requirement-scope` (17a0e50),
`fix/starter-neutral-preview-wording` (a093967). The squash merges mean these local
commits are not ancestors of `main`, so `git branch -d` rightly refuses to remove them.
