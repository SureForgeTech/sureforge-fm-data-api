# Changelog

This file is the operator-facing release ledger. Every pull request adds one
line under `## Unreleased` with one of the allowed section labels, or
applies the `changelog-skip` label for a purely no-impact change. See EAS
§B2 Universal PR Essentials.

Allowed entry labels:

- `[BREAKING]` - incompatible API, data, deployment, or operator change.
- `[FEATURE]` - new user-visible or operator-visible capability.
- `[FIX]` - bug fix or compatibility repair.
- `[INTERNAL]` - tests, CI, docs, refactors, generated artifacts, or process.
- `[SECURITY]` - vulnerability fix, security control, or hardening change.

PR title prefix matches the highest-tier label added:
`[BREAKING]` -> `[major]`, `[FEATURE]` -> `[minor]`, others -> `[patch]`.

## Unreleased

### [BREAKING]

- None.

### [FEATURE]

- The generated TypeScript client's calls can now run a FileMaker script alongside them and read its result, and it can run one on its own.

- The generated TypeScript client's edit now takes the record's `modId`, so a write can refuse to overwrite a record that changed since it was read.

- Batch update now reads a file that is one record per line or a spreadsheet's semicolon-delimited columns, when you say so, and the import says which date order the server will read the dates in.

- The private preview now writes its launch link into the preview's own folder, so a run whose browser could not be opened - a CI runner, a remote session - can still reach the preview. The ready message says where to find it.

- The form editor can go back to the invented data: **Try sample fields** in the editor restores the starter's sample fields, so a developer who chose their own fields does not have to start over. The saved app stays unchanged until the replacement is saved.

- A script that needs longer than the shared request timeout can ask for its own deadline in the Script Runner. Type the seconds in **Timeout (seconds)**, from 1 to 600; that deadline applies to that run only, and the timeout message still says the change may already have been applied.

- Drafting a form from a prompt now reads three more ways of leaving a field out: a quantifier that counts the fields ("all of the fields but phone"), an exclusion that follows a comma ("include email, phone, excluded"), and an exclusion whose particle follows the field ("leaving phone out").

- The Command Palette now shows the everyday commands by default: the home's four journeys, the extension README's common commands and the walkthrough's steps. The other commands appear when **filemaker.advanced.powerUserMode** is on, and every one of them stays in the FileMaker home, where you can find it by name. Nothing was removed.

- The FileMaker home now has a **Find a command** box. It hides the commands that do not mention what you type, and the section they sit in when nothing is left in it, so the full list of commands is usable.

- Build a Portal now asks which starter the app is for, the same starters Create FM Web App offers, and its create, edit, preview, export and layout actions work on that app. It was fixed to the event registration starter, so a service inquiry, appointment request or application could not be built or resumed with it.

- The FileMaker home now names every command the extension contributes, so the advanced tools are one click away in the home as well as in the Command Palette. The home used to name 34 of the 82 commands, which left 22 of them reachable only from the palette.

- Create FM Web App offers three more starters — Service Inquiry, Appointment Request and Application — beside Event Registration and Feedback or Request Form. Each one is entirely synthetic, so it opens in the visual editor and previews with invented data without a FileMaker connection.

- Right-click a field in the FileMaker sidebar and choose **Copy Field Name** to put its exact FileMaker name on the clipboard, ready to paste into a request or a script.

- Right-click a layout in the FileMaker sidebar and choose **Copy Layout Name** to put its exact FileMaker name on the clipboard, ready to paste into a request or a script.

- The Script Runner suggests the scripts the server lists, so the exact script name can be picked instead of typed. The name that runs is still the one in the box.

- Start Here opens a FileMaker home with the four journeys — Build a Web App, Connect and Test, Browse Data and Help — and an Advanced Tools section for the rest. Each button runs the matching command.

- Create FM Web App starts with a starter: Event Registration or Feedback or Request Form. The starter names the saved app, so choosing the same one again reopens it. Sample fields come first, the wizard resumes by itself after you open a folder or add a first connection, and the sample receipt needs no credentials, code or JSON.

- Draft a form from a prompt using your existing FileMaker connection, then review suggested fields and preview in the visual editor.

- Event-registration forms can save real records to an explicitly confirmed FileMaker connection through the private extension bridge. Persistent submission tracking prevents automatic retries after an uncertain write; sample preview remains available.

- Create FM Web App is the main guided workflow: choose FileMaker or sample fields, customize an event-registration form without JSON, save and preview, then reopen it to continue editing. Existing commands remain available.

- Export app scaffold includes the saved portal definitions and source layouts, so generated apps use the same custom form as private preview. Changed exported data always asks before replacement.

