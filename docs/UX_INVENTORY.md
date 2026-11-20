# UX inventory and proposed primary journey

Prepared 2026-11-20 against `main` at `ab3077a` (extension 1.9.1). This is the inventory the roadmap
asks for as "the first bounded task": what entry points the extension actually has, how many of them
a user can see at once, which of them overlap, and which journey a first-time user should be able to
finish without learning the rest.

Every number below is measured from the manifest and the sources at that revision, and each one says
how to reproduce it. Nothing here is a target or a forecast; the proposals at the end are the
decisions this inventory is asking for.

## What a new user meets

| Surface | Where it is | What it does |
| --- | --- | --- |
| Extensions view entry | Marketplace listing | The first thing a user reads |
| Sidebar view "FileMaker" | Explorer | Connections, layouts, fields, saved queries and schema snapshots |
| Empty-state view | Explorer, no connections | "Start Here", "Create FM Web App", "Add Connection Profile", "Open Walkthrough" |
| Getting Started walkthrough | Walkthroughs panel | Six steps: web app, connection, connect, query, layout, types |
| FileMaker home | Webview panel | Four journeys and an "Advanced Tools" disclosure |
| Command Palette | Anywhere | Every command the extension contributes, flattened |
| Status bar | Anywhere | Connection state, AI state, MCP state |
| Chat view | Chat | `@filemaker`, read only |
| Keybindings | Anywhere | Five bindings: query builder, record viewer, script runner, request history, layout mode |

## The measurements

### Commands and settings

The manifest declares **82 commands** and **54 configuration properties**, in one `FileMaker`
command category. To reproduce:

```console
$ node -e "const p=require('./extension/package.json').contributes;console.log(p.commands.length)"
82
$ node -e "const p=require('./extension/package.json').contributes;console.log(p.configuration.flatMap(s=>Object.keys(s.properties)).length)"
54
```

### How many commands are visible at once

The palette shows a command when its `menus.commandPalette` `when` clause is true. A command with no
entry is always visible. Counting the manifest's clauses gives:

| State | Visible commands |
| --- | --- |
| Fresh install, no connection | 19 |
| One connection | 58 |
| One connection and `filemaker.advanced.powerUserMode` | 63 |
| One connection, power-user mode and saved schema snapshots | 66 |

Every one of them is a flat `FileMaker: …` entry. **VS Code cannot group the Command Palette**: the
menu is registered with `supportsSubmenus: false`, so a `submenu` on a `commandPalette` entry is
dropped. The only levers are `when` clauses or fewer commands.

### The home panel does not cover what it claims to

The FileMaker home is the curated launcher, and its own lead text says "Everything else is under
Advanced Tools". Its catalogue names **34 of the 82 commands**. The other **48 are reachable only
from the Command Palette** — the overloaded surface is also the only way to reach 48 capabilities.
To reproduce, compare `contributes.commands` with the `command:` values in
`extension/src/webviews/home/catalogue.ts`.

### The home has no search

`extension/src/webviews/home/ui/main.js` is eleven lines: it forwards a button's `data-command` to
the panel. There is no filter, so the panel can only be scanned or scrolled. That is why the home
cannot simply become "everything": at 80 entries it would be a wall.

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
   the OS keychain. *Present and good.*
2. **Build** — Create FM Web App offers a starter, then where the fields come from (sample fields, a
   FileMaker layout, or a prompt), then a visual editor. *Present; the starter set is two entries.*
3. **Preview and test** — a private browser preview with invented data, or a confirmed FileMaker
   save. *Present.*
4. **Publish or manage** — absent. The preview is private by design and the roadmap lists public
   hosting as separate work.

What is missing is not a capability but a **path**: a new user must choose between "Create FM Web App"
in the README, "Start Here" in the empty state, and 58 palette entries, and there is no way to know
which is the shortest route to a working result.

### Where a first-time user loses the thread

- The starter question comes first and the data question second, but a user who has not yet connected
  to a server cannot answer either confidently; the flow recovers (it offers to add a connection and
  resumes), but the recovery is invisible until it happens.
- The prompt-drafting route and the FileMaker-fields route sit in one list, so a user who wants a
  form for a colleague has to read both options to know which is which.
- Sixty per cent of the commands are only meaningful once a connection exists, but the palette shows
  them on the same flat list as the four that matter on day one.

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

Each proposal names the acceptance check that would show it worked. None of them is authorised yet.

1. **Make the home the complete launcher.** The home names 34 of 82 commands; the other 48 are
   palette-only. Adding them to the Advanced Tools sections costs one list each and removes the
   split where the crowded surface is also the only way to reach a capability.
   *Acceptance:* every contributed command appears in the home catalogue, checked by a test.
2. **Give the home a filter.** The home has no search, so it cannot hold 80 entries.
   *Acceptance:* a filter box hides non-matching entries; the panel still runs only allowlisted
   commands.
3. **Shorten the palette to the everyday set.** With a connection the palette lists 58 flat entries.
   The everyday set is already written down twice in the repository — the home's four journeys, the
   README's "Common commands" table, and the walkthrough's six steps — and is 25 commands. The rest
   stay available in the home and in the palette when `filemaker.advanced.powerUserMode` is on, so no
   capability is removed, only moved.
   *Acceptance:* a connected user sees the everyday set in the palette; the rest are behind the
   existing power-user setting; every command still runs.
4. **Grow the starter set.** The wizard offers two starters. The roadmap's first phase names
   "service inquiries, applications and appointment requests" as the next expansion, and those are the
   web activities a FileMaker solution is asked for most often.
   *Acceptance:* each starter is entirely synthetic, opens the visual editor and previews without a
   connection.
5. **Give the publish step a name.** "Publish" does not exist as a command, so a user who has built
   an app and wants to share it has no next step to look for.
   *Acceptance:* the journey documents where publishing will live, or says plainly that it is not
   built yet.

## What this inventory did not verify

- The elapsed time and deliberate choices to a first sample receipt, which the roadmap asks for. The
  packaged-extension browser journey cannot run in this sandbox: the e2e-ui harness downloads VS Code
  from `update.code.visualstudio.com`, and that host does not resolve here.
- Whether representative FileMaker developers agree with the everyday set. The set in proposal 3 is
  derived from three documents this repository already writes, not from watching users.
- Claris Studio's current feature list. The capability map above is written from what this extension
  ships and what the FileMaker development environment is generally understood to cover; it was not
  checked against Claris's own documentation, which was not reachable here.
- Whether the 19 commands visible on a fresh install are the right 19. They are the ones with no
  `when` clause, which is a proxy for "always useful", not a decision anybody made.
