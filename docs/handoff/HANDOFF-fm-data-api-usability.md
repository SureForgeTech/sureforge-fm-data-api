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
| #599 | the prompt parser reads three more ways of leaving a field out | `fcdf02e` | `759a291` | MERGEABLE, no P0/P1/P2/P3 (3 rounds, Kimi K2.8) |
| #602 | the form editor can go back to the invented data | `e42d641` | `d1a48e9` | MERGEABLE, no P0/P1/P2 (3 rounds, Kimi K2.8) |
| #609 | the packaged journey expects what the VSIX ships | `fa6914b` | `d9e152e` | MERGEABLE, no P0/P1/P2 (5 rounds, MiniMax M3) |
| #613 | `filemaker.dateFormats` — the developer chooses how the server reads and writes dates | `8a05890` | `0b81b21` | MERGEABLE, no P0/P1/P2/P3 (4 rounds, MiniMax M3) |
| #617 | a journey that measures the path to a first sample receipt | `fcdf02e` | `a24deb0` | MERGEABLE, no P0/P1 (6 rounds, MiniMax M3) |
| #621 | the desktop journeys expect what the product does | `3aae6b5` | `66dea41` | MERGEABLE, no P0/P1/P2 (3 rounds, Kimi K2.8) |
| #623 | the batch import takes the file's shape, and says the date order | `18e6ebf` | `5402ef0` | MERGEABLE, no P0/P1/P2 (10 rounds, Kimi K2.8) |
| #627 | the generated client can carry the record version with an edit | `6105b67` | `1d7272e` | MERGEABLE, no P0/P1/P2/P3 (5 rounds, Kimi K2.8 then MiniMax M3) |

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
3. **#573's three readings are closed** by #599: "all of the fields but phone", the trailing
   exclusion after a comma ("include email, phone, excluded") and "leaving phone out" are read now.
   The deferred reading stays deferred on purpose and is now pinned by a case: the quantifier rule
   fires under a "keep" head too, so "Keep everything but phone" still leaves the draft empty. The
   suggested fix was not taken, because it would make that prompt suggest phone again.
4. **The inventory's proposal 5** — "Give the publish step a name" — is not built. "Publish" does not
   exist as a command, so a user who has built an app and wants to share it has no next step to look
   for. The acceptance is that the journey documents where publishing will live, or says plainly that
   it is not built yet.
5. **The desktop journey has not run since the VSIX began to carry the FM Web runtime template**
   (2026-11-17). The journey asserted the opposite of the product for that week, and nothing caught
   it; #609 corrects it and adds a local test that pins the fact. Its new expectations have not yet
   been observed to pass in CI either — the weekly `e2e-ui` job is the first run that will.
6. **The web-app commands sit behind the power-user setting.** "Generate FM Web Next.js App", "Start FM
   Web Preview Server" and "Open FM Web Layout Mode" are not in the everyday set, because none of the
   three documents the derivation reads names them. The home carries all three, one click away. If the
   palette should keep them, that is one line in the everyday set and one in the test.
7. **The failure-mode catalogue's AD10 row is still only partly fixed.** The packaging half is done,
   and #627 gives the generated client the `modId` option on an edit, so a write cannot overwrite a
   record that changed since it was read. What is left is the session, script and container calls in
   the generated client, and the row says so.
8. **AD09's import half is closed by #623.** #613 fixed the client's side — the server now reads and
   writes dates in the order the developer chose — and #623 makes the import say which order that is
   beside the mode choice and in the dry-run preview, and reads a JSONL or semicolon-delimited file
   when the developer says so. The row's next step is now "keep the date format beside the import
   preview as the setting changes".
9. **The desktop journey suite cannot be run from here.** The token the forge uses for this session
   is refused for a workflow dispatch (`HTTP 403: Resource not accessible by integration`), and the
   sandbox cannot download VS Code, so the weekly `e2e-ui` job is the only thing that runs the full
   desktop suite. It last ran on 2026-11-16, before the VSIX began to carry the FM Web runtime
   template, so neither #609's corrected journey nor #617's new one has been observed to pass.
10. **#617's journey is the first to start the private preview**, so the strict weekly job now
   installs the shipped template's dependencies from npm: it needs the network and minutes it did not
   need before. That is the change the roadmap's measured baseline needs, and it is also a new way
   for that job to fail.

## The exact next step

1. **Get the "representative FileMaker developers" validation** the roadmap asks for, of the everyday
   set and of the labels. If it moves a command into or out of the set, the change is a one-liner in
   `extension/package.json` and the matching line in the new test.
2. **Add the journey that toggles the palette**, so the default palette is covered end to end again.
3. **Add the session, script and container calls to the generated client** — what is left of AD10's row
   now that #627 gave it the `modId` option.
4. **Run the desktop suite.** #621 made the journeys honest against the code and pinned the facts they
   rest on, but no journey has executed since 2026-11-16: the weekly `e2e-ui` job is the only runner.

## Branch, latest commit, pull request