- Build a Portal creates or resumes editable event-registration forms with exact mappings, labels, help, required fields and basic branding, then previews saved definitions privately with sample data.

- VSIX builds include the FM Web runtime and shared templates, enabling local app generation and preview without a repository checkout.

- Added a private event-registration sample that reuses FM Web fields, validates submissions on both sides and reports duplicate or uncertain outcomes without automatic write retries. It uses a synthetic adapter, not a FileMaker server.

### [FIX]

- A request that waits for a session is now ended by its own deadline, and says so: the message names the deadline that was in force, in the same words as the other timeout messages.

- Escape every slash in a run when the Query Builder produces literal Find criteria, and keep literal punctuation inside E2E report table cells.

- Dates can now be read and written in the order you choose. Set **filemaker.dateFormats** to `1` for the locale of the file the dates came from, or to `2` for ISO 8601. The default leaves it to the server, so the option is only sent when you ask for another one.

- Drafting a form from a prompt now reads an exclusion that follows the field it is about, so "include email, phone excluded" leaves phone out instead of suggesting it. "Everything but phone" now reads as the exclusion it is, the way "everything except phone" already did, and "leave out", "leaves out" and "left out" leave a field out too.

- A prompt that states the requirement at the end of a list of fields now marks every field of that list, so "Name and email are required" no longer leaves the first field optional.

- Drafting a form from a prompt now reads "Do not require phone" as a field of the form that is not required, the same as "not required phone". Before, the field was left out of the form and the request was not reported.

- The private preview's form talks about the submission you are making rather than about a registration, so a feedback or request form does not read as an event registration.

- The connection wizard refuses an account name that contains a colon, because the account name and the password travel together in the sign-in request and a colon would separate them. A colon in the password still works.

- The Record Viewer, the Record Editor and **Get Record by ID** now warn when a script that ran with the record reported an error. The record still loads, as it did before.

- The FileMaker sidebar now says why it could not load layouts, fields or value lists, instead of the same advice for every failure. The reason is the FileMaker error code and what it means, or the kind of connection failure.

- A field in the FileMaker sidebar now says what kind of field it is: calculation, summary, global or container. A calculation, a summary and a container are not written like an ordinary field, so a request that sets one is refused.

- Record editing and intake validation preserve long decimal values that would otherwise be rounded when converted to JavaScript numbers.


### [INTERNAL]

- The maintainer inventory now states the criterion for the commands visible on a fresh install: a command belongs there when the repository's own launcher offers it. Every one of the thirteen is named in the FileMaker home, and a unit test holds that.

- The desktop journeys now expect what the product does: the walkthrough's sixth step, the kind a field row carries, the reason an Explorer failure row names, and the script list the Script Runner asks for when it opens. The facts they rest on are held by a unit test, so a product change that moves one fails in a pull request.

- The first-portal journey now says where publishing lives: there is no publish command, the preview is private, and Export app scaffold hands the user the app's source to host themselves. The maintainer inventory records that the Claris Studio capability map was still unchecked, and what each of its rows would need.

- Webview tests and the offline theme audit remove script elements through the parsed DOM before using the fixture.

- The tag release step can be rerun: the release is published when the tag has none, and completed when it already exists, so a job that was cancelled after the release was published no longer fails with a duplicate-release error.

- The packaged-extension journey now expects the FM Web preview commands to be offered, because the VSIX carries the runtime template, and a test stages that template with the repository's own packaging script and checks that the extension finds it and publishes the preview availability.

- A script run that asks for its own deadline is no longer ended by a sign-in that started under the shared timeout: when another sign-in is in flight with a shorter deadline, the run signs in for itself instead. The proxy path takes the same deadline for its sign-in.

- The UI test harness counts only the decisions a user actually made: a command or an option that never ran is not counted, the harness's own housekeeping is not counted as a decision, and a journey that drives a second window records its choices in the same measurement.

- The UI test harness now measures every journey it runs: how long it took, and the deliberate choices on the way, are written to `measurements.json` and to the run's report. The maintainer inventory records what that measurement can and cannot cover for the path to a first sample receipt.

- The entry-point inventory and the failure-mode catalogue now say what the extension does. The inventory's palette counts, the home's coverage of every command and its search were corrected against the manifest, and the CA-file re-check is recorded as fixed. A test recomputes the sizes and counts the inventory states, so the document and the extension cannot drift apart.

- The loopback FileMaker mock can save a record and drop its reply, so registration tests verify that an uncertain write is not retried.

