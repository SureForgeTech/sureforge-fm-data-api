# UX inventory and proposed primary journey

Prepared 2026-11-20 against `main` at `ab3077a` (extension 1.9.1), and re-measured on 2026-11-21
against `main` at `5b76cea`. This is the inventory the roadmap asks for as "the first bounded task":
what entry points the extension actually has, how many of them a user can see at once, which of them
overlap, and which journey a first-time user should be able to finish without learning the rest.

Every number below is measured from the manifest and the sources, and each one says how to
reproduce it. Four things changed while it was being written, all delivered the same day: the
starter set grew from two to five in pull request #590 (proposal 4 below), the home learned to name
every command in #593 (proposal 1), the home gained a filter in #595 (proposal 2), and the palette
was shortened to the everyday set in #596 (proposal 3). The figures in this revision are the ones
in force at `5b76cea`. A test
(`extension/test/unit/docs/uxInventory.test.ts`) recomputes the sizes and counts this document
states — the manifest's own sizes, the four rows of the visibility table, the everyday set and the
three documents it is written down in — and fails when this document and the code disagree.

Nothing here is a target or a forecast; the proposals at the end are the decisions this inventory is
asking for, and the ones marked **Done the same day** have been delivered since.

## What a new user meets

| Surface | Where it is | What it does |
| --- | --- | --- |
| Extensions view entry | Marketplace listing | The first thing a user reads |
| Sidebar view "FileMaker" | Explorer | Connections, layouts, fields, saved queries and schema snapshots |
| Empty-state view | Explorer, no connections | "Start Here", "Create FM Web App", "Add Connection Profile", "Open Walkthrough" |
| Getting Started walkthrough | Walkthroughs panel | Six steps: web app, connection, connect, query, layout, types |
| FileMaker home | Webview panel | Every command the extension contributes, in journeys and advanced sections, with a filter to narrow them |
| Command Palette | Anywhere | The everyday commands, flattened; the rest sit behind `filemaker.advanced.powerUserMode`, and three stay out of the palette on purpose |
| Status bar | Anywhere | Connection state, AI state, MCP state |
| Chat view | Chat | `@filemaker`, read only |
| Keybindings | Anywhere | Five bindings: query builder, record viewer, script runner, request history, layout mode |

## The measurements

### Commands and settings

The manifest declares **82 commands** and **55 configuration properties**, in one `FileMaker`
command category. To reproduce:

```console
$ node -e "const p=require('./extension/package.json').contributes;console.log(p.commands.length)"
82
$ node -e "const p=require('./extension/package.json').contributes;console.log(p.configuration.flatMap(s=>Object.keys(s.properties)).length)"
55
```

### How many commands are visible at once

The palette shows a command when its `menus.commandPalette` `when` clause is true. A command with no
entry is always visible. Counting the manifest's clauses gives:

| State | Visible commands |
| --- | --- |
| Fresh install, no connection | 13 |
| One connection | 30 |
| One connection and `filemaker.advanced.powerUserMode` | 63 |
| One connection, power-user mode and saved schema snapshots | 66 |

The rows differ in one context key each: a saved connection (`filemaker.hasProfiles`), the
power-user setting (`filemaker.powerUserMode`) and a saved schema snapshot
(`filemaker.hasSchemaSnapshots`). The other keys the manifest uses — `filemaker.enterpriseMode`,
`filemaker.ai.active`, `filemaker.fmWebProjectInitialized` and `filemaker.fmWebPreviewAvailable` —
are counted as off in every row, because none of them is part of a first run. To reproduce the
table, run the test that recomputes it from the manifest:

```console
$ npm test -w extension -- uxInventory
```

Every one of them is a flat `FileMaker: …` entry, apart from three that are hidden from the palette
on purpose (`Copy Layout Name`, `Copy Field Name` and `Refresh Connections` carry `when: false`).
**VS Code cannot group the Command Palette**: its `commandPalette` menu is registered without
submenu support, so a `submenu` on a `commandPalette` entry is refused and dropped. The manifest
registers the palette as a plain list of 69 entries, each with only a `command` and a `when`, so the
levers the extension has are `when` clauses or fewer commands.

### The home names every command

The FileMaker home is the curated launcher, and its own lead text says "Everything else is under
Advanced Tools". Its catalogue names **all 82 commands**: the four journeys, the advanced sections
and the tool sections. When this was measured it named 34 of the 82, and 22 of the rest were
reachable only from the Command Palette. Pull request #593 added the missing entries, each with the
description the User Guide's command table already gives it, and a test checks that every
contributed command is named. To reproduce, compare `contributes.commands` with
`FILEMAKER_HOME_COMMANDS` in `extension/src/webviews/home/catalogue.ts`.

