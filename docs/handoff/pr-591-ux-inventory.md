## Summary

Adds the entry-point inventory and the proposed primary journey that `docs/ROADMAP.md` names as the
first bounded task: "inventory the actual user-facing entry points, identify overlap, propose the
primary first-portal journey and map it to existing designer/runtime/bridge code and packaged-extension
constraints".

It is a document only — no code, no manifest and no test changes.

## What it measures

- **82 commands and 54 configuration properties** are declared in the manifest.
- The Command Palette shows **19** commands on a fresh install, **58** once a connection exists, **63**
  with `filemaker.advanced.powerUserMode` and **66** with saved schema snapshots. Every entry is flat,
  and VS Code cannot group that menu: it is registered with `supportsSubmenus: false`, so the only
  levers are `when` clauses or fewer commands.
- The FileMaker home, the curated launcher, names **34 of the 82** commands. Of the other 48, 26 are
  reachable from the sidebar's context menus, its title buttons or a keybinding, 3 are hidden from the
  palette on purpose, and **22 are reachable only from the Command Palette**.
- The home has no search, so it cannot simply become "everything" without a filter.
- Which commands overlap, grouped by the task a user is trying to do: ten groups, from reaching the
  server to diagnosing the extension.

## What it proposes

Five changes in delivery order, each with the acceptance check that would show it worked: make the
home the complete launcher, give it a filter, shorten the palette to the everyday set, grow the starter
set, and give the publish step a name. The everyday set is not an invented list — it is the union of
three things the repository already writes down: the home's four journeys, the extension README's
"Common commands" table and the walkthrough's six steps. That is 25 commands.

It also maps the journey onto the code it is made of (the connection services and wizard, the shared
intake contract and the form editor, the runtime generator, the Next.js runtime, the preview process
and the local bridge, plus the Layout Mode canvas as the other designer), and states the
packaged-extension constraint: a VSIX carries a copy of the shared sources, and the extension only
replaces a copy it shipped byte for byte.

## Why

The extension grew to 82 commands without a record of which of them a user meets at once. The roadmap
says that adding capability is not sufficient if it adds navigation, setup choices or concepts a user
must learn before reaching a useful result, and that the inventory is the first bounded task. The
extension also already replaces the data-side of what the FileMaker development environment did —
find, read, change, export, script, inspect — and does not replace its build-side work. The document
says so plainly, so a user who no longer has Studio can see what is and is not there.

## How it was tested

This is a document, so there is no test to add. Every number in it was measured from the manifest and
the sources at `ab3077a`, and each says how to reproduce it. An independent review recomputed all of
them, checked the VS Code citation against the VS Code source, checked that the allowlist cannot be
widened by a webview message, and checked that the code paths named in the journey table exist and do
what the table says.

The review also caught the document overstating its own evidence: it claimed 48 commands were
reachable only from the Command Palette, when 26 of them are reachable from the sidebar or a keybinding
and 3 are hidden from the palette on purpose. The figure is now 22, and the recipe says how to arrive
at it. The review's other findings — that the wizard offers to test the server rather than requiring
it, that the "Common commands" table is in the extension README, and that one figure had no recipe —
are fixed too.

The repository's own gate passes on this head: `npm run lint`, `npm run typecheck` and
`npm run test:coverage` (5,980 tests, 21 skipped) all exit 0.

## Review

Two independent fresh-context review rounds with Kimi K2.8, each round re-deriving the answer rather
than inheriting the previous one's conclusions.

- Round 1: **NOT MERGEABLE** — one P1, the "reachable only from the Command Palette" claim, and three
  P3s.
- Round 2: **MERGEABLE** — no P0, no P1, no P2, and three P3 precision findings, all fixed.

## What this does not do

It removes no command and rewrites no UI; the roadmap forbids that during the assessment. It does not
measure the elapsed time to a first sample receipt — the packaged-extension browser journey cannot run
in the sandbox, because the e2e harness downloads VS Code from a host that does not resolve here — and
it does not check the everyday set with representative developers, which is why that set is derived
from documents the repository already writes rather than from observation.