- Pull requests are now welcome with a DCO sign-off (`git commit -s`): the organization contributing guide says so, and a new `dco` workflow checks the sign-off on pull requests from outside contributors.
- The licence changes from MIT to Apache-2.0, with a NOTICE file. Releases published before this change keep the MIT licence they shipped with; only new releases carry Apache-2.0.
- Update `CODE_OF_CONDUCT.md` to the Contributor Covenant 2.1 text with the project-wide enforcement contact (contribute@sureforgetech.com).
- The copyright holder in both MIT `LICENSE` files and the extension's author are now SureForgeTech; the licence text is unchanged.
- Added shared intake-form contracts, exact FileMaker field mapping and browser/server validation for the upcoming local registration workflow.

- Routine small updates to the libraries the project builds on: axios 1.21.1, ESLint 10.15.0, playwright-core 1.65.1, and Next.js 16.4.6 for the web page generator. No behavior change is intended.

### [SECURITY]

- Certificate inspection now closes the discovery connection as soon as the certificate is read, cancelled, or times out. Connection diagnostics still verify trust in a separate handshake.

- Strengthened the in-memory identifier used to recognize unchanged credentials after a rejected sign-in. The identifier now uses a randomly salted password derivation function.

- AI context exports add a single literal .gitignore rule for the chosen filename. Paths containing line breaks are refused, and repeated exports do not duplicate rules for filenames ending in spaces.

- Generated file replacement now refuses hard-linked targets, including aliases added during confirmation, so replacing an export cannot change another linked file.

- Close four small gaps left from the security review: an edited server address now replaces a saved address that still carried a password (the old password is dropped, not kept on the old server); addresses in error notifications are shown as plain text that cannot be clicked; the FM Web preview checks the private session before Next's own development endpoints, hot reload included; and the preview installs with `npm ci` when the shipped template carries a lockfile.

## 1.9.1 (2026-11-14)

### [BREAKING]

- None.

### [FEATURE]

- None.

### [FIX]

- None.

### [INTERNAL]

- The repository moved to SureForgeTech/sureforge-fm-data-api, and documentation links point to the new site.

### [SECURITY]

- Changing a connection address clears old certificate exceptions and custom CA files. Saved credentials must be entered again when the gateway path, API path or database changes. Server addresses with query strings or fragments are refused, CA files are limited to 1 MB and cannot contain private keys, and pinned certificates with unreadable validity dates are refused unless explicitly accepted.
- Container fields in FM Web show images and links only from the connection’s own server. High-scale export asks before replacing an existing JSONL file after changing the selected extension. Script failure logs omit parameters and server response details. Projects cannot select performance mode or raise your connection retry limit.

## 1.9.0 (2026-11-13)

### [BREAKING]

- None.

### [FEATURE]

- Create Record can add new portal rows alongside the parent record on direct connections; proxy connections explain that portal-row creation is unavailable. Mock-tested; real-server compatibility remains unverified.

### [FIX]

- Batch exports keep the configured record cap even when the server returns too many rows.
- Generated app updates recognize the current dependency manifests while preserving edited files and previously shipped versions.
- Batch CSV export preserves Unicode line and paragraph separators without failing on newer VS Code versions.

### [INTERNAL]

- The mock Data API answers the `productInfo` and `databases` calls that Test Connection makes, so the documentation saying otherwise is corrected. A new first-run journey (test the connection, save the profile, connect, run the first query) runs against the mock on every pull request on Linux, and a test keeps the documentation in step with the mock.

### [SECURITY]