### The home has a filter

`extension/src/webviews/home/ui/main.js` forwards a button's `data-command` to the panel and
narrows the entries as you type. The panel's **Find a command** box hides the entries that do not
mention what was typed, hides the section they sit in when nothing is left in it, says so when
nothing matches, and opens the Advanced Tools disclosure when the match is inside it. Pull request
#595 added it. It is what lets the home hold every command without becoming a wall to scroll.

## Which commands overlap

Grouped by what the user is trying to do. Every command in a group still works; the point is that a
user has to learn which one to reach for.

| Task | Commands that serve it |
| --- | --- |
| Reach the server | Connect, Disconnect, Show Connection Menu, Test My Server, Diagnose Connection, Add/Edit/Remove Connection Profile |
| Read records | Open Record Viewer, List Layouts, Get Record by ID, Open Layout Metadata, Select Layout for Inspector, Refresh Layout Inspector |
| Find records | Open Query Builder, Run Find (JSON), Save Current Query, Run Saved Query, Open Saved Query, Manage Saved Queries, Export/Import Saved Queries, Delete Saved Query, Show Request History |
| Change records | Open Record Editor, Edit Record by ID, Create Record, Delete Record, Upload to Container, Batch Export (Find), Batch Update from CSV/JSON |
| Track the schema | Capture Schema Snapshot, Diff Schema Snapshots, Diff Against Latest Snapshot, Open Schema Snapshot JSON, Refresh Schema Cache |
| Generate code | Generate Types for Layout, Generate Types for All Layouts, Generate Snippets for Layout, Generate TypeScript Client, Open Generated Types Folder, Write AI Context |
| Build a web app | Create FM Web App, Build a Portal, Initialize FM Web Project, Sync FM Web Metadata, Open FM Web Layout Mode, Generate FM Web Next.js App, Generate FM Web Layout Page, Start FM Web Preview Server |
| Compare environments | Create Environment Set, Compare Environments, Diff Layout Across Environments, Export Environment Comparison Report, Open Environment Set JSON |
| Use AI | Set AI Access for Connection, Switch AI Tools Off or On, Start New AI Session, Show AI Activity, Start/Stop AI Server for External Tools, Copy MCP Config |
| Diagnose the extension | Show Diagnostics, Open Diagnostics Dashboard, Show Effective Settings, Show Circuit Breaker Status, Copy Connection Diagnosis, Reload Plugins, List Active Plugins |

## The primary journey the extension should offer

The roadmap's plan is to organise the experience around four tasks: connect a solution, build a
portal or website, preview and test it, and publish or manage it. The extension already has the
first three, in pieces:

1. **Connect** — Add Connection Profile tests the server before saving it, and the password stays in
   the OS keychain. The test is offered by default and the default policy only warns when it was
   skipped; a workspace can make a successful test mandatory with
   `filemaker.connectionWizard.requireTestBeforeSave`. *Present and good.*
2. **Build** — Create FM Web App offers a starter, then where the fields come from (sample fields, a
   FileMaker layout, or a prompt), then a visual editor. *Present; the starter set was two entries
   when this was measured, and is five now.*
3. **Preview and test** — a private browser preview with invented data, or a confirmed FileMaker
   save. *Present.*
4. **Publish or manage** — absent. The preview is private by design and the roadmap lists public
   hosting as separate work.

What is missing is not a capability but a **path**: a new user must choose between "Create FM Web App"
in the README, "Start Here" in the empty state, and 30 palette entries, and there is no way to know
which is the shortest route to a working result.

### Where a first-time user loses the thread

- The starter question comes first and the data question second, but a user who has not yet connected
  to a server cannot answer either confidently; the flow recovers (it offers to add a connection and
  resumes), but the recovery is invisible until it happens.
- The prompt-drafting route and the FileMaker-fields route sit in one list, so a user who wants a
  form for a colleague has to read both options to know which is which.
- The everyday set itself needs a connection: 17 of its 31 commands are gated on
  `filemaker.hasProfiles` and one more needs a saved schema snapshot, so a fresh install shows 13
  of them in the palette. The other 51
  commands are off the everyday palette: 48 of them sit behind `filemaker.advanced.powerUserMode`
  and the rest stay out of the palette on purpose. Nothing was removed. To reproduce: count the
  `menus.commandPalette` entries whose `when` is exactly `filemaker.hasProfiles`.

### What each step of the journey is made of

The roadmap asks the assessment to map the journey onto the code that exists, so the proposals below
are about wiring rather than about new machinery.

