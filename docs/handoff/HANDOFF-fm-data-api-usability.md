# Handoff — sureforge-fm-data-api: the usability session

## Goal

The owner asked for a usability analysis of the extension and for it to be made more usable: "too
many commands, I think. There's no out of the box experience or templates to get users productive
within minutes of adding it to VS Code. We need some templates, like event registrations and other
anonymous user type web activities as well as specific use cases for remote regular users. Aim to
replace capabilities the deprecated Claris Studio used to do."

Two items are delivered. The third, the Command Palette itself, is **not** built, and the reason is
recorded below.

## What is done, and whether it is tested

| PR | Change | Merge commit | Reviewed head | Review verdict |
| --- | --- | --- | --- | --- |
| #590 | Service Inquiry, Appointment Request and Application starters | `909cdb1` | `de11fe2` | MERGEABLE, no P0/P1/P2 (2 rounds, Kimi K2.8) |
| #591 | `docs/UX_INVENTORY.md` — the entry-point inventory and the proposed primary journey | `32af6cc` | `2da6e48` | MERGEABLE, no P0/P1/P2/P3 (3 rounds, Kimi K2.8) |
| #592 | the prompt drafting parser reads an exclusion that follows the field, and "everything but X" | `e54afbd` | `6f2f992` | MERGEABLE, no P0/P1 (3 rounds, Kimi K2.8) |

`main` is `e54afbd`. #592 closes issue #573: an exclusion that follows the field now applies to it
("include email, phone excluded" no longer suggests phone), "everything but X" and "all of them but X"
are read as exclusions, and the vocabulary covers "leave out", "leaves out" and "left out". The third
gap of the issue, "Do not require X", already read correctly and is unchanged. The repository's full twelve-step Node gate passed on every head this session
shipped: `npm ci`, `npm audit --omit=dev --audit-level=high`, lint, the workflow regression tests, the
shared build, the mock contract check, typecheck, `npm run test:coverage` (5,980 passed, 21 skipped),
the build, the designer and runtime tests, the packaging check and the VSIX size budget. The
gate script is `docs/handoff/fm-gate.sh` on `wip/fm-data-api-home`; it keeps the sandbox proxy for
`npm ci` and unsets it for the test steps, because the extension's TLS code treats a proxy in the
environment as "a proxy is configured on this computer" and the proxy-enforcement tests fail under it.

## What the inventory found, and what it changed

The measurements are in `docs/UX_INVENTORY.md`, each with a recipe:

- **82 commands** and **54 configuration properties** are declared in the manifest.
- The Command Palette shows **19** commands on a fresh install, **58** once a connection exists, **63**
  with `filemaker.advanced.powerUserMode` and **66** with saved schema snapshots. Every entry is flat,
  and **VS Code cannot group that menu** — it is registered with `supportsSubmenus: false`, so the
  only levers are `when` clauses or fewer commands.
- The FileMaker home, the curated launcher, names **34 of the 82**. Of the other 48, 26 are reachable
  from the sidebar's context menus, its title buttons or a keybinding, 3 are hidden from the palette
  on purpose, and **22 are reachable only from the Command Palette**.
- The everyday set is derived from three things the repository already writes down — the home's four
  journeys, the extension README's "Common commands" table and the walkthrough's six steps — which is
  **25 commands**.

The document proposes five changes in delivery order, each with the acceptance check that would show
it worked. It also maps the journey onto the code it is made of, and states what the extension does
and does not replace of what the FileMaker development environment did.

## What is half-done, and why

**The Command Palette is not shortened yet, on purpose.** The inventory's proposal 3 would cut a
connected user's palette from 58 commands to about 26 by moving the non-everyday commands behind the
existing `filemaker.advanced.powerUserMode` setting. Three things have to be true first, and the third
is not true:

1. The home panel must name every command (it names 34 of 82), or 18 of the commands that would move
   would have no surface at all — the cure would remove a capability rather than a duplicate.