- Remove the vulnerable documentation matcher while preserving API documentation generation.
- Only record GET and find reads (including proxy `getRecord`/`findRecords`) renew their deadline after each 64 KiB; upload deadlines grow with body size, last at least the request timeout, and have a 30 minute ceiling; stalled transfers stop and trickling reads time out. The 30 minute transfer ceiling cannot be raised from settings.
- Batch update confirmation accepts saved server addresses that are not parseable URLs.
- Error notifications keep bracketed codes and file paths readable while breaking injected links.
- FM Web refreshes recognize the current shared container-link safety code without overwriting local edits.
- Suggested export filenames keep their original case and extension while removing unsafe path characters.
- Offline metadata cache folders ignore their own contents in Git; the `.gitignore` itself stays visible and can be committed; schema snapshots remain available to commit.
- Error messages stay short and on one line, escape display markup, and remain inside code fences in copied error reports.
- Environment comparison exports keep hostile names inside their Markdown table cells.
- Record Editor and Record Viewer only open container links on the selected connection’s server address.
- Export suggestions use safe filenames while keeping exact layout and saved-query names in exported data.
- Release packaging installs dependencies without running their install scripts.
- Hostile portal notes, numeric cells, certificate names and AI error text no longer cause excessive regex backtracking; exported portal notes bound names and require safe counts.
- Direct and proxy FileMaker requests enforce a 64 MiB response limit; other requests (scripts, writes, layout metadata, sign-in, sign-out and discovery) have the fixed base deadline from `filemaker.requestTimeoutMs` (default 15000 ms, maximum 120000 ms (2 minutes)).
- Batch updates refuse files above filemaker.batch.maxRecords and show escaped layout and profile names with the server host before execution.
- Generated client README files display layout and profile names as code so hostile names cannot load remote Markdown images or links.
- FM Web preview recognizes unchanged template files on Windows and shows relative file names with forward slashes.
- Editing a profile preserves its legacy server password until secure storage confirms it is saved; stalled storage no longer blocks profile changes indefinitely.
- Adding, editing or removing another profile preserves legacy server passwords until secure storage is available.
- Legacy offline schema caches without a recorded hash algorithm accept the configured algorithm and still reject altered content.
- Migrating a password from a saved server address preserves a password saved during the migration.
- Trust Server Certificate and Set AI Access are unavailable in offline mode, like other write actions.
- Batch dry runs remain available when writes are disabled or offline mode is on; offline previews do not contact the server. Dry runs still require `filemaker.features.batch.enabled` and a trusted folder.
- Offline schema caches keep working after the hash algorithm setting changes, while altered content is still rejected.
- Removing credentials from saved server addresses preserves profiles added or edited during the migration.
- Saved server addresses keep their password for a later migration attempt if secure password storage fails.
- Batch updates respect the record editing switch and enterprise record and write policies.
- Running batch jobs stop with a clear reason when offline mode or policy blocks further work.
- Trusting a server certificate respects locked profiles and enterprise write policy.
- Changing a connection's AI access respects enterprise write policy.
- Untrusted workspaces cannot apply enterprise policy from filemaker.config.json.
- Offline schema metadata is ignored in untrusted workspaces and checked against its stored hash before use.
- Environment comparison and layout comparison refuse untrusted workspaces.
- Snippet authorization defaults, schema hash algorithms and bridge request limits can only be set in User settings.
- Record editing, creation and container uploads respect the enterprise write switch; open Record Editor and Script Runner panels recheck policy before writes. Write AI Context respects filemaker.features.ai.enabled, enterprise AI policy and offline mode, independently of the language-model tools switch.
- Saved server addresses lose embedded credentials, preserving an existing saved password and asking you to confirm it. Test Connection keeps temporary credentials in memory, and removing a profile attempts to close its server session before clearing secrets.
- Logs mask more token formats, and Connect warns once per profile each session when a remote connection uses unencrypted HTTP.
- FM Web preview cleans up private files after Windows stop failures and can start again after a preview exits.
- FM Web preview keeps old temporary folders while their owning VS Code process is still running in another window.
- FM Web preview warns and skips layouts with edited or linked generated files while starting the remaining layouts.
- FM Web preview leaves dependency and build folders out of inspection and regeneration, and checks file sizes before reading contents.
- FM Web preview hides the Windows console for dependency installation and the development server.
- AI approval dialogs show hidden Unicode characters as visible escapes, preserving supplementary characters exactly so the proposed names and values remain distinguishable.
- FM Web preview leaves workspace npm configuration and edited or added runtime files untouched, lists ignored runtime files, and runs a clean private template copy with install scripts disabled and empty npm config files. Deleting runtime files requires named confirmation in the explicit generation command.
- FM Web preview finds Node.js and npm on Windows without a shell and stops the whole preview process tree before removing its private files.
- FM Web preview recognizes its own comment-only env file after a VS Code restart without reporting it as unexpected.
- FM Web preview preserves proxy settings and extra CA certificates for installs on enterprise networks while continuing to exclude npm and Node injection settings.
- FM Web preview waits for private-file cleanup on shutdown with a time limit. Old marked temporary preview folders are removed only when older than one day and their owning extension-host process no longer exists (checked by process id).
- Layout Mode and preview script confirmations visibly escape hidden characters, show parameter lengths, and refuse values too long to show in full. Layout Mode shows the layout that will actually run.
- Plugin consent visibly escapes filenames containing newlines or hidden characters; approval hashes still use the original names and bytes.
- FM Web preview keeps the bridge token on the server. A single-use launch link grants a private session cookie; application requests reaching the preview proxy without it or with the wrong Host are refused. Next development endpoints, including HMR, are outside this cookie gate.
- FM Web preview listens only on 127.0.0.1:3000, and the bridge refuses missing origins and origins outside that preview port.
- FM Web preview script buttons ask for confirmation in VS Code with the exact script, escaped parameter and connection host. Oversized confirmation values are refused, and repeated prompts are throttled.
- Cancelling FM Web preview startup stops the bridge and removes its saved address and token without removing unrelated env settings.
- FM Web layout URL actions refuse schemes other than HTTP and HTTPS. Script and layout names and script parameters reach the preview bridge unchanged.
- Patch vulnerable glob matching in publishing and compatible development tools.