| Step | Where it lives |
| --- | --- |
| Connect | `extension/src/services/profileStore.ts` for the saved profiles, `extension/src/services/secretStore.ts` for the keychain, `extension/src/webviews/connectionWizard/` for the wizard that offers to test the server before saving it |
| Build | `shared/src/intake.ts` for the definition and its validation, `shared/src/intake-starters.ts` for the starters, `extension/src/services/fmWebAppModel.ts` for the app model, `extension/src/webviews/fmWebApp/` for the visual editor |
| Preview and test | `extension/src/services/fmWebRuntimeGenerator.ts` for the generated app, `runtime-next/` for the Next.js runtime it generates, `extension/src/services/fmWebPreviewProcess.ts` for the private preview server, `extension/src/services/fmBridgeServer.ts` for the local bridge that writes a confirmed submission to FileMaker |
| Publish or manage | `extension/src/services/fmWebIntakeService.ts` and `extension/src/services/fmWebProjectService.ts` keep the saved app and the project; there is no publishing step |
| The other designer | `designer-ui/` is the Layout Mode canvas, which places fields from a synced layout for an FM Web project. The intake form editor in `extension/src/webviews/fmWebApp/` is a separate, simpler surface. The two authoring screens do not share a renderer: the canvas renders fields with the shared `LayoutContainer` (`shared/src/ui-renderer.tsx`), and the form editor draws its own inputs |

**Packaged-extension constraints.** A VSIX build carries a copy of the runtime and the shared
sources, staged by `extension/scripts/build-fmweb-template.mjs`, so the generated app and the private
preview work without a repository checkout. The extension only replaces a copy it shipped, byte for
byte: the hashes of every shared version it shipped are kept in
`extension/src/services/fmWebRuntimeGenerator.ts`, so changing a shared source changes its hash and
the template test refuses the change until the new hash is recorded and the older ones are kept.
The preview is private. The generated runtime is still gated to it: `runtime-next/proxy.ts` answers
any host other than `127.0.0.1:3000` or `localhost:3000` with "Preview Host is not allowed.", and
both FileMaker write paths — the intake adapter (`runtime-next/lib/filemaker-intake-adapter.ts`) and
the bridge's record routes (`runtime-next/app/api/bridge/[route]/route.ts`) — need the extension's
loopback bridge, that is, a running VS Code window.

## What this extension covers of what Claris Studio did

Claris Studio is the FileMaker development environment: it edits scripts and layouts, changes the
database schema, and runs the solution interactively. The extension deliberately does not replace
FileMaker itself — the roadmap says "FileMaker remains the home of the existing solution, data and
business processes" — but a user who no longer has Studio will look for these capabilities in
whatever tool they do have. Mapped against what this extension actually ships:

| Capability a Studio user had | In this extension | Evidence |
| --- | --- | --- |
| Run a script with parameters and read the result | Yes | Script Runner, `fm_run_script` |
| Browse and change records | Yes | Record Viewer, Record Editor, Create/Edit/Delete Record, Batch Update |
| Find records and export them | Yes | Query Builder, Batch Export, Copy Request as Code |
| See a layout's fields | Partly | Layout Inspector, Layout Metadata, schema snapshots; no layout *design* beyond FM Web Layout Mode |
| Change the database schema | No | The extension reads schema and snapshots it; it does not create or change fields |
| Design a layout | Partly | Layout Mode places fields on a canvas for an FM Web project |
| Debug a solution against a server | Partly | Diagnostics, Request History, Diagnose Connection; no breakpoint debugging |
| Publish a web front end | No | The generated app previews privately; public hosting is separate work |
| Write FileMaker-side automation | Partly | The extension runs existing scripts; it does not author them |

The honest summary: this extension already replaces Studio's **data-side** work — find, read, change,
export, script, inspect — and does not replace its **build-side** work — schema changes, layout
design, authoring scripts, or publishing. The web-app path is the one place where the extension
reaches past the Data API and into what Studio users built by hand.

## Proposals, in the order they can be delivered

Each proposal names the acceptance check that would show it worked. Four of the five were delivered
while this inventory was being written; the fifth is still open.

1. **Make the home the complete launcher.** When this was measured the home named 34 of the 82
   commands, and 22 of the rest were reachable only from the palette. Adding them to the Advanced
   Tools sections costs one list each and removes the split where the crowded surface is also the
   only way to reach a capability.
   *Acceptance:* every contributed command appears in the home catalogue, checked by a test.
   **Done the same day:** pull request #593 added the missing commands, each with the description the
   User Guide's command table already gives it, and a test now checks that every contributed command
   is named.