2. The home panel needs a filter before it can hold 82 entries; `extension/src/webviews/home/ui/main.js`
   is eleven lines and has no search.
3. `docs/ROADMAP.md` says the primary journey's labels must be "validated with representative
   FileMaker developers before making them permanent". That validation has not happened, and this
   session cannot do it.

The everyday set to use is ready-made: the union of the home's journeys, the README's common table
and the walkthrough's steps. The guide's command table (`extension/docs/USER_GUIDE.md`) already gives
every command a one-line description and its visibility, so the home's catalogue and the palette's
`when` clauses can both be built from it.

## The exact next step

1. **Ask the owner which of the inventory's five proposals to build**, and get the "representative
   FileMaker developers" validation the roadmap asks for before the palette changes. The analysis is
   the deliverable that makes that decision possible.
2. If the palette work is authorised, do it as: the home names every command (from the guide's table),
   the home gains a filter, the non-everyday commands move behind `filemaker.advanced.powerUserMode`,
   the guide's visibility column follows, and a test pins the contract — every contributed command is
   named in the home, every command outside the everyday set is behind the lever, and the everyday set
   covers the home's journeys, the README's common table and the walkthrough.
3. **#573 is closed** by #592. Three readings are still open, and the reviewer recorded them:
   - the quantifier rule also fires under a "keep", "save" or "with" head, so "Keep everything but
     phone" leaves the draft empty. The suggested fix was not taken, because it would make that prompt
     suggest phone again; the pull request says why;
   - "all of the fields but phone" is not read as an exclusion, and the trailing exclusion after a
     comma ("include email, phone, excluded") is not read either;
   - "leaving phone out" is not read, because the vocabulary keeps the multiword forms only.

## Branch, latest commit, pull request

- This session's branches: `feat/more-starters` (merged as #590) and `feat/ux-inventory` (merged as
  #591). Both are pushed and merged.
- The worktrees are `/workspace/sureforge-fm-data-api-wt-starters` and
  `/workspace/sureforge-fm-data-api-wt-ux`; both hold merged work and can be deleted.
- Open pull requests after this session: **#588** and **#589**, both from another session. They are
  behind `main` now and need a base merge; #589's `build-test` and both cross-platform jobs were
  failing before this session's merges. They are not this session's work.

## Decisions made, and why

- **The everyday set is derived, not invented.** It is the union of three lists the repository
  already writes, so it cannot drift from what the repository tells users to use.
- **The starters are additive.** The existing two keep their identifiers, their order in the wizard's
  quick pick, their copy and their file names, so a saved app still opens on the starter it was built
  from. A starter's id names its saved app, its file and its preview route, so a new id is a new app.
- **Every shared-source change records a new hash and keeps the old ones.** The runtime template
  ships a copy of the shared sources and only replaces a copy it shipped byte for byte, so the
  template test refuses the change until `SHIPPED_SHARED_HASHES` in
  `extension/src/services/fmWebRuntimeGenerator.ts` carries the new hash.
- **The inventory's numbers are stated as measurements with recipes, not as conclusions.** The first
  review found that the document overclaimed its own evidence — 48 commands are not "reachable only
  from the palette" — and the numbers were corrected rather than defended.

## Blockers

- **The packaged-VSIX browser journey cannot run in this sandbox.** The e2e-ui harness downloads VS
  Code from `update.code.visualstudio.com`, which does not resolve here, so the elapsed time and the
  deliberate choices to a first sample receipt are still unmeasured. The inventory says so.
- **The Kimi reviewer allowance was exhausted in the earlier session of this repository** and has
  since reset; `kimi-code-plan-cn/kimi-for-coding` worked for every review in this session.

## Ignored or untracked files that matter

The same list as the earlier handover: `node_modules/` in each workspace, `local-transcription/venv`
for the Python unit tests, `site/node_modules` for the docs site, and the `dist/`, `coverage/` and
`artifacts/` build outputs. All are reproducible from the lockfile, and none carries session work.