## 1.8.0 (2026-11-02)

### [BREAKING]

- None.

### [FEATURE]

- The Query Builder remembers the selected connection, layout, find request, editor tab and result view, so reopening the panel after a window reload restores the work in progress instead of an empty form.
- The Query Builder shows a Cancel button while a query is running; pressing it aborts the request in flight and the panel reports the query as cancelled.
- Error toasts can reconnect to the server in one click after a sign-in failure and open the matching troubleshooting page from the toast; more errors now carry that link, including no free sessions, too many sign-in attempts, HTTP 403/404, certificate problems and connection failures.
- Five commands gain default keyboard shortcuts: Open Query Builder `Ctrl+Alt+Q`, Open Record Viewer `Ctrl+Alt+V`, Open Script Runner `Ctrl+Alt+E`, Show Request History `Ctrl+Alt+H` and Open FM Web Layout Mode `Ctrl+Alt+L` (each `Cmd+Alt` on macOS except Show Request History, which stays `Ctrl+Alt+H` to avoid the system's Hide Others shortcut); rebind or clear them in Keyboard Shortcuts as before.
- The Connection wizard's certificate section has a Browse button that opens the system file picker for a custom CA bundle (PEM, CRT or CER), instead of typing the path by hand.

### [FIX]

- Record Editor Save no longer stays at “Saving…” when VS Code restarts the extension after workspace trust is withdrawn; the panel explains how to reopen and warns the user to check the record before retrying.
- The Query Builder keeps the previous results available to export when a later search is canceled.
- FM Web displays, validates and saves a repeated field under its lowest available repetition key when `Name(1)` is absent.
- The Query Builder can cancel a search while it is still loading its connection profile, and closing the panel stops that search.
- The Query Builder now restores the page size and offset after a window reload for the same connection and layout; host saved-query values take precedence.
- Canceling Browse for a CA certificate keeps the previously selected file path.
- The Query Builder results table sizes its Open column to fit both actions, so View and Edit are both visible and clickable instead of clipping Edit to "View ...".
- The Query Builder clears restored criteria and sort rows when the layout they were written for is no longer among the profile's layouts, so a saved find is never shown or run against another layout.
- A failure to save the optional offline schema cache no longer fails a layout schema that the server returned; it is logged as a warning instead.
- Script parameters sent through the FM Web bridge keep their spaces, line breaks and empty value exactly as written.
- Log lines that include an error now show the error's name, message and code instead of an empty `{}`, with secrets still hidden.
- A layout named `FileMaker` no longer produces a generated TypeScript client with two `FileMakerRecord` types. Layout names that differ only by letter case, such as `Sales` and `sales`, now get separate generated type files, with short hashes added where needed, so the files no longer swap places when the server lists layouts in a different order. This applies to Generate Types for Layout as well as Generate Types for All Layouts: a single layout is named from the server's layout list when it can be read, and from the files already in the folder when it cannot, so a cached layout still generates. After a layout has been chosen, offline generation uses cached metadata without requesting the server's layout list or attempting sign-in. The Command Palette layout picker and Generate Types for All Layouts still request a server layout list. A generated file that belongs to a different layout is never replaced, and a layout keeps updating the file it already owns, including a numbered one (such as `Sales-1a2b3c4d-1.ts`) given out by an earlier run, even when numbers in between are missing. Newly generated files carry a `Layout SHA-256` line that identifies the layout without printing its name; older files are only recognised when their `Layout:` line shows the name unambiguously, and any other generated file is left untouched. Delete any old `Sales.ts`-style file left by an earlier build.
- A restored Query Builder tab now uses the current extension folder and script settings instead of the ones saved before the window reload.
- The Record Editor shows fields in the same order as your layout, with the right kind of box for each field. The Viewer, find form and FM Web use the same field rules, and Copy no longer covers record values. A container shows its image and, when that image cannot be shown, its address. A repeated field now appears in FM Web. A required repeated field no longer stops a save, and a repeated column in a portal shows its value.
- Website tables scroll on small screens, documentation links stay on the website, and repeated documentation links are removed.
- Generated FM Web apps can run their own tests and refresh untouched older shared files. Missing field details, stopped previews and save errors have clearer messages; date hints appear while editing and saved messages clear when browsing.
- Layout Mode buttons keep their text readable when pointed at or selected with the keyboard. Effective Settings lines up with other screens and keeps its settings buttons on one line. Disclosure controls and separate tabs use the same size and rounded corners as other controls.
- The generated FM Web page opens again, no longer stretches sideways, and can edit and save records.
- All screens now share the same fonts, buttons, messages and read-only look.
- Read-only values stay easy to read, empty messages remain available to screen readers, and headings, panels and control sizes match across screens. Schema Diff opens with **Show only changes** ticked; clear it to see unchanged fields.
- Panels no longer sit empty when the extension cannot finish a request. The Record Viewer, Record Editor, Query Builder, Script Runner, Connection Wizard, Layout Mode and Schema Diff now say what went wrong instead of waiting forever, and the reason is written to the output channel.
- Sign-in errors now say what to do: FileMaker error 212 explains both possible causes — a mistyped password or a privilege set missing the `fmrest` extended privilege, with the exact FileMaker Pro path — and the error report now shows the matching Troubleshooting link for errors 212 and 9. Other FileMaker codes keep their existing message.

### [INTERNAL]

- Platform-check failures now fail the required merge check, and strict UI release tests fail when their prerequisites are unavailable.
- Tag builds now also publish the VSIX to Open VS X (open-vsx.org), in its own `publish-ovsx` job that runs after the Marketplace publish and fails closed when the `OVSX_PAT` secret is missing, so no GitHub release is cut unless both stores accepted the build. Cursor and Windsurf users get a one-click install once the namespace and token are set up (#265). The job needs a second approval of the `marketplace` deployment in the same run.
- The Marketplace listing README now has a Security & Trust section right after the product tour: credentials stay in the OS keychain, nothing is collected or sent to the authors, an untrusted folder stays read only, and the security policy is one link away.
- A privacy policy at the repository root (PRIVACY.md) now says what the extension stores locally, what never leaves your machine, the proxy-mode exception, which third parties are reached, the GDPR/CCPA stance, and where to send privacy questions; the documentation table, the Marketplace listing and the User Guide all link to it.
- The Marketplace README now opens the product tour with a Query Builder hero screenshot of the Contacts layout: field pickers, a populated find request and the found rows.
- The Marketplace README now shows a GIF of the connection flow: add a connection profile, connect, and open the Query Builder.
- The unit tests no longer pass an IP address as a TLS server name, which Node 22 warns about and Node 26 rejects.
- The real VS Code proxy-patch TLS test now skips, with the reason logged, when a plain TCP connection to this machine's own LAN address cannot be opened. Once TCP connects, every certificate, pin and sign-in failure still fails the test.
- The user guide, upgrade notes and a changelog by version are now on the project's website.
- The monthly secret rotation reminder now reads the rotation calendar in docs/SECRETS.md and files a reminder issue about 30 days before a tracked credential is due; a manual dry run prints what it would file. A row that cannot be read, or a name that appears twice in the calendar, is reported and fails the run instead of silently hiding a rotation.
- The shared package, the Layout Mode app and the FM Web preview template now take part in the repository's lint and coverage gates, so a change in any of them is checked like the extension's own code. The repository's own lint tooling stays in the repository: a generated FM Web app runs its own tests and does not lint itself. An app you generated earlier is recognised as a version this repository shipped, so the new test settings reach it instead of a warning about a file you did not touch. The README and docs/CI.md say how the workspaces are checked.
- The Marketplace listing description and the README lead now open with one sentence: connect to any FileMaker Data API server, run queries, browse schema, edit records and export results without leaving VS Code.
- The Marketplace listing README now shows the version, last-commit and MIT-license badges under its title.

### [SECURITY]

- Open Generated Types Folder refuses output paths that pass through a symlink outside the workspace.
- Schema snapshots and the offline metadata cache refuse to read, write or delete through a symlink under `.vscode/filemaker`, so a cloned repository cannot point them at files outside the workspace.
- Saved connection secrets are decrypted with a fixed 16-byte tag check, so a shortened or tampered tag is refused instead of being misread. Secrets saved earlier keep working. No known exploit.
- The extension's panels now ignore messages that do not come from VS Code itself, so a stray or badly formed message is dropped before it can act. No known exploit.
- Files written for generated pages, type generation and AI context now stay inside their folder: a path that tries to escape is refused instead of written. No known exploit.
- The dependency trees used to build and release the extension no longer carry a known high-severity advisory: `@azure/msal-node` is updated past CVE-2026-109461 in the workspace lockfile and in the separate lockfile the Marketplace and Open VS X publish jobs install from, and `body-parser` is updated past GHSA-27r3-jxmh-p828. All of them are used by the build and publish tooling rather than by the shipped extension, and none of them is in the published VSIX. No known exploit.
- Security: the web page generator now uses Next.js 16.4.2, which fixes three published problems in Next.js (an image-handling flaw and a flaw in the `use cache` feature that could each run code, and a denial-of-service flaw). The extension itself did not use the affected parts, but apps you generated earlier keep their old version: run `npm install next@16.4.2` in `.fmweb/generated/runtime-next` to update them.
- Security: `zod` is updated to 4.6.7, which fixes a published security advisory in zod 4.6.5 (the version 1.7.0 shipped): validating a very large array without a length limit could use all available memory. No behavior change.

## 1.7.0 (2026-10-22)

Minor release: no data migration, and no command or setting was removed. User-facing notes: `extension/CHANGELOG.md` and `extension/UPGRADE.md`. Entries for 1.6.0 were removed from this ledger; user-facing notes remain in `extension/CHANGELOG.md` under 1.6.0, and the full ledger is in git history through 5bd5dc8.

### [BREAKING]

- None.

### [FEATURE]

- Add Cancel Job in the Command Palette, running job menu and jobs status menu, with Copy failures in job details.

- Add Diagnose Connection: check the server address, network, certificate and Data API without signing in, explain likely fixes, and copy a report with the address hidden if wanted.
- Add FileMaker: Test My Server to check a connection safely and make a report without passwords, with separately confirmed scratch-record and script tests.

### [FIX]

- Offer **List records instead** for an empty Query Builder search, using the selected layout, page size, starting record and sort only after you choose it.
- Show a clear error when a saved queries file is not valid JSON or does not contain a list of saved queries; leave existing queries alone.
- Keep **Cancel Job** and **Show Jobs** available in the Command Palette with power-user mode switched off.

- Confirm uncertain batch writes using number formats only for number fields; keep text exact apart from line endings. Keep layout and script names exact in preview requests. Correct the Create Record field-loading guidance and avoid doubled punctuation in its defensive error message.

- Let Create Record recover from a failed field lookup; keep later real edits after skipped-only rows, ignore spaces around JSON record IDs and versions, and recognize matching retry results despite number, space or line-ending differences. Cancelling stops further record checks.
- Handle repeating read-only fields in imports, Record Editor saves and AI writes; check uncertain batch retries, skip duplicate record rows, and keep skipped values out of dry-run previews.
- Protect batch updates with the exported record version, skip records changed since export, and ask before overwriting newer changes or using files without versions. Dry runs report how many rows can be checked.
- Keep calculation, summary and container fields read-only in the Record Editor, explain global fields, and skip calculation and summary import columns with clear warnings.
- Clarify in the package description and getting-started pages that FileMaker Server is supported and FileMaker Cloud sign-in with a Claris ID is not supported yet.
- Allow generated files in a workspace opened through a symbolic link, refuse linked output folders before creating files, and show generation refusals clearly.
- Let requests continue as soon as a renewed session is ready, while closing the previous session in the background.
- Use stored text fields for long script parameters and distinguish empty text from an empty layout, with clearer messages when a script did not run.
- Keep all batch counts in recent jobs while limiting each saved record list to 1,000 entries; full lists remain available during the session. Cancelled exports say no file was written.
- Keep portal counts with the correct record and allow retrying Load more after an error.
- Give certificate date advice that matches the failure and put Data API failures before advice about older certificate settings.
- Name repeating fields that become empty after removing NUL characters.

- Ask before replacing unrelated generated files, start the client chooser in a generated folder, and protect AI context and FM Web page output.
- Show successful and failed batch rows separately, retain failure codes and partial results, and list each job once.
- Clear trusted certificates when the wizard address changes, offer a visible Save anyway choice, and show when a saved password can be kept.
- Clear old query and script results after failures and prevent repeated clicks from starting duplicate requests or dialogs.
- Keep narrow Query Builder controls inside the panel, remove repeated server facts and AI field names, and report missing portal rows honestly.
- Place added Layout Mode fields below existing objects and load the record automatically when Edit Record by ID supplies an ID. Correct the guide to say container URLs are shown as text.

- Diagnose Connection now shows the full matching certificate fingerprint, explains older certificate settings and missing intermediates, and gives advice that matches the current proxy handling. Server path prefixes work, report lines are easier to read, and hiding the address also hides the port.

- Long script parameters use a wildcard find on the first text field instead of an empty find. No-match finds and responses without a script status cannot report a successful script run.
- Test My Server now reads a record without an empty search, and empty searches show clear next steps. Cancelled batch updates wait for pending edits and keep a list of changed, failed and untouched records. Cancelling one request no longer cancels another request's sign-in, and renewed connections close their old sessions.
- Preserve text and record IDs when moving data through CSV and the Record Editor; show incomplete portal rows with Load more, keep existing exports safe on failure or cancellation, and offer CSV for Excel.

- Generated types now use the real field type and repeating field names. Generated clients handle empty finds and explain server errors. Special names stay intact; timeouts, paging and error messages give clearer next steps.

- Trusted certificates (trusted by fingerprint) and older allow-self-signed profiles now work without changing a VS Code setting, so a server with FileMaker's default certificate can be trusted and used. A changed trusted certificate is refused before any credentials are sent; a trusted-fingerprint connection that would need a proxy is refused with advice. Custom CA file profiles are unchanged: they keep going through a proxy as before. An older allow-self-signed profile goes direct unless an environment proxy applies; that route is unchanged.
- Warn before NUL characters can lose text in record edits and creation, refuse affected batch rows and AI writes, and generate valid types when a layout lists a field twice. Record the real-server findings and the remaining gap for creating portal rows.
- Require the same confirmation before deleting saved queries from Manage, and show handled errors when saved-query commands, comparison report exports or snapshot lookups fail.

- Webviews and Layout Mode controls now follow light, dark and high-contrast editor themes, with readable fields, messages and schema differences.
- Refresh unedited FM Web pages generated by version 1.0.0, while keeping edited files and symbolic links untouched.
- Report malformed AI hidden-field settings consistently in AI tools, Write AI Context and the AI status bar, without changing which fields are hidden.

### [INTERNAL]

- Maintenance: remove duplicate Cancel buttons from generated-file, NUL-character and AI-context dialogs; closing a dialog leaves files and records alone.
- Maintenance: identify an unreachable proxy in connection errors and clarify how older self-signed connections use environment proxies.
- Maintenance: include the CSV portal note column only when related rows are missing, count repeated fields once in Test My Server, and name repeated fields in Layout Inspector.
- Maintenance: show the request options used by public client methods in the API reference.

- Split the connection wizard into smaller host-side parts for easier maintenance, keeping its screens, checks and messages the same.
- Split AI tool code into smaller parts, keeping the same approvals, safety checks and results; test spaces around preview record IDs and exact layout and script names.
- Maintenance: split the Query Builder host code into smaller parts, check that rejected sessions stop after one retry and uploads keep the record version, and keep connection helpers out of the API pages.

- Maintenance/quality: add behavior tests for the largest coverage gaps and raise the minimum test coverage.
- Maintenance: split the FileMaker connection code into smaller parts, keeping the same requests and messages.

- Extract AI approval text and server-address scrubbing into pure helpers, with tests that preserve the existing text and results.
- Speed up theme guard tests by reusing stylesheet parsing, color measurements and the audit document, reducing Windows timeout risk without changing color checks.
- Test the external AI bridge directly without changing its protocol, and make MCP tests wait for events instead of fixed delays.
- Test saved-query, batch, schema snapshot, type generation, enterprise and activation flows without opening VS Code, and record existing gaps in confirmations and error handling.

- Share name validation, HTML escaping and the copied-request auth default reader, keeping existing messages, output and setting scopes.
- Refresh non-certificate failure-mode documentation against current code, check its file references, and clarify the upgrade guide’s AI switch behavior. Keep webview asset tests out of the build folder, and test Record Viewer failures, stale loads and its older fallback layout.
- Run designer and runtime tests in CI, lint browser scripts, check mock API compatibility and packaged bundles, and tighten the VSIX size and coverage budgets. Cancel superseded pull request runs, share the verified GitHub CLI setup, and remove an obsolete dependency ignore.
- Make command-context tests wait for completion, test process lookups without repeatedly starting PowerShell, and keep one real-process check with a longer timeout. Remove unused designer test tooling, align the zod version range, explain the TypeScript test alias, and add a complete command reference with a coverage check.
- Remove unused snippet and helper code, keep documented utilities and command handlers, and check for unused locals and parameters during typecheck.
- Add a support page with help channels and safe bug-report guidance, remove the unused `shx` development dependency (build and package scripts already use Node), and align workspace `@types/node` declarations with the supported Node 22 runtime.

### [SECURITY]

- Hide plain-text API keys and FileMaker access-token headers in error messages.

- Harden error messages by masking credentials and tokens before they reach notifications or other normalized-message displays; normal FileMaker messages stay unchanged. No known exploit.

- Updated `follow-redirects` (inside `axios`) from 1.16.0 to 1.16.1 for two advisories about credential headers surviving a redirect; the extension refuses every redirect (`maxRedirects: 0`), so the fixed paths were not reachable, and the production audit is clean again.