2. **Give the home a filter.** When this was measured the home had no search, so it could not hold
   every one of the 82 commands.
   *Acceptance:* a filter box hides non-matching entries; the panel still runs only allowlisted
   commands.
   **Done the same day:** the home gained a **Find a command** box that hides the entries that do not
   match what was typed, and the section they sit in when nothing is left in it.
3. **Shorten the palette to the everyday set.** With a connection the palette listed 58 flat
   entries when this was measured, and now lists 30. The everyday set is already written down in
   three places in the repository — the home's four journeys, the extension README's "Common
   commands" table and the walkthrough's six steps — and is 25 commands. The rest stay available in
   the home and in the palette when `filemaker.advanced.powerUserMode` is on, so no capability is
   removed, only moved.
   *Acceptance:* a connected user sees the everyday set in the palette; the rest are behind the
   existing power-user setting; every command still runs.
   **Done the same day:** the palette now shows 31 everyday commands — the 25 from those three
   documents, plus **Start Here**, which opens the home, plus the five the User Guide's command table
   already marks as always available or always shown, or as shown with a profile: **Cancel Job**,
   **Show Jobs**, **Copy Connection Diagnosis for Bug Report**, **Disconnect** and **List Layouts**.
   The other 48 sit behind `filemaker.advanced.powerUserMode`, and three more stay out of the palette
   on purpose because they only work on a sidebar item. A test derives the everyday set from the
   same three documents and checks the rule, so the set cannot drift away from the documents it comes
   from.
4. **Grow the starter set.** The wizard offered two starters when this was measured. The roadmap's
   first phase names "service inquiries, applications and appointment requests" as the next expansion,
   and those are the web activities a FileMaker solution is asked for most often. **Done the same
   day:** pull request #590 added Service Inquiry, Appointment Request and Application.
   *Acceptance:* each starter is entirely synthetic, opens the visual editor and previews without a
   connection.
5. **Give the publish step a name.** "Publish" does not exist as a command, so a user who has built
   an app and wants to share it has no next step to look for.
   *Acceptance:* the journey documents where publishing will live, or says plainly that it is not
   built yet.
   **Done:** the journey now says where publishing lives: there is no publish command, the preview is
   private, and **Export app scaffold** hands the user the app's source to host themselves. The
   roadmap's guided deployment path for one supported server runtime is where publishing will live,
   and it is separate work. See "Where publishing lives" in `docs/PORTAL_BUILDER_JOURNEY.md`.

## What this inventory did not verify

- The elapsed time and deliberate choices to a first sample receipt, which the roadmap asks for. The
  harness records both, for every journey: a measurement — how long the journey took, and which
  commands were run and which options were picked — goes to `measurements.json` and to a
  **Measurements** section of `report.md`, and every step's duration goes to `report.json`. **The path
  to a first sample receipt is a journey now** (`j17-first-sample-receipt.mjs`): it chooses a starter
  and the invented data, starts the preview, submits the form and reads the receipt. The path has
  **five deliberate choices** — the starter, where the fields come from, the workspace folder, the
  save-and-preview action, and the submission in the browser — and the journey records them among the
  commands that were run and the options that were picked, which the harness records as well; the
  submission is recorded only when the form really is submitted. The preview's own start, which
  installs the shipped template, is a separate cost, which is how the tracker asks for it to be
  recorded. The measurement is produced where the desktop suite runs, so the number is in that run's
  artefact rather than here. The journey reads the preview's private launch link from the preview's own
  folder, so it does not need a browser to reach the form; when
  the browser the preview opened redeemed that one-time link first, the journey records that rather
  than submitting. To reproduce the measurement: run the harness, and read `measurements.json` in
  the run's artefact.
- Whether representative FileMaker developers agree with the everyday set. The set in proposal 3 is
  derived from documents this repository already writes, not from watching users.
- Claris Studio's current feature list. The capability map above is written from what this extension
  ships and from the FileMaker development environment as generally understood to cover; it was not
  checked against Claris's own documentation, which was not reachable here. It was tried again on
  2026-11-22, on two egress paths — the shell and the fetch tool — and both were refused by this
  sandbox's allowlist, so the Claris side of each row is still unchecked. What each row would need
  is one Claris Studio documentation page that says the capability exists; the nine rows are, in
  order: running a script with parameters; browsing and changing records; finding and exporting
  records; seeing a layout's fields; changing the database schema; designing a layout; debugging a
  solution against a server; publishing a web front end; and writing FileMaker-side automation.
- Whether the 13 commands visible on a fresh install are the right 13. They are the everyday
  commands that need no connection, which is a proxy for "always useful", not a decision anybody
  made.