- This session's branches: `feat/more-starters` (#590), `feat/ux-inventory` (#591),
  `feat/prompt-drafting-exclusions` (#592), `feat/home-complete` (#593), `fix/portal-starters` (#594),
  `feat/home-filter` (#595), `feat/palette-everyday` (#596), `fix/prompt-exclusion-readings` (#599),
  `feat/fmweb-sample-source` (#602), `fix/journey-preview-availability` (#609), `feat/date-formats`
  (#613), `feat/first-sample-receipt` (#617), `fix/journey-expectations` (#621),
  `feat/batch-import-formats` (#623) and `feat/typegen-modid` (#627). All are pushed. #609, #617 and
  #621 were merged by another session's account after it merged `main` into the branch.
- The worktrees are `/workspace/sureforge-fm-data-api-wt-starters`, `-wt-ux`, `-wt-parser`, `-wt-invented`,
  `-wt-journey`, `-wt-dates` and `-wt-receipt`; all hold merged work and can be deleted.
- The main checkout `/workspace/sureforge-fm-data-api` is on `wip/fm-data-api-home`, which also holds
  the handover files.
- Open pull requests after this session: none from this session. #588 and #589 belonged to another
  session and were merged by it.
- The worktrees for this batch are `/workspace/sureforge-fm-data-api-wt-journeys` (#621),
  `-wt-import` (#623) and `-wt-modid` (#627).

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
  Code from `update.code.visualstudio.com`, which does not resolve here. A workflow dispatch is refused
  as well (`HTTP 403: Resource not accessible by integration`), so the suite can only be started by the
  owner or by the weekly schedule. #617 adds the journey that measures the path to a first sample
  receipt, but the figure itself comes from a run of the desktop suite, so it is still unmeasured
  until that job runs. The
  journey itself runs in CI, and it is how #596's break was found.
- **The Kimi reviewer allowance ran out during the earlier batch, came back, and ran out again.**
  `kimi-code-plan-cn/kimi-for-coding` worked for the reviews of #599 and #602 and then returned "You've
  reached your 5-hour usage limit". The reviews of #609 were done with `minimax-coding-plan/MiniMax-M3`
  in a fresh context, which the session rules accept as an independent review. The reviews of #621 and
  #623 are on Kimi K2.8; Kimi's allowance ran out again during #623's last rounds, so #627's last two
  rounds are on MiniMax M3. No review in this batch found a P0 or a P1.
- **The forge's API credential was unavailable for about half of this session.** `/usr/local/bin/gh`
  returned "Sandbox GitHub credential is unavailable. See oss-lane check." and "HTTP 401: Bad
  credentials" for every API read, while `git push` and `git ls-remote` kept working. The CI watcher
  failed 43 times in a row on that credential alone. It recovered on its own; the work was done while
  it was down.
- **The extension's `.github/workflows/codeql.yml` is live at `disabled_manually`** while
  `docs/operations/deployment.md` says the workflow "is enabled". That is a settings change and is
  deliberately not touched.

## Ignored or untracked files that matter

The same list as the earlier handover: `node_modules/` in each workspace, `local-transcription/venv`
for the Python unit tests, `site/node_modules` for the docs site, and the `dist/`, `coverage/` and
`artifacts/` build outputs. All are reproducible from the lockfile, and none carries session work.

## The follow-up batch: the plan's tasks 1-3 (2026-11-22, later the same day)

Built from the plan this session produced: the generated client's script calls (AD10's script
half), its session calls (AD10's session half) and the palette-toggle journey.

| PR | What | Merge commit | Reviewed head | Review |
| --- | --- | --- | --- | --- |
| #631 | the generated client can open and close its own session | `82cbfc4` | `9aabae6` | MERGEABLE, no P0/P1/P2 (1 round, Kimi K2.8; two P3s accepted by design) |
| #630 | the generated client can run a FileMaker script | `5513c51` | `6d918cb` | MERGEABLE, no P0/P1 (2 rounds + merge-head round, Kimi K2.8; merged tree byte-identical to the reviewed head) |
| #632 | a journey for the Command Palette's two sides | `fcbdf42` | `26f0e9e` (the merged head `6e71c8b3` is that work plus a base merge, this session verified byte-identical for the branch's own files) | MERGEABLE, no P0/P1 (4 rounds, Kimi K2.8; the first found one P2, fixed) |
| #633 | one copy of each changelog entry | `0f0c529` | `3f711e2` | MERGEABLE, no P0/P1/P2/P3 (1 round, Kimi K2.8) |

Checkpoint at the time of writing:

```text
Status — Done
Work — The plan's tasks 1-3 are built, independently reviewed and merged: the generated client runs scripts (#630) and manages its own session (#631), and the desktop suite has the palette-toggle journey (#632); #633 repaired two changelog entries #632's base merge duplicated.
Delivery — SureForgeTech/sureforge-fm-data-api · main @ 0f0c529 · #631 merged 82cbfc4 (reviewed 9aabae6) · #630 merged 5513c51 (reviewed 6d918cb) · #632 merged fcbdf42 (branch files verified byte-identical to reviewed 26f0e9e) · #633 merged 0f0c529 (reviewed 3f711e2)
Checks — The twelve-step gate exits 0 on every head; 66 generated-client tests green together; 11/11 journey-expectation pins green; changelogStructure 17/17; required checks green on each merged head
Review — #631: 9aabae6 P0=0 P1=0 · #630: 6d918cb P0=0 P1=0 · #632: four rounds, final d3bb7fe P0=0 P1=0 · #633: 3f711e2 P0=0 P1=0
Next — None for this batch. Open for the owner: AD10's remaining container calls (wait on AD05's download design), a desktop run of the new journey via the weekly e2e-ui job, and the items recorded above
```

Notes for whoever reads this next:

- **Both generated-client tasks came out of one catalogue row.** AD10's row now says only the
  container calls are missing, and its next step names them. The container half should wait for
  AD05's design decision ("one authenticated download action with a save destination").
- **The two generator features shared template regions** (the README paragraphs, the helper
  block, the per-layout methods tail). The merge kept both; a fresh review is checking that
  neither was lost or duplicated. Any future change to `typeGenService.ts` should expect the
  same overlap and re-run the generated-client suites together.
- **The palette journey cannot run here** (no display, no VS Code download), same as every
  journey since 2026-11-16. Its facts are pinned in `journeyFacts.mjs` and held against the
  manifest by `e2eJourneyExpectations.test.ts`; the first real run is the weekly `e2e-ui` job.
