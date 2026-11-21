# Handoff — sureforge-fm-data-api: the usability session

## Goal

The owner asked for a usability analysis of the extension and for it to be made more usable: "too
many commands, I think. There's no out of the box experience or templates to get users productive
within minutes of adding it to VS Code. We need some templates, like event registrations and other
anonymous user type web activities as well as specific use cases for remote regular users. Aim to
replace capabilities the deprecated Claris Studio used to do."

Five pull requests are delivered. The Command Palette is now shortened as well; what is still open is
recorded below.

## What is done, and whether it is tested

| PR | Change | Merge commit | Reviewed head | Review verdict |
| --- | --- | --- | --- | --- |
| #590 | Service Inquiry, Appointment Request and Application starters | `909cdb1` | `de11fe2` | MERGEABLE, no P0/P1/P2 (2 rounds, Kimi K2.8) |
| #591 | `docs/UX_INVENTORY.md` — the entry-point inventory and the proposed primary journey | `32af6cc` | `2da6e48` | MERGEABLE, no P0/P1/P2/P3 (3 rounds, Kimi K2.8) |
| #592 | the prompt drafting parser reads an exclusion that follows the field, and "everything but X" | `e54afbd` | `6f2f992` | MERGEABLE, no P0/P1 (3 rounds, Kimi K2.8) |
| #593 | the FileMaker home names every command, not 34 of 82 | `5d96a11` | `d24d5ad` | MERGEABLE, no P0/P1/P2/P3 (2 rounds, Kimi K2.8) |
| #594 | Build a Portal works on any starter, not only the event registration one | `0c58d7c` | `f2fcdd2` | MERGEABLE, no P0/P1 (3 rounds, Kimi K2.8) |
| #595 | the FileMaker home has a "Find a command" filter | `46c90e5` | `3c3fe79` | MERGEABLE, no P0/P1/P2/P3 (3 rounds, Kimi K2.8) |
| #596 | the Command Palette shows the everyday set only | `3c3a931` | `0eb24c9` | MERGEABLE, no P0/P1/P2 (4 rounds, Kimi K2.8) |

The four merge commits are `5d96a11`, `0c58d7c`, `46c90e5` and `3c3a931`, and each contains exactly the tree its reviewed head had. `main` has since moved on with another session's work (#597, #598); #592 closes issue #573: an exclusion that follows the field now applies to it
("include email, phone excluded" no longer suggests phone), "everything but X" and "all of them but X"
are read as exclusions, and the vocabulary covers "leave out", "leaves out" and "left out". The third
gap of the issue, "Do not require X", already read correctly and is unchanged.

The repository's full twelve-step Node gate passed on every head this session shipped: `npm ci`,
`npm audit --omit=dev --audit-level=high`, lint, the workflow regression tests, the shared build, the
mock contract check, typecheck, `npm run test:coverage`, the build, the designer and runtime tests,
the packaging check and the VSIX size budget. The gate script is `docs/handoff/fm-gate.sh` on
`wip/fm-data-api-home`; it keeps the sandbox proxy for `npm ci` and unsets it for the test steps,
because the extension's TLS code treats a proxy in the environment as "a proxy is configured on this
computer" and the proxy-enforcement tests fail under it.

## What the inventory found, and what it changed

The measurements are in `docs/UX_INVENTORY.md`, each with a recipe. The numbers as they were measured,
and as they are now:

| | before | after |
| --- | --- | --- |
| commands the palette shows on a fresh install | 19 | 13 |
| commands the palette shows with a connection | 58 | 30 |
| commands the palette shows with a connection and the power-user setting | 63 | 63 |
| commands the FileMaker home names | 34 of 82 | 82 of 82 |

The palette with the power-user setting turned on is exactly as it was, so nothing was taken away: the
shortening changes what a new user sees, and the setting brings the rest back. All 82 commands are in
the FileMaker home, which now has a filter, so every capability is one click away by name.

The everyday set is **31 commands**, derived from three things the repository already writes down — the
home's four journeys, the extension README's "Common commands" table and the walkthrough's six steps,
which are 25 — plus **Start Here**, which opens the home, plus the five commands the repository's own
manifest contract test already calls *always available* or *primary*: `Cancel Job`, `Show Jobs`,
`Copy Connection Diagnosis for Bug Report`, `Disconnect` and `List Layouts`. Shortening the palette
must not break a promise the repository already makes.

