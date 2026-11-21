# Use cases and templates: what the extension gives a FileMaker developer on the first day

Prepared 2026-11-20 against `main` at `3c3a931` (extension 1.9.1). This is the companion to
[`docs/UX_INVENTORY.md`](./UX_INVENTORY.md): that document counts the entry points and proposes the
primary journey, and it maps the extension against Claris Studio as a whole. **This document covers
the part that is still open**: which web activities a FileMaker developer can build today, which
templates exist for them, what is missing for the two audiences that matter, and what the smallest
next steps are.

Every number below is measured from the sources at `3c3a931` and says how to reproduce it. The
proposals at the end are the decisions this document is asking for; one of them was delivered the
same day, and is marked as such.

The comparison with Claris Studio is inherited from `docs/UX_INVENTORY.md`, which states that it
"was not checked against Claris's own documentation, which was not reachable here". The same
disclosure applies here.

## The two questions behind this

1. **"There are too many commands."** — measured and answered in `docs/UX_INVENTORY.md`: 82 commands
   are declared, and the FileMaker home now names every one of them and has a filter box to find
   them (pull requests #593 and #595). The palette itself was shortened to the everyday set the
   same day (pull request #596): a connected user now sees 30 entries instead of 58 (31 once a
   schema snapshot is saved). The rest of the palette sits behind
   `filemaker.advanced.powerUserMode`, and three commands stay out of the palette on purpose.
   ```console
   $ node -e "const p=require('./extension/package.json').contributes;const m=new Map(p.menus.commandPalette.map(e=>[e.command,e.when]));const always=p.commands.filter(c=>!m.has(c.command));const withProfile=p.menus.commandPalette.filter(e=>e.when==='filemaker.hasProfiles');console.log(always.length+withProfile.length)"
   30
   ```
   One of that document's five proposals is still open: giving the publish step a name. This
   document does not repeat that work.
2. **"There is no out-of-the-box experience, and no templates that get a user productive within
   minutes."** — this document. The short answer: the *form* half of that now exists, and the
   *audience* half does not.

## What a new user can do today, in order

| Step | What it is | Where it lives | First result |
| --- | --- | --- | --- |
| 1. Add a connection | The wizard offers to test the server before saving it (the default policy warns rather than blocks); the password stays in the OS keychain | `extension/src/webviews/connectionWizard/` | one form |
| 2. Pick a starter | Five starters, each a complete form with invented data | `shared/src/intake-starters.ts` | one click |
| 3. Edit the form | Title, description, submit and success text, branding, and each field's label, type, help text, required rule, maximum length and choices — without editing JSON | `extension/src/webviews/fmWebApp/` | one screen |
| 4. Preview it | A private browser preview with invented data; no FileMaker server, no credentials | `extension/src/services/fmWebPreviewProcess.ts` | each preview copies the bundled template into a fresh folder, installs its dependencies from npm and starts a local server, so it waits on the network |
| 5. Save to FileMaker | A native confirmation names the connection, server host, database, layout and fields; **Enable FileMaker saves** makes the preview write real records | `extension/src/commands/fmWebProject.ts`; the write path is `extension/src/services/fmWebRegistrationService.ts` | one confirmation |
| 6. Publish it for the public | **Not available.** The preview is private by design and there is no publishing step | — | — |

**Steps 2 to 4 need no connection at all**: "Try sample fields" starts immediately with invented data,
and the wizard offers to add a connection and resumes when one exists. Step 5 needs a saved
connection, because it is the step that writes real records.

Reproduce the starter list (each starter is one `schemaVersion: 1, id: '…'` definition):

```console
$ grep -n "schemaVersion: 1, id:" shared/src/intake-starters.ts
36:    schemaVersion: 1, id: 'event-registration', environmentId: 'sample',
57:    schemaVersion: 1, id: 'feedback-request', environmentId: 'sample',
78:    schemaVersion: 1, id: 'service-inquiry', environmentId: 'sample',
99:    schemaVersion: 1, id: 'appointment-request', environmentId: 'sample',
121:    schemaVersion: 1, id: 'application', environmentId: 'sample',
```

The five starters are **Event Registration**, **Feedback or Request Form**, **Service Inquiry**,
**Appointment Request** and **Application**. Each one is entirely synthetic: its own fields, its own
copy, and it opens in the visual editor and previews with invented data, so a developer can see a
working form before they have a server.

## What a starter is, and what it is not

A starter is an `IntakeDefinition` (`shared/src/intake.ts`): a title, a description, a submit label, a
success message, branding, and a **flat list of fields**. The generated app is one page
(`runtime-next/app/intake/[id]`) with one form and one submit, and the bridge
(`runtime-next/app/api/bridge/[route]/route.ts`) offers `find`, `getRecord`, `editRecord`,
`createRecord`, `deleteRecord` and `runScript`.

So the shape every starter has today is:

> **one anonymous visitor, one page, one submit, one record** — a real FileMaker record once
> FileMaker saves are enabled, and an invented receipt before that.

That shape covers a large part of what people build, and it is the shape Claris Studio's "Publish to
Web" users built by hand for simple forms. It does not cover the rest.

## The use cases, by audience and shape

Two audiences, and the second one is the gap.

### Audience 1: an anonymous visitor (someone who has never used the solution)

This is what the starters serve, and it is well covered for the single-page form.

| Activity | Covered today | Notes |
| --- | --- | --- |
| Register for an event | **Yes** — Event Registration | The canonical case: a name, an email, a choice, a note |
| Send feedback or a request | **Yes** — Feedback or Request Form | The general-purpose one |
| Ask for a service | **Yes** — Service Inquiry | The choice carries the kind of request |
| Book an appointment | **Yes** — Appointment Request | The date and time are fields, not scheduling |
| Apply for something | **Yes** — Application | |
| A contact page with only a name and an email | No starter, but the same machinery | The starters differ in their fields and wording, not in machinery. Note that a starter is the app's identity: choosing the same starter again reopens that app rather than making a second one |
| A multi-step form (attendee, then payment, then a T-shirt size) | **No** | The definition has a flat field list; there is no page or step concept. The roadmap places multi-step forms in phase 1, capability 5 |
| A form with a file upload (a CV, a photo) | **No** | The field kinds are text, email, number, date, textarea and select |
| A public list or directory of records | **No** | The generated app is a form, not a browsing app |
| A confirmation email after submitting | **No** | The bridge writes the record and nothing else. The roadmap places acknowledgment emails in phase 1, capability 5 |
| Taking a payment | **No** | Deliberately: the roadmap places payment in phase 2 |

### Audience 2: a remote user who signs in (a colleague, a customer, a portal user)

This is the audience the user's question names, and **nothing in the extension serves it today**.

| Activity | Covered today | What it would need |
| --- | --- | --- |
| A user signs in and sees only their own records | **No** | A user session the extension does not have: the runtime adds one shared token (`X-FM-Bridge-Token`) on the server side and the bridge writes with the developer's own FileMaker account, so every request is the developer's account. The browser never holds that token — it is authenticated by the preview session cookie |
| A user edits a record they own | **No** | The same, plus an ownership rule the extension cannot enforce |
| A staff member sees a queue of requests | **No** | The same, plus a list page and a status field |

The reason is structural and deliberate, not an oversight. The preview is private and the bridge holds
the FileMaker credentials, which are the right properties for a developer's own tool. But the
generated app is not publishable as it stands: `runtime-next/proxy.ts` answers `403 Preview Host is
not allowed.` for any host other than `127.0.0.1:3000` or `localhost:3000`, and both FileMaker
write paths — the intake adapter (`runtime-next/lib/filemaker-intake-adapter.ts`) and the bridge's
record routes (`runtime-next/app/api/bridge/[route]/route.ts`) — need the extension's loopback
bridge, that is, a running VS Code window. The repository says the same: "The localhost
bridge is a developer preview service, not a public backend" (`docs/PORTAL_BUILDER_JOURNEY.md`) and
"The preview remains private and local; it is not a published FileMaker backend"
(`extension/docs/USER_GUIDE.md`). The roadmap makes it a requirement rather than a property: "A
public website must not depend on a running VS Code window or the local development bridge"
(`docs/ROADMAP.md`).

A signed-in user is therefore a **publishing** problem, not a template problem. The roadmap places
hosting and deployment in phase 1, capability 4, and customer authentication with per-customer
authorisation in phase 3.

**Consequence for planning:** "a use case for remote regular users" is not a template that can be
added to `shared/src/intake-starters.ts`. It is a different product: a hosted app with its own
sign-in, its own data boundary and its own deployment. A starter added today would either promise
something the extension cannot keep (per-user data) or quietly be an anonymous form with a
different name.

## What Claris Studio did that this still does not

`docs/UX_INVENTORY.md` maps the whole of Studio. The web half of that map is what a developer who
lost Studio will look for:

| What Studio could do | In this extension | The honest gap |
| --- | --- | --- |
| Design a layout and publish it as a web page | Layout Mode places fields on a canvas for an FM Web project; the intake editor edits a form | Two different authoring screens: the form editor hand-renders its inputs and the canvas does not. The generated pages share one renderer (`LayoutContainer`) |
| Publish a form to the web for anonymous visitors | The generated app previews privately and writes real records through the extension | No hosting step, and the exported runtime is still gated to the local preview: publishing needs a server-side FileMaker adapter and a public host gate, not just a web host |
| Publish a data-driven page (a list, a detail page) | Not in the intake path; the Layout Mode canvas can place a related-record list | Not in the intake path |
| Let site visitors sign in | Not at all | Needs a hosted app with its own session (roadmap phase 3) |
| Send an email on submit, take a payment | Not at all | Acknowledgment emails are phase 1 capability 5; payment is phase 2 |

The pattern: **this extension has replaced the *authoring* of Data API work and the *form* half of
web publishing; it has not replaced the *hosting*, the *sign-in* or the *multi-page* half.** The
first two are roadmap products that need their own decisions; the third is a definition change this
extension could make.

## The proposals, smallest first

Each names the check that would show it worked. The one marked **Done the same day** was
delivered; the rest are the decisions this document is asking for.

1. **Let a developer go back to invented data.** A developer who picked a starter, then "Use
   FileMaker fields", has no way back to the invented-data preview: the editor's source switch offers
   only "Choose FileMaker fields" and "Draft form from a prompt", and the **Create FM Web App**
   command's own data-source picker — "Try sample fields", "Use FileMaker fields", "Draft form
   from a prompt" — is skipped once the app is saved. Everything else about this path already works:
   the starter's copy is kept while the real field names are used
   (`extension/src/services/fmWebAppModel.ts`), and the editor shows the real name beside each field.
   *Acceptance:* a developer with a connection picks a starter, uses their own fields, and can
   switch back to the invented-data preview without starting over; the saved app is unchanged until
   they save it.
   *Size:* small. It touches the source switch in the form editor and the app's source state.
2. **A multi-step starter.** The definition has a flat field list, so a two-page form needs a page
   concept in `shared/src/intake.ts`, a page switch in the generated app, and a test that a
   submission still writes one record. The intake definition pins its schema version and has no
   migration of its own yet, so that has to be written with it.
   *Acceptance:* a two-page starter exists, the preview shows the second page only after the first is
   valid, and one submission writes one record with every field.
   *Size:* medium. It is a schema change, which the definition has not done before.
3. **A template for the "remote regular user" case.** Not a starter. It needs a hosted app with its
   own sign-in and its own data boundary, and the extension cannot hold a user's session for a
   deployed app.
   *Acceptance:* none can be written inside this extension today. The honest step is to decide
   whether the extension is the tool for that case at all, or whether it should hand the developer
   the pieces (the generated app, the bridge contract, the field mapping) and let them publish.
   *Size:* large, and it is a product decision, not a task.
4. **Shorten the Command Palette to the everyday set.** The third proposal in `docs/UX_INVENTORY.md`.
   *Acceptance:* a connected user sees the everyday set; the rest stay behind the power-user setting
   and in the home.
   **Done the same day:** pull request #596 kept the palette to the everyday set; the other commands
   stay in the home and behind the power-user setting, so no capability was removed.

## What this document does not claim

- No usability study with developers was run. The numbers are measured from the manifest and the
  sources, and the readings of the flow — including the "where a first-time user loses the thread"
  list in `docs/UX_INVENTORY.md` — are not observations.
- No public deployment was exercised. Every number above is a count taken from the manifest or the
  sources; nothing was measured against a running server.
- Claris Studio's own feature set was not consulted; the comparison is inherited from
  `docs/UX_INVENTORY.md`, with the same caveat.
- The real-server checks in `docs/FILEMAKER_FAILURE_MODES.md` still stand.