The other 48 commands now need `filemaker.advanced.powerUserMode`, keeping the condition each one
already had — a profile, enterprise mode, saved snapshots, an initialized project. Three more stay out
of the palette on purpose, because they only work on a sidebar item.

## What is still open

1. **The everyday set is a derivation, not a validation.** `docs/ROADMAP.md` says the primary
   journey's labels must be "validated with representative FileMaker developers before making them
   permanent". That validation has not happened, and this session cannot do it. The set is derived
   from the repository's own documents, which is the best answer available here, and the test derives
   it the same way, so if a document changes the test says so and the manifest must follow.
2. **The packaged-extension journeys no longer exercise the default palette.** They turn the
   power-user setting on, because they run the advanced commands through the Command Palette — 18 of
   them are behind the setting now, and without the setting the smoke journey could not reach
   *Remove Connection Profile*. The rule is covered by the unit tests, but the end-to-end toggle —
   turning the setting off and on and seeing the palette change — is not covered any more. A journey
   that did that would close the gap.
3. **#573 is closed** by #592. Three readings are still open, and the reviewer recorded them:
   - the quantifier rule also fires under a "keep", "save" or "with" head, so "Keep everything but
     phone" leaves the draft empty. The suggested fix was not taken, because it would make that prompt
     suggest phone again; the pull request says why;
   - "all of the fields but phone" is not read as an exclusion, and the trailing exclusion after a
     comma ("include email, phone, excluded") is not read either;
   - "leaving phone out" is not read, because the vocabulary keeps the multiword forms only.
4. **The inventory's proposal 5** — "Give the publish step a name" — is not built. "Publish" does not
   exist as a command, so a user who has built an app and wants to share it has no next step to look
   for. The acceptance is that the journey documents where publishing will live, or says plainly that
   it is not built yet.

## The exact next step

1. **Get the "representative FileMaker developers" validation** the roadmap asks for, of the everyday
   set and of the labels. If it moves a command into or out of the set, the change is a one-liner in
   `extension/package.json` and the matching line in the new test.
2. **Add the journey that toggles the palette**, so the default palette is covered end to end again.
3. Close the three open readings of #573, or fold them into the issue.

## Branch, latest commit, pull request

- This session's branches: `feat/more-starters` (#590), `feat/ux-inventory` (#591),
  `feat/prompt-drafting-exclusions` (#592), `feat/home-complete` (#593), `fix/portal-starters` (#594),
  `feat/home-filter` (#595) and `feat/palette-everyday` (#596). All are pushed and merged.
- The worktrees are `/workspace/sureforge-fm-data-api-wt-starters`, `-wt-ux`, `-wt-portal`, `-wt-home`,
  `-wt-filter` and `-wt-palette`; all hold merged work and can be deleted.
- The main checkout `/workspace/sureforge-fm-data-api` is on `wip/fm-data-api-home`, which also holds
  the handover files.
- Open pull requests after this session: none from this session. #588 and #589 belonged to another
  session and were merged by it.

## Decisions made, and why

- **The everyday set is derived, not invented.** It is the union of three lists the repository
  already writes, plus Start Here, plus the commands the manifest contract already promises, so it
  cannot drift from what the repository tells users to use.
- **The home is the launcher, and the palette is a shortcut to it.** The palette was shortened only
  after the home named every command and gained a filter; the order matters, because moving a command
  out of the palette before the home named it would have removed a capability rather than a duplicate.
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
  deliberate choices to a first sample receipt are still unmeasured. The inventory says so. The
  journey itself runs in CI, and it is how #596's break was found.
- **The Kimi reviewer allowance was exhausted in the earlier session of this repository** and has
  since reset; `kimi-code-plan-cn/kimi-for-coding` worked for every review in this session.
- **The extension's `.github/workflows/codeql.yml` is live at `disabled_manually`** while
  `docs/operations/deployment.md` says the workflow "is enabled". That is a settings change and is
  deliberately not touched.

## Ignored or untracked files that matter

The same list as the earlier handover: `node_modules/` in each workspace, `local-transcription/venv`
for the Python unit tests, `site/node_modules` for the docs site, and the `dist/`, `coverage/` and
`artifacts/` build outputs. All are reproducible from the lockfile, and none carries session work.
