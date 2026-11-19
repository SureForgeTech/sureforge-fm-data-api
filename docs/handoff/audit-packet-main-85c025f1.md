# Post-merge audit packet — what landed on `main`

- Repository: SureForgeTech/sureforge-fm-data-api
- Working checkout (read-only for you): /workspace/sureforge-fm-data-api-wt-wizard
- Range under audit: `7ebb7f81db34fa2cdb0b303a7de549dbaa00ac11` .. `85c025f1f45746e9d1561b5ff86d59ca44d274a5` (linear, everything merged in this session)
- New main head: 85c025f1f45746e9d1561b5ff86d59ca44d274a5
- Old main head: 7ebb7f81db34fa2cdb0b303a7de549dbaa00ac11
- Commits in the range:
  85c025f1f45746e9d1561b5ff86d59ca44d274a5 [minor] Create FM Web App starts with a starter (#576)
  162e35a4ed788c6994a353978c9c1d1f3474d554 [patch] Test FileMaker registration writes that lose their receipt (#569)
  882d2884f617ca58a2d07755df4db550f9e6dd37 [minor] Draft FileMaker web forms from a prompt (#567)

## Three changes are in this range

1. **Prompt-based form drafting (#567).** A new module parses a free-text prompt and
   suggests which writable layout fields the user meant; the create wizard gains a
   'draft' source that shows the prompt, pre-picks the suggestions and opens the visual
   editor. New file: `extension/src/services/fmWebPromptDraft.ts`, with its tests in
   `extension/test/unit/fmWebPromptDraft.test.ts`.
2. **The mock FileMaker lost-receipt regression (#569).** The loopback mock server can
   commit a create and then drop the reply, and an integration test drives the real
   client and registration service through that. Files:
   `extension/test/mock-server/lib/engine.mjs`, `extension/test/mock-server/lib/proxy.mjs`,
   `extension/test/integration/fmWebRegistration.mock.test.ts`, `extension/scripts/mock/ENDPOINTS.md`.
3. **The Create FM Web App first-run wizard (#576).** The wizard asks for a starter
   (Event Registration or Feedback or Request Form) before it asks where the fields come
   from; the starter is the app's identity and names the saved app, its file and its
   preview address; the wizard resumes after a folder selection and after a first
   connection is saved. Files: `shared/src/intake-starters.ts`,
   `extension/src/commands/createFmWebApp.ts`, `extension/src/services/fmWebIntakeService.ts`,
   `extension/src/services/fmWebAppModel.ts`, `extension/src/extension.ts`,
   `extension/src/webviews/fmWebApp/index.ts`, `extension/src/webviews/connectionWizard/`,
   `runtime-next/lib/intake-registry.ts`, `runtime-next/app/page.tsx`.

## Why this audit exists

Each of the three changes was independently reviewed before it merged, and each was
reviewed by a fresh-context session of one model family (MiniMax M3.1 Flash). A second
opinion from a different model family is an extra, not a requirement, but it is worth
having for code that is now on `main`. The bar for this audit is the repository's own:
zero unresolved P0 or P1 findings.

## Complete git-generated diff for the range

Verbatim `git diff`, every changed path and hunk included, nothing summarized or truncated.

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 85f98fe..2f482d6 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -24,6 +24,10 @@ PR title prefix matches the highest-tier label added:
 
 ### [FEATURE]
 
+- Create FM Web App starts with a starter: Event Registration or Feedback or Request Form. The starter names the saved app, so choosing the same one again reopens it. Sample fields come first, the wizard resumes by itself after you open a folder or add a first connection, and the sample receipt needs no credentials, code or JSON.
+
+- Draft a form from a prompt using your existing FileMaker connection, then review suggested fields and preview in the visual editor.
+
 - Event-registration forms can save real records to an explicitly confirmed FileMaker connection through the private extension bridge. Persistent submission tracking prevents automatic retries after an uncertain write; sample preview remains available.
 
 - Create FM Web App is the main guided workflow: choose FileMaker or sample fields, customize an event-registration form without JSON, save and preview, then reopen it to continue editing. Existing commands remain available.
@@ -43,6 +47,8 @@ PR title prefix matches the highest-tier label added:
 
 ### [INTERNAL]
 
+- The loopback FileMaker mock can save a record and drop its reply, so registration tests verify that an uncertain write is not retried.
+
 - Pull requests are now welcome with a DCO sign-off (`git commit -s`): the organization contributing guide says so, and a new `dco` workflow checks the sign-off on pull requests from outside contributors.
 - The licence changes from MIT to Apache-2.0, with a NOTICE file. Releases published before this change keep the MIT licence they shipped with; only new releases carry Apache-2.0.
 - Update `CODE_OF_CONDUCT.md` to the Contributor Covenant 2.1 text with the project-wide enforcement contact (contribute@sureforgetech.com).
diff --git a/extension/CHANGELOG.md b/extension/CHANGELOG.md
index 65eb094..0708438 100644
--- a/extension/CHANGELOG.md
+++ b/extension/CHANGELOG.md
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Describe a form in Create FM Web App and review suggested FileMaker fields in the visual editor.
+
 **Licence**
 
 - The licence changes from MIT to Apache-2.0, with a NOTICE file. Releases published before this change keep the MIT licence they shipped with; only new releases carry Apache-2.0.
@@ -9,6 +11,8 @@
 
 **FM Web app creation**
 
+- Create FM Web App now starts with a starter: **Event Registration** or **Feedback or Request Form**. The starter names the saved app, so choosing the same one again reopens it. Sample fields come first, so a first sample receipt needs no connection, no code and no JSON editing. The wizard resumes by itself after you open a folder or add a first connection.
+
 - Save to FileMaker opens a private registration form after confirming the connection, database and layout. Submitting creates a real record with the mapped fields; credentials stay in the extension. Persistent submission tracking prevents the same submission from being dispatched again after a restart or uncertain result. Sample preview remains available.
 
 - Create FM Web App guides connection, layout and field selection, then opens a form editor for labels, rules, order and branding without JSON editing. Save and preview uses sample submissions; reopen the command to continue editing. Existing advanced commands are preserved.
diff --git a/extension/docs/FM_WEB.md b/extension/docs/FM_WEB.md
index 6796a32..66d9834 100644
--- a/extension/docs/FM_WEB.md
+++ b/extension/docs/FM_WEB.md
@@ -6,23 +6,26 @@ Reference for the FM Web workflow (Layout Mode, generated Next.js runtime and th
 
 **FileMaker: Create FM Web App** is the main entry point. It is also available from the new-file button above Connections and the first Getting Started step.
 
-1. Open a trusted workspace folder. Choose **Use FileMaker fields** or **Try sample fields**.
-2. For FileMaker fields, choose a saved connection, a layout and the registration fields. The picker excludes calculations, summaries, containers and globals. Exact layout and field names are preserved. If no connection exists, the flow offers the existing connection setup.
-3. Customize the event-registration form in its editor: event title and description, submit/success text, organization and accent color, included fields, labels, help, required rules, input types, maximum lengths and single-choice options. Move fields up or down to set their order.
-4. Choose **Save and preview** for a sample-only browser session with invented details, or **Save to FileMaker** to accept real registrations. The latter saves the form, names the connection, database and layout in a native confirmation, and opens a private browser session only after you choose **Enable FileMaker saves**. Submitting that browser form creates a real FileMaker record.
-5. Run **Create FM Web App** again to continue editing the saved app. No setup commands or JSON editing are needed for the normal create/customize/preview path.
+1. Open a trusted workspace folder. If none is open, the wizard offers to open one and resumes by itself once the window reloads.
+2. Choose a starter: **Event Registration** or **Feedback or Request Form**. The starter names the saved app, its file and its preview address, so choosing the same starter again reopens that app.
+3. Choose where the fields come from: **Try sample fields** starts immediately with invented data and no connection, **Use FileMaker fields** selects a saved connection, layout and fields, and **Draft form from a prompt** describes the form in your own words. If no connection exists, the flow offers the existing connection setup and resumes once it is saved.
+4. For FileMaker fields, choose a saved connection, a layout and the fields. The picker excludes calculations, summaries, containers and globals. Exact layout and field names are preserved.
+5. For a prompt, describe the form in your own words. The extension suggests the writable fields of the chosen layout that your wording points at, marks the ones you called required or optional, and lists the requests it could not map. Review the suggestions in the field picker and the form editor before saving. Exact layout and field names are preserved, and read-only or ambiguous fields are never suggested.
+6. Customize the form in its editor: title and description, submit/success text, organization and accent color, included fields, labels, help, required rules, input types, maximum lengths and single-choice options. Move fields up or down to set their order.
+7. Choose **Save and preview** for a sample-only browser session with invented details, or **Save to FileMaker** to accept real submissions. The latter saves the form, names the connection, database and layout in a native confirmation, and opens a private browser session only after you choose **Enable FileMaker saves**. Submitting that browser form creates a real FileMaker record.
+8. Run **Create FM Web App** again to continue editing the saved app. No setup commands or JSON editing are needed for the normal create/customize/preview path.
 
 Saves preserve the authored source layout and refuse to replace a form changed by another editor. Reopen the app editor to load those changes. Cancelling field selection creates no app definition. The advanced **Export app** action generates an editable app folder and reveals it in VS Code; **Source layout** opens Layout Mode. Export does not publish a website or configure a live submission backend.
 
-### Save real registrations
+### Save real submissions
 
 Choose FileMaker fields and use a saved connection with permission to create records on the selected layout. **Save to FileMaker** requires workspace trust, online mode and the extension's record-editing and enterprise write permissions. The confirmation approves one private preview session; starting another preview requires confirmation again. Changing the connection or source requires a new confirmed session.
 
-The browser submits only the form identifier, submission identifier and entered values. The extension uses the approved connection, layout and exact field mappings, validates the values again, and creates the record through the existing authenticated FileMaker client. FileMaker credentials stay in the extension; the browser receives only a registration receipt.
+The browser submits only the form identifier, submission identifier and entered values. The extension uses the approved connection, layout and exact field mappings, validates the values again, and creates the record through the existing authenticated FileMaker client. FileMaker credentials stay in the extension; the browser receives only a submission receipt.
 
-Submission tracking is stored in the extension's local storage before a write is dispatched. Repeating the same submission identifier returns its original receipt after success, including after a preview restart. An identifier reused with different values is refused. A timeout or unknown result locks further submission and is never retried automatically; check FileMaker before starting a new submission. This protection follows the submission identifier, not the attendee's name or email, and does not prevent a second registration made with a new identifier or from another installation.
+Submission tracking is stored in the extension's local storage before a write is dispatched. Repeating the same submission identifier returns its original receipt after success, including after a preview restart. An identifier reused with different values is refused. A timeout or unknown result locks further submission and is never retried automatically; check FileMaker before starting a new submission. This protection follows the submission identifier, not the attendee's name or email, and does not prevent a second submission made with a new identifier or from another installation.
 
-The form identifies real FileMaker mode and reports a successful registration only after a confirmed record-creation response. **Save and preview** still uses synthetic submissions. Exporting source does not grant permission to write, publish the form, or create a standalone public backend.
+The form identifies real FileMaker mode and reports a successful submission only after a confirmed record-creation response. **Save and preview** still uses synthetic submissions. Exporting source does not grant permission to write, publish the form, or create a standalone public backend.
 
 Existing **Build a Portal**, initialization, profile selection, metadata sync, generation and preview commands remain available for advanced work and compatible workflows. The older JSON-based starter and repair path is documented below.
 
@@ -112,7 +115,7 @@ Press `F5` to open an Extension Development Host and start with **Create FM Web
 
 ## Event registration sample
 
-In an installation with the bundled template, start the private FM Web preview and choose **Try the event registration sample** on its home page. The form reuses the shared field renderer and validates its input before sending and on the server. Use invented information: this sample acknowledges a synthetic submission and does not contact FileMaker or save a real registration.
+In an installation with the bundled template, start the private FM Web preview and choose **Try the event registration sample** on its home page. The form reuses the shared field renderer and validates its input before sending and on the server. Use invented information: this sample acknowledges a synthetic submission and does not contact FileMaker or save a real submission.
 
 The server accepts only the known sample form and its mapped fields, checks the preview session and exact Origin, and bounds the request to 32 KiB. A submission identifier prevents a repeated click from creating a second attempt in the same preview process. Accepted attempts replay their original receipt; an identifier reused with different values is refused. An uncertain result locks further submission and is never retried automatically. This is process-local preview behavior, not persistent or distributed duplicate protection; restarting the preview clears it.
 
diff --git a/extension/docs/USER_GUIDE.md b/extension/docs/USER_GUIDE.md
index 7efbf6c..3411690 100644
--- a/extension/docs/USER_GUIDE.md
+++ b/extension/docs/USER_GUIDE.md
@@ -127,7 +127,7 @@ The table lists every extension command. Titles have the **FileMaker:** prefix i
 | List Active Plugins | Lists loaded plugins and opens a selected plugin's details as JSON. | Shown in power-user mode; needs a loaded plugin. |
 | Toggle Offline Mode | Toggles your offline setting and reports the effective mode. | Always shown; workspace or policy settings can keep offline mode on. |
 | Refresh Offline Metadata Cache | Reads layouts and metadata into the offline cache. | Always shown; needs a profile and workspace trust. |
-| Create FM Web App | Creates or resumes an event-registration app with field selection, form customization and private sample preview or confirmed FileMaker record creation without JSON editing. | Always shown; needs a trusted workspace folder. Real registrations need a saved connection and record-creation permission; sample fields do not. |
+| Create FM Web App | Creates or resumes a starter app, Event Registration or Feedback or Request Form, with field selection, form customization and private sample preview or confirmed FileMaker record creation without JSON editing. | Always shown; needs a trusted workspace folder. Real submissions need a saved connection and record-creation permission; sample fields do not. |
 | Build a Portal | Creates or resumes an editable event-registration sample and offers mapping, layout and private preview actions. | Always shown; needs an open trusted workspace. No saved profile is needed for the sample. |
 | Initialize FM Web Project | Creates the .fmweb project structure and configuration. | Shown with a profile; needs a trusted workspace folder. |
 | Sync FM Web Project Metadata | Saves layouts, scripts and fields for the selected project profile. | Shown with an initialized FM Web project; needs a profile and trust. |
@@ -802,9 +802,9 @@ Regenerate after a schema change, and use a [schema diff](#schema-snapshots-and-
 
 ## FM Web and Layout Mode
 
-Start with **FileMaker: Create FM Web App**, or the new-file button above Connections. Choose **Use FileMaker fields** to select a saved connection, layout and writable registration fields, or choose **Try sample fields** without a connection. The form editor lets you change labels, help text, required rules, input types, choices, field order, event text and organization/color branding without editing JSON. Choose **Save and preview** for invented sample registrations, or **Save to FileMaker** for real registrations. The latter names the connection, database and layout in a native confirmation; choose **Enable FileMaker saves** to open the private browser form. Submitting that form creates a real record.
+Start with **FileMaker: Create FM Web App**, or the new-file button above Connections. Choose a starter, **Event Registration** or **Feedback or Request Form**; the starter names the saved app, so choosing the same one again reopens it. Then choose where the fields come from: **Try sample fields** to start immediately with invented data and no connection, **Use FileMaker fields** to select a saved connection, layout and writable fields, or **Draft form from a prompt** to describe the form in words and review the fields the extension suggests. If no workspace folder is open, the wizard offers to open one and resumes by itself afterwards; if no connection exists, the wizard offers the existing connection setup and resumes once it is saved. The form editor lets you change the title and description, the submit and success text, the organization and accent color, and each field's label, input type, help text, required rule, maximum characters and choices, and which fields are included and in what order, without editing JSON. Choose **Save and preview** for invented sample submissions, or **Save to FileMaker** for real submissions. The latter names the connection, database and layout in a native confirmation; choose **Enable FileMaker saves** to open the private browser form. Submitting that form creates a real record.
 
-Reopen **Create FM Web App** to continue editing the saved app. Sample preview creates no records. Real registrations use only the confirmed connection, layout and mapped fields, with workspace trust, offline and write-policy checks; credentials stay in the extension. A persisted submission identifier prevents a completed or uncertain write from being dispatched again after restarting the preview. If a result is uncertain, check FileMaker before starting a new submission. Use **Choose FileMaker fields** in the editor to replace sample fields or select fields again. Your saved app stays unchanged until you save the replacement. **Export app** creates an editable app folder, not a public deployment. See [Create FM Web App](./FM_WEB.md#create-fm-web-app) for the complete flow.
+Reopen **Create FM Web App** to continue editing the saved app. Sample preview creates no records. Real submissions use only the confirmed connection, layout and mapped fields, with workspace trust, offline and write-policy checks; credentials stay in the extension. A persisted submission identifier prevents a completed or uncertain write from being dispatched again after restarting the preview. If a result is uncertain, check FileMaker before starting a new submission. Use **Choose FileMaker fields** in the editor to replace sample fields or select fields again, or **Draft form from a prompt** to describe the form in words instead. Your saved app stays unchanged until you save the replacement. **Export app** creates an editable app folder, not a public deployment. See [Create FM Web App](./FM_WEB.md#create-fm-web-app) for the complete flow.
 
 The following commands remain available for advanced projects, existing workflows and source-layout editing. **Build a Portal** also retains its earlier JSON-based starter and repair actions.
 
diff --git a/extension/docs/walkthroughs/create-web-app.md b/extension/docs/walkthroughs/create-web-app.md
index 07982b5..2430b2d 100644
--- a/extension/docs/walkthroughs/create-web-app.md
+++ b/extension/docs/walkthroughs/create-web-app.md
@@ -1,10 +1,14 @@
 # Create an FM Web app
 
-Run **FileMaker: Create FM Web App**, or use the new-file button above Connections.
+Run **FileMaker: Create FM Web App**, or use the new-file button above Connections. If no folder is open yet, the wizard offers to open one and picks up where it left off afterwards.
 
-Choose FileMaker fields from a saved connection and layout, or start with sample fields. Select the registration fields, then edit the event title, branding, labels, required rules and choices in the form editor. Use Move up and Move down to arrange fields.
+Choose a starter, **Event Registration** or **Feedback or Request Form**. The starter names the saved app, so choosing the same starter again reopens it instead of starting over.
 
-Choose **Save and preview** for an invented-data sample, or **Save to FileMaker** to accept real registrations. The latter saves the app and names the connection, database and layout in a native confirmation. Choose **Enable FileMaker saves**, then submit the private browser form to create a real record. Credentials stay in the extension. Return to **Create FM Web App** to continue editing the saved app.
+Choose **Try sample fields** to start with invented data and no connection, or **Use FileMaker fields** from a saved connection and layout. Select the fields, then edit the title, branding, labels, required rules and choices in the form editor. Use Move up and Move down to arrange fields.
+
+Choose **Draft form from a prompt** to describe the fields you want. Pick a FileMaker layout, review the suggested mappings, and adjust the draft in the form editor. Suggestions use field metadata and the extension matches them on your computer.
+
+Choose **Save and preview** for an invented-data sample, or **Save to FileMaker** to accept real submissions. The latter saves the app and names the connection, database and layout in a native confirmation. Choose **Enable FileMaker saves**, then submit the private browser form to create a real record. Credentials stay in the extension. Return to **Create FM Web App** to continue editing the saved app.
 
 A repeated submission identifier reuses its original receipt after success. An uncertain write is never retried automatically, even after restarting the preview; check FileMaker before starting a new submission.
 
diff --git a/extension/scripts/mock/ENDPOINTS.md b/extension/scripts/mock/ENDPOINTS.md
index 6beb99f..46a5b2b 100644
--- a/extension/scripts/mock/ENDPOINTS.md
+++ b/extension/scripts/mock/ENDPOINTS.md
@@ -5,6 +5,9 @@ This file lists the Claris FileMaker Data API surface as documented, and what th
 
 ## Running it
 
+Use the mock only with synthetic data and the demo accounts below. It listens on loopback, logs request bodies,
+and keeps records in memory. Restarting or resetting discards writes.
+
 ```bash
 cd extension
 npm run mock:server        # http://127.0.0.1:18080 (PORT=0 picks a free port); prints a MOCK_READY JSON line
@@ -174,6 +177,7 @@ tested against the URL path); `{ "clear": true }` removes all; `GET /__admin/fau
 | `status-413`, `-429` (`retryAfter`), `-502`, `-503`, `-504`                    | that status with an HTML gateway page                                                |
 | `slow` (`delayMs`)                                                             | hold the response                                                                    |
 | `drop-mid-response`, `reset-connection`                                        | close the socket after the headers / immediately                                     |
+| `drop-after-create`                                                            | commit a successful record creation, then close the socket before replying           |
 | `data-api-disabled`                                                            | HTML 404 for every `/fmi/data` path                                                  |
 | `messages-nonzero-200` (`code`)                                                | HTTP 200 whose `messages[0].code` is not 0                                           |
 | `find-no-match-500`                                                            | a find with no match answers 500 / 401 instead of 404 / 401                          |
@@ -181,6 +185,18 @@ tested against the URL path); `{ "clear": true }` removes all; `GET /__admin/fau
 | `field-readonly` (`field`)                                                     | writing that field answers 201                                                       |
 | `script-error`, `script-error-after-edit`, `script-huge-result`, `script-slow` | script endpoint error code 3 / scriptError 3 after a save / 2 MB result / 20 s delay |
 
+To exercise an uncertain registration outcome, add the following configuration through `POST /__admin/fault` before
+submitting a form against the local mock:
+
+```json
+{"name":"drop-after-create","count":1,"path":"/databases/Sales/layouts/Contacts/records$"}
+```
+
+The mock consumes this fault only after a matching create succeeds, including creates through the mock proxy.
+Find the record using a synthetic field value and check `GET /__admin/log` for one create marked
+`fault: "drop-after-create"`. Reads and rejected creates do not consume the fault. The next create succeeds
+normally once its count is exhausted.
+
 Other admin calls: `POST /__admin/account {name, password?}` changes an account (the stored password "goes bad"),
 `POST /__admin/reset-accounts`, `POST /__admin/many {db, n}` creates layout `Big` with `n` records, `POST /__admin/schema` adds/removes a field or renames a layout.
 Extra accounts: `viewer`/`viewpass1` (reads; writes refused with 200 / 205 / 9; field `Email` hidden), `limited`/`limitpass1` (sees only layout `Contacts`).
diff --git a/extension/src/commands/createFmWebApp.ts b/extension/src/commands/createFmWebApp.ts
index 396fb18..5037e9b 100644
--- a/extension/src/commands/createFmWebApp.ts
+++ b/extension/src/commands/createFmWebApp.ts
@@ -1,15 +1,19 @@
 import * as vscode from 'vscode';
-import { eventRegistrationExample, type IntakeDefinition, type LayoutDefinition } from '@fmweb/shared';
+import { eventRegistrationExample, intakeStarters, starterById, type IntakeDefinition, type IntakeStarter, type LayoutDefinition } from '@fmweb/shared';
 import { designerLayoutMetadata } from '../fmweb/fieldMetadata';
 import { FmWebAppPanel } from '../webviews/fmWebApp';
 import { FmWebIntakeService, type SavedIntake } from '../services/fmWebIntakeService';
 import { registrationAppFromFields, writableAppFields } from '../services/fmWebAppModel';
+import { MAX_FORM_PROMPT_LENGTH, suggestPromptFields } from '../services/fmWebPromptDraft';
 import type { FMClient } from '../services/fmClient';
 import type { FmWebProjectService } from '../services/fmWebProjectService';
 import type { FmWebRuntimeGenerator } from '../services/fmWebRuntimeGenerator';
 import type { ProfileStore } from '../services/profileStore';
 import type { ConnectionProfile } from '../types/fm';
 
+/** The key the pending first-run wizard is stored under while a folder is opened. */
+export const PENDING_FIRST_RUN_KEY = 'filemaker.pendingFirstRunWizard';
+
 interface CreateAppDependencies {
   context: vscode.ExtensionContext;
   project: FmWebProjectService;
@@ -18,7 +22,18 @@ interface CreateAppDependencies {
   fmClient: FMClient;
 }
 
-export interface CreateAppOptions { source?: 'filemaker'; changeSource?: boolean }
+export interface CreateAppOptions {
+  source?: 'filemaker' | 'draft';
+  changeSource?: boolean;
+  /** The starter the user picked. The wizard asks for one when this is absent. */
+  starter?: string;
+}
+
+/** The starter the wizard offers, or the one it was given. */
+function pickStarter(chosen?: string): IntakeStarter | undefined {
+  if (chosen) return starterById(chosen);
+  return undefined;
+}
 
 export async function createFmWebApp(deps: CreateAppDependencies, options: CreateAppOptions = {}): Promise<void> {
   const { context, project, generator, profileStore, fmClient } = deps;
@@ -27,7 +42,16 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
     const choice = await vscode.window.showInformationMessage('Choose a workspace folder for your FM Web app.', 'Open Folder');
     if (choice === 'Open Folder') {
       const folders = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, openLabel: 'Use app folder' });
-      if (folders?.[0]) await vscode.commands.executeCommand('vscode.openFolder', folders[0]);
+      if (folders?.[0]) {
+        // Opening a folder reloads the window, so the wizard is remembered and resumed on activation.
+        await context.globalState.update(PENDING_FIRST_RUN_KEY, true);
+        try { await vscode.commands.executeCommand('vscode.openFolder', folders[0]); }
+        catch (error) {
+          // The window did not reload, so nothing will resume it: drop the marker.
+          await context.globalState.update(PENDING_FIRST_RUN_KEY, undefined);
+          throw error;
+        }
+      }
     }
     return;
   }
@@ -38,29 +62,44 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
   assertAvailable();
   if (FmWebAppPanel.revealIfOpen()) return;
   const intakes = new FmWebIntakeService(project);
+  // The starter is the app's identity: it names the saved app, its file and its preview route.
+  let starter = pickStarter(options.starter);
+  if (options.starter && !starter) throw new Error('Choose a starter the wizard offers.');
+  if (!starter && !options.changeSource) {
+    const picked = await vscode.window.showQuickPick(intakeStarters.map((item) => ({ label: item.label, description: item.description, starter: item })), {
+      title: 'Create FM Web App · Starter', placeHolder: 'What kind of form are you making?', ignoreFocusOut: true
+    });
+    if (!picked) return;
+    starter = picked.starter;
+  }
+  const appId = starter?.id ?? 'event-registration';
   let saved: SavedIntake | undefined;
   let model: { definition: IntakeDefinition; layout: LayoutDefinition };
   let profile: ConnectionProfile | undefined;
-  try { saved = await intakes.loadForEditing('event-registration');model = saved; }
+  let draft: ReturnType<typeof suggestPromptFields> | undefined;
+  try { saved = await intakes.loadForEditing(appId);model = saved; }
   catch (error) {
     if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
     // Missing sources are an existing app needing repair, not permission to replace its definition.
-    try { await intakes.definitionPathForEdit('event-registration');throw new Error('The saved app has a missing source layout. Open Build a Portal to repair it.', { cause: error }); }
+    try { await intakes.definitionPathForEdit(appId);throw new Error('The saved app has a missing source layout. Open Build a Portal to repair it.', { cause: error }); }
     catch (existingError) { if ((existingError as NodeJS.ErrnoException).code !== 'ENOENT') throw existingError; }
   }
   if (!saved || options.changeSource) {
-    const source = options.source === 'filemaker' ? { value: 'filemaker' } : await vscode.window.showQuickPick([
-      { label: 'Use FileMaker fields', description: 'Choose a connection, layout and registration fields', value: 'filemaker' },
-      { label: 'Try sample fields', description: 'Start immediately without a FileMaker connection', value: 'sample' }
-    ], { title: 'Create FM Web App · Event registration', placeHolder: 'Where should the form fields come from?', ignoreFocusOut: true });
+    const source = options.source ? { value: options.source } : await vscode.window.showQuickPick([
+      { label: 'Try sample fields', description: 'Start immediately without a FileMaker connection', value: 'sample' },
+      { label: 'Use FileMaker fields', description: 'Choose a connection, layout and fields', value: 'filemaker' },
+      { label: 'Draft form from a prompt', description: 'Describe a form and review suggested FileMaker fields', value: 'draft' }
+    ], { title: 'Create FM Web App · Data', placeHolder: 'Where should the form fields come from?', ignoreFocusOut: true });
     if (!source) return;
-    if (source.value === 'sample') model = eventRegistrationExample();
+    if (source.value === 'sample') model = (starter?.example() ?? eventRegistrationExample());
     else {
       const profiles = await profileStore.listProfiles();
       if (!profiles.length) {
         const answer = await vscode.window.showInformationMessage('Add a FileMaker connection to choose its fields.', 'Add Connection');
         if (answer !== 'Add Connection') return;
-        await vscode.commands.executeCommand('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true });
+        await vscode.commands.executeCommand('filemakerDataApiTools.addConnectionProfile', {
+          continueToFmWebApp: true, ...(source.value === 'draft' ? { draft: true } : {}), ...(starter ? { starter: starter.id } : {})
+        });
         return;
       }
       const picked = await vscode.window.showQuickPick(profiles.map((item) => ({ label: item.name, description: item.database, profile: item })),
@@ -68,17 +107,41 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
       if (!picked) return;profile = picked.profile;
       const layouts = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Reading FileMaker layouts' }, () => fmClient.listLayouts(profile!));
       const selected = await vscode.window.showQuickPick(layouts.map((name) => ({ label: name, name })),
-        { title: 'Create FM Web App · Layout', placeHolder: 'Choose the layout containing registration fields', ignoreFocusOut: true });
+        { title: 'Create FM Web App · Layout', placeHolder: 'Choose the layout containing the fields', ignoreFocusOut: true });
       if (!selected) return;
-      const metadata = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Reading registration fields' }, () => fmClient.getLayoutMetadata(profile!, selected.name, { recordHistory: false }));
+      const metadata = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Reading fields' }, () => fmClient.getLayoutMetadata(profile!, selected.name, { recordHistory: false }));
       const all = designerLayoutMetadata(selected.name, metadata).fields;
       const writable = writableAppFields(all);
-      if (!writable.length) throw new Error('This layout has no writable, nonglobal fields. Choose a registration layout with editable fields.');
-      const fields = await vscode.window.showQuickPick(writable.map((field) => ({ label: field.name,
-        description: field.type ?? 'Text', picked: /^(?:full[ _]?name|first[ _]?name|last[ _]?name|email(?:[ _]?address)?|session|notes)$/i.test(field.name.trim()), field })),
-      { title: 'Create FM Web App · Fields', placeHolder: 'Select 1–100 registration fields. Calculations, summaries, containers and globals are excluded.', canPickMany: true, ignoreFocusOut: true });
+      if (!writable.length) throw new Error('This layout has no writable, nonglobal fields. Choose a layout with editable fields.');
+      if (source.value === 'draft') {
+        const prompt = await vscode.window.showInputBox({
+          title: 'Draft form from a prompt',
+          prompt: 'Describe the fields you want. Suggestions use this layout’s field names.',
+          placeHolder: 'Require attendee name and email, add an optional session',
+          ignoreFocusOut: true,
+          validateInput: (value) => !value.trim() ? 'Describe at least one field.'
+            : value.length > MAX_FORM_PROMPT_LENGTH ? 'Use 2,000 characters or fewer.' : undefined
+        });
+        if (!prompt?.trim() || prompt.length > MAX_FORM_PROMPT_LENGTH) return;
+        draft = suggestPromptFields(prompt, writable);
+      }
+      const suggested = new Map(draft?.fields.map((item) => [item.field.name, item]));
+      const suggestedFields = draft?.fields.map((item) => item.field) ?? [];
+      const ordered = [...suggestedFields, ...writable.filter((field) => !suggested.has(field.name))];
+      const fields = await vscode.window.showQuickPick(ordered.map((field) => ({
+        label: field.name,
+        description: suggested.has(field.name) ? 'Suggested' : field.type ?? 'Text',
+        picked: draft ? suggested.has(field.name) : /^(?:full[ _]?name|first[ _]?name|last[ _]?name|email(?:[ _]?address)?|session|notes)$/i.test(field.name.trim()),
+        field
+      })), {
+        title: draft ? 'Review suggested FileMaker fields' : 'Create FM Web App · Fields',
+        placeHolder: draft && !suggested.size
+          ? 'No confident matches. Choose the FileMaker fields for your form.'
+          : 'Select 1–100 writable fields.',
+        canPickMany: true, ignoreFocusOut: true
+      });
       if (!fields) return;
-      model = registrationAppFromFields(selected.name, fields.map((item) => item.field));
+      model = registrationAppFromFields(selected.name, fields.map((item) => item.field), { id: appId, copy: starter?.copy });
     }
   }
   if (saved && options.changeSource) {
@@ -89,6 +152,14 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
       return existing ? { ...existing, id: field.id, fmFieldName: field.fmFieldName } : field;
     }) } };
   }
+  if (draft) {
+    if (draft.title) model!.definition.title = draft.title;
+    const suggested = new Map(draft.fields.map((item) => [item.field.name, item]));
+    for (const field of model!.definition.fields) {
+      const suggestion = suggested.get(field.fmFieldName);
+      if (suggestion?.required !== undefined) field.required = suggestion.field.required === true || suggestion.required;
+    }
+  }
   assertAvailable();
   let preparedProfile = false;
   const selectedModel = model!;
@@ -107,16 +178,16 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
         saved = saved ? await intakes.saveApp(definition, saved.revision, selectedModel.layout) : await intakes.createApp(definition, selectedModel.layout);
       } else saved = await intakes.saveApp(definition, saved.revision);
     },
-    changeSource: async () => { await vscode.commands.executeCommand('filemakerDataApiTools.createFmWebApp', { source: 'filemaker', changeSource: true }); },
+    changeSource: async (source = 'filemaker') => { await vscode.commands.executeCommand('filemakerDataApiTools.createFmWebApp', { source, changeSource: true, ...(starter ? { starter: starter.id } : {}) }); },
     run: async (action) => {
       assertAvailable();
-      if (action === 'filemaker') await vscode.commands.executeCommand('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: 'event-registration', registrationMode: 'filemaker' });
-      else if (action === 'preview') await vscode.commands.executeCommand('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: 'event-registration' });
+      if (action === 'filemaker') await vscode.commands.executeCommand('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: appId, registrationMode: 'filemaker' });
+      else if (action === 'preview') await vscode.commands.executeCommand('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: appId });
       else if (action === 'layout') await vscode.commands.executeCommand('filemakerDataApiTools.openLayoutMode', { layoutId: selectedModel.layout.id });
       else {
         await vscode.commands.executeCommand('filemakerDataApiTools.generateFmWebNextApp');
         await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(generator.getGeneratedRuntimeRoot()));
       }
     }
-  });
+  }, draft);
 }
diff --git a/extension/src/commands/fmWebProject.ts b/extension/src/commands/fmWebProject.ts
index 2d6366c..05789f3 100644
--- a/extension/src/commands/fmWebProject.ts
+++ b/extension/src/commands/fmWebProject.ts
@@ -62,7 +62,7 @@ export function registerFmWebProjectCommands(
     vscode.commands.registerCommand('filemakerDataApiTools.createFmWebApp', async (arg: unknown) => {
       if (appStarting) return;
       appStarting = true;
-      try { await createFmWebApp({ context, project: fmWebProjectService, generator: fmWebRuntimeGenerator, profileStore, fmClient }, arg && typeof arg === 'object' ? { source: 'source' in arg && arg.source === 'filemaker' ? 'filemaker' : undefined, changeSource: 'changeSource' in arg && arg.changeSource === true } : {}); }
+      try { await createFmWebApp({ context, project: fmWebProjectService, generator: fmWebRuntimeGenerator, profileStore, fmClient }, arg && typeof arg === 'object' ? { source: 'source' in arg && (arg.source === 'filemaker' || arg.source === 'draft') ? arg.source : undefined, changeSource: 'changeSource' in arg && arg.changeSource === true, starter: 'starter' in arg && typeof arg.starter === 'string' ? arg.starter : undefined } : {}); }
       catch (error) { await showCommandError(error, { fallbackMessage: 'Could not create the FM Web app.', logger, logMessage: 'Create FM Web App failed.' }); }
       finally { appStarting = false; }
     }),
diff --git a/extension/src/commands/index.ts b/extension/src/commands/index.ts
index f589bbe..01811c9 100644
--- a/extension/src/commands/index.ts
+++ b/extension/src/commands/index.ts
@@ -95,7 +95,9 @@ export function registerCoreCommands(deps: RegisterCoreCommandDeps): vscode.Disp
 
       ConnectionWizardPanel.createOrShow(context, profileStore, secretStore, fmClient, logger, undefined, {
         getTestPolicy: deps.getConnectionWizardTestPolicy,
-        afterSave: arg && typeof arg === 'object' && 'continueToFmWebApp' in arg && arg.continueToFmWebApp === true ? 'createFmWebApp' : undefined
+        afterSave: arg && typeof arg === 'object' && 'continueToFmWebApp' in arg && arg.continueToFmWebApp === true
+          ? { source: 'draft' in arg && arg.draft === true ? 'draft' : 'filemaker', starter: 'starter' in arg && typeof arg.starter === 'string' ? arg.starter : undefined }
+          : undefined
       });
     }),
 
diff --git a/extension/src/extension.ts b/extension/src/extension.ts
index 6b44b7b..2aaa0ee 100644
--- a/extension/src/extension.ts
+++ b/extension/src/extension.ts
@@ -8,6 +8,7 @@ import { registerDiagnosticsCommands } from './commands/diagnostics';
 import { registerEnterpriseCommands } from './commands/enterprise';
 import { stopFmWebPreviews } from './services/fmWebPreviewProcess';
 import { registerFmWebProjectCommands } from './commands/fmWebProject';
+import { PENDING_FIRST_RUN_KEY } from './commands/createFmWebApp';
 import { registerCoreCommands } from './commands';
 import { registerHistoryCommands } from './commands/history';
 import { registerJobsCommands } from './commands/jobs';
@@ -694,6 +695,12 @@ export async function activate(context: vscode.ExtensionContext): Promise<void>
     refreshExplorer
   });
 
+  // Choosing a folder reloads the window, so the first-run wizard is resumed on activation.
+  if (context.globalState.get(PENDING_FIRST_RUN_KEY) === true) {
+    await context.globalState.update(PENDING_FIRST_RUN_KEY, undefined);
+    void vscode.commands.executeCommand('filemakerDataApiTools.createFmWebApp');
+  }
+
   const jobsStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 95);
   jobsStatusBar.command = 'filemakerDataApiTools.showJobs';
   jobsStatusBar.text = '$(history) FM Jobs: idle';
diff --git a/extension/src/services/fmWebAppModel.ts b/extension/src/services/fmWebAppModel.ts
index 909f98e..a493b1a 100644
--- a/extension/src/services/fmWebAppModel.ts
+++ b/extension/src/services/fmWebAppModel.ts
@@ -11,9 +11,23 @@ export function writableAppFields(fields: DesignerFieldMetadata[]): DesignerFiel
   });
 }
 
-export function registrationAppFromFields(layoutName: string, fields: DesignerFieldMetadata[]): { definition: IntakeDefinition; layout: LayoutDefinition } {
+export interface RegistrationAppOptions {
+  /** The starter identifier the saved app and its preview route use. */
+  id?: string;
+  /** The title, description and button text the starter's forms carry. */
+  copy?: { title: string; description: string; submitLabel: string; successMessage: string };
+}
+
+/** The copy the event registration starter's forms carry. */
+const EVENT_REGISTRATION_COPY = {
+  title: 'Event registration', description: 'Register for our event.',
+  submitLabel: 'Register', successMessage: 'Sample registration accepted. No FileMaker record was created.'
+};
+
+export function registrationAppFromFields(layoutName: string, fields: DesignerFieldMetadata[], options: RegistrationAppOptions = {}): { definition: IntakeDefinition; layout: LayoutDefinition } {
   if (!fields.length || fields.length > 100 || writableAppFields(fields).length !== fields.length) throw new Error('Choose between 1 and 100 writable, nonglobal fields.');
-  const layout = createBlankLayout('Event registration', layoutName);
+  const copy = options.copy ?? EVENT_REGISTRATION_COPY;
+  const layout = createBlankLayout(copy.title, layoutName);
   layout.canvas.width = 640;
   const inputs = fields.map((field, index) => {
     const control = standardControlFor(field);
@@ -34,9 +48,9 @@ export function registrationAppFromFields(layoutName: string, fields: DesignerFi
     return input;
   });
   layout.canvas.height = 80 * fields.length + 48;
-  const definition = intakeDefinitionSchema.parse({ schemaVersion: 1, id: 'event-registration', environmentId: 'sample',
-    layoutId: layout.id, title: 'Event registration', description: 'Register for our event.',
-    submitLabel: 'Register', successMessage: 'Sample registration accepted. No FileMaker record was created.',
+  const definition = intakeDefinitionSchema.parse({ schemaVersion: 1, id: options.id ?? 'event-registration', environmentId: 'sample',
+    layoutId: layout.id, title: copy.title, description: copy.description,
+    submitLabel: copy.submitLabel, successMessage: copy.successMessage,
     branding: { organizationName: '', accentColor: '#215EA6' }, fields: inputs });
   return { definition, layout };
 }
diff --git a/extension/src/services/fmWebIntakeService.ts b/extension/src/services/fmWebIntakeService.ts
index 11d37a8..206e344 100644
--- a/extension/src/services/fmWebIntakeService.ts
+++ b/extension/src/services/fmWebIntakeService.ts
@@ -1,4 +1,4 @@
-import { CURRENT_LAYOUT_SCHEMA_VERSION, eventRegistrationExample, intakeDefinitionSchema, intakeLayout, layoutDefinitionSchema, migrateLayoutDefinition, migrateIntakeSource, type IntakeDefinition, type LayoutDefinition } from '@fmweb/shared';
+import { CURRENT_LAYOUT_SCHEMA_VERSION, eventRegistrationExample, intakeDefinitionSchema, intakeLayout, layoutDefinitionSchema, migrateLayoutDefinition, migrateIntakeSource, starterById, type IntakeDefinition, type LayoutDefinition } from '@fmweb/shared';
 import { constants } from 'fs';
 import { createHash, randomUUID } from 'crypto';
 import { lstat, mkdir, open, readdir, realpath, rm, writeFile } from 'fs/promises';
@@ -131,7 +131,7 @@ export class FmWebIntakeService {
     const definition = intakeDefinitionSchema.parse(input);
     const parsedLayout = layoutDefinitionSchema.parse(source);
     const layout = await this.project.prepareLayout?.(parsedLayout) ?? parsedLayout;
-    if (definition.id !== 'event-registration' || definition.environmentId !== 'sample') throw new Error('Unsupported app target.');
+    if (!starterById(definition.id) || definition.environmentId !== 'sample') throw new Error('Unsupported app target.');
     intakeLayout(definition, layout);
     const definitionPath = await this.confined(path.join(this.project.getProjectRoot(), 'intakes', `${definition.id}.intake.json`));
     const layoutPath = await this.confined(path.join(this.project.getLayoutsDirPath(), `${layout.id}.layout.json`));
@@ -154,7 +154,7 @@ export class FmWebIntakeService {
   /** Explicit editor saves replace the definition atomically and refuse changes made elsewhere. */
   public async saveApp(input: unknown, revision: string, replacementSource?: unknown): Promise<SavedIntake> {
     const definition = intakeDefinitionSchema.parse(input);
-    const current = await this.loadForEditing('event-registration');
+    const current = await this.loadForEditing(definition.id);
     if (current.revision !== revision) throw new Error('The app changed in another editor. Close this app tab and run Create FM Web App to load those changes.');
     if (definition.id !== current.definition.id || (!replacementSource && definition.layoutId !== current.definition.layoutId)
       || definition.environmentId !== current.definition.environmentId) throw new Error('The editor cannot change the app target.');
@@ -183,7 +183,7 @@ export class FmWebIntakeService {
     const temporary = path.join(path.dirname(target), `.app-${randomUUID()}.tmp`);
     try {
       await writeFile(temporary, bytes, { flag: 'wx', mode: info.mode & 0o777 });
-      if ((await this.loadForEditing('event-registration')).revision !== revision) throw new Error('The app changed during Save. Close this app tab and run Create FM Web App to load those changes.');
+      if ((await this.loadForEditing(current.definition.id)).revision !== revision) throw new Error('The app changed during Save. Close this app tab and run Create FM Web App to load those changes.');
       await this.confined(target);
       if ((await lstat(target)).nlink > 1) throw new Error('The app definition acquired a hard link during Save.');
       await renameReplacing(temporary, target);
diff --git a/extension/src/services/fmWebPreviewProcess.ts b/extension/src/services/fmWebPreviewProcess.ts
index d3fb79b..3bbea6d 100644
--- a/extension/src/services/fmWebPreviewProcess.ts
+++ b/extension/src/services/fmWebPreviewProcess.ts
@@ -114,7 +114,7 @@ export class FmWebPreviewProcess implements vscode.Disposable {
   }
 
   private async launch(files: Map<string, Buffer>, layouts: Map<string, Buffer>, bridgeUrl: string, token: string, serverUrl?: string, intakes: Map<string, Buffer> = new Map(), intakeLayouts: Map<string, Buffer> = new Map(), startIntakeId?: string, registrationMode?: 'filemaker'): Promise<void> {
-    if (registrationMode === 'filemaker' && !startIntakeId) throw new Error('Real registrations require an explicit saved intake.');
+    if (registrationMode === 'filemaker' && !startIntakeId) throw new Error('Real submissions require an explicit saved intake.');
     if (startIntakeId !== undefined) {
       const validId = /^[a-z]/.test(startIntakeId) && !/[^a-z0-9_-]/.test(startIntakeId) && startIntakeId.length <= 64;
       if (!validId || !intakes.has(`${startIntakeId}.intake.json`)) throw new Error('The requested preview intake is invalid or missing.');
diff --git a/extension/src/services/fmWebPromptDraft.ts b/extension/src/services/fmWebPromptDraft.ts
new file mode 100644
index 0000000..5bf1682
--- /dev/null
+++ b/extension/src/services/fmWebPromptDraft.ts
@@ -0,0 +1,201 @@
+import type { DesignerFieldMetadata } from '../fmweb/fieldMetadata';
+import { writableAppFields } from './fmWebAppModel';
+
+export const MAX_FORM_PROMPT_LENGTH = 2000;
+
+interface FieldConcept {
+  label: string;
+  phrases: string[];
+  names: string[];
+}
+
+const CONCEPTS: FieldConcept[] = [
+  { label: 'Attendee name', phrases: ['name', 'attendee name', 'full name', 'registrant name'],
+    names: ['name', 'attendee name', 'full name', 'registrant name', 'contact name'] },
+  { label: 'First name', phrases: ['first name', 'given name'], names: ['first name', 'given name', 'forename'] },
+  { label: 'Last name', phrases: ['last name', 'family name', 'surname'], names: ['last name', 'family name', 'surname'] },
+  { label: 'Email', phrases: ['email', 'email address', 'e mail', 'e mail address'], names: ['email', 'email address', 'e mail', 'e mail address', 'contact email', 'attendee email', 'registrant email'] },
+  { label: 'Phone', phrases: ['phone', 'phone number', 'contact number', 'mobile number'], names: ['phone', 'phone number', 'contact number', 'mobile', 'mobile number', 'telephone', 'telephone number'] },
+  { label: 'Session', phrases: ['session', 'session choice', 'session preference'], names: ['session', 'session choice', 'session preference', 'workshop session', 'preferred session'] },
+  { label: 'Organization', phrases: ['organization', 'organisation', 'company'], names: ['organization', 'organisation', 'company', 'company name', 'organization name', 'organisation name'] },
+  { label: 'Dietary requirements', phrases: ['dietary requirements', 'dietary restrictions', 'dietary needs'], names: ['dietary requirements', 'dietary restrictions', 'dietary needs', 'dietary notes'] },
+  { label: 'Accessibility notes', phrases: ['accessibility notes', 'accessibility needs', 'accommodations'], names: ['accessibility notes', 'accessibility needs', 'accessibility requirements', 'accommodations'] },
+  { label: 'Notes', phrases: ['notes', 'comments', 'additional notes'], names: ['notes', 'comments', 'additional notes', 'registration notes'] }
+];
+
+export interface PromptFormDraft {
+  title?: string;
+  fields: Array<{ field: DesignerFieldMetadata; required?: boolean }>;
+  unmatched: string[];
+}
+
+/** Canonicalize for suggestions only. The returned field is always the original metadata. */
+function words(value: string): string {
+  return value.normalize('NFKC')
+    .replace(/([\p{Lu}])([\p{Lu}][\p{Ll}])/gu, '$1 $2')
+    .replace(/([\p{Ll}\d])([\p{Lu}])/gu, '$1 $2')
+    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
+}
+
+interface Mention {
+  start: number;
+  end: number;
+  label: string;
+  candidates: DesignerFieldMetadata[];
+}
+
+/** A requirement word, and whether the prompt negated it. "not required" means optional. */
+function qualifier(value: string, negated = false): boolean | undefined {
+  if (/^(?:require|required|must collect)$/.test(value)) return !negated;
+  if (/^(?:optional|optionally)$/.test(value)) return negated;
+  return undefined;
+}
+
+/** Suggest existing fields from bounded registration language. Ambiguities are left for manual mapping. */
+export function suggestPromptFields(prompt: string, fields: readonly DesignerFieldMetadata[]): PromptFormDraft {
+  if (prompt.length > MAX_FORM_PROMPT_LENGTH) throw new Error('Describe your form in 2,000 characters or fewer.');
+  const explicitTitle = /\b(?:titled|called)\s+["“]([^"”\r\n]{1,160})["”]/i.exec(prompt);
+  // The captured descriptor must not be the article itself, so "Make a form." has no title rather than "A".
+  const openingTitle = /^\s*(?:build|create|draft|make)\s+(?:(?:a|an|the)\s+)?((?!(?:a|an|the)\s+form\b)[^.;!?\r\n]{1,160}?)\s+form\b/i.exec(prompt);
+  const opening = openingTitle?.[1]?.trim();
+  const title = explicitTitle?.[1]?.trim() || (opening ? opening.charAt(0).toUpperCase() + opening.slice(1) : undefined);
+  // The opening title stays in the field prompt: "Make a name and email form." names two fields as well as a
+  // title, and dropping it would lose them. An explicitly quoted title is a title, so it is removed.
+  const fieldPrompt = prompt.replace(explicitTitle?.[0] ?? '', '');
+  const draft: PromptFormDraft = { title, fields: [], unmatched: [] };
+  const writable = writableAppFields([...fields]);
+  const byName = new Map<string, DesignerFieldMetadata[]>();
+  for (const field of writable) {
+    const name = words(field.name);
+    if (!name) continue;
+    const matches = byName.get(name) ?? [];
+    matches.push(field);
+    byName.set(name, matches);
+  }
+  const concepts = new Map(CONCEPTS.flatMap((concept) => [...concept.phrases, ...concept.names].map((phrase) => [phrase, concept] as const)));
+  const append = (mention: Mention, required?: boolean): void => {
+    const field = mention.candidates.length === 1 ? mention.candidates[0] : undefined;
+    const existing = field && draft.fields.find((entry) => entry.field.name === field.name);
+    if (existing) {
+      if (required !== undefined) existing.required = required;
+      return;
+    }
+    if (!field || draft.fields.length === 100) {
+      if (!draft.unmatched.includes(mention.label)) draft.unmatched.push(mention.label);
+      return;
+    }
+    draft.fields.push({ field, required });
+  };
+
+  // Keep punctuation inside explicitly quoted FileMaker names intact. The closing quote is optional so an
+  // unterminated quote stays in its clause instead of splitting it and losing the instruction before it.
+  const clauses = fieldPrompt.match(/(?:["“][^"”\r\n]*["”]?|[^"“;.!?,\r\n])+|[;.!?,\r\n]/g) ?? [];
+  let inherited: boolean | undefined;
+  let negated: 'exclude' | 'optional' | undefined;
+  // A coordinated item ("and notes", ", notes") inherits the polarity of the list's anchor. The anchor starts
+  // as the list head and moves to a clause that ends positive, so a negation inside the list does not swallow
+  // a later coordinated request, while an explicit reversal ("but include ...") carries the items after it.
+  let anchorNegated: 'exclude' | 'optional' | undefined;
+  let headPending = true;
+  let comma = false;
+  for (const raw of clauses) {
+    if (/^[;.!?\r\n]$/.test(raw)) {
+      inherited = undefined;
+      negated = undefined;
+      comma = false;
+      anchorNegated = undefined;
+      headPending = true;
+      continue;
+    }
+    if (raw === ',') { comma = true;continue; }
+    if (!raw.trim()) continue;
+    // A clause after the head starts from the anchor's polarity; its own directives then adjust it.
+    if (!headPending) negated = anchorNegated;
+    const quotes: string[] = [];
+    // The marker is outside the output alphabet of words(), so literal input cannot impersonate it.
+    const clause = raw.split(/(["“][^"”]+["”])/g).map((part, index) => {
+      if (index % 2 === 0) return words(part);
+      quotes.push(part.slice(1, -1));
+      return `\0${quotes.length}\0`;
+    }).filter(Boolean).join(' ');
+    const mentions: Mention[] = [];
+    for (const [index, name] of quotes.entries()) {
+      const marker = `\0${index + 1}\0`;
+      const start = clause.indexOf(marker);
+      const candidates = writable.filter((field) => field.name === name);
+      mentions.push({ start, end: start + marker.length, label: name, candidates });
+    }
+    // Pick the longest phrase at each position. A narrower match such as "notes" cannot steal "accessibility notes".
+    const tokens = clause.split(' ');
+    let start = 0;
+    for (let index = 0; index < tokens.length; index++) {
+      const token = tokens[index]!;
+      if (mentions.some((mention) => mention.start === start)) { start += token.length + 1;continue; }
+      let phrase = token;
+      let match: Mention | undefined;
+      for (let end = index; end < tokens.length && end < index + 12; end++) {
+        if (end > index) phrase += ' ' + tokens[end]!;
+        const concept = concepts.get(phrase);
+        const exact = byName.get(phrase);
+        if (concept || exact) {
+          const candidates = concept
+            ? [...new Set(concept.names.flatMap((name) => byName.get(name) ?? []))]
+            : exact!;
+          match = { start, end: start + phrase.length, label: concept?.label ?? exact![0]!.name, candidates };
+        }
+      }
+      if (match) mentions.push(match);
+      start += token.length + 1;
+    }
+    mentions.sort((left, right) => left.start - right.start || right.end - left.end);
+    let previousEnd = 0;
+    for (const [index, mention] of mentions.entries()) {
+      if (mention.start < previousEnd) continue;
+      const before = clause.slice(previousEnd, mention.start).trim();
+      const after = clause.slice(mention.end, mentions.slice(index + 1).find((next) => next.start >= mention.end)?.start).trim();
+      const isContinuation = /^and$/.test(before) || (comma && !before);
+      // Negation continues through "or collect" and ends at an explicit positive instruction.
+      // A bare "not" negates a field ("include email but not phone"). It does not negate a requirement
+      // ("not required", "not strictly required") and it is not an emphatic inclusion ("not only", "not just").
+      const directives = /\b(?:(do not|don t|dont|never|not(?!\s+(?:only|just|merely|simply)\b)(?!\s+(?:\w+\s+)?(?:required|optional)\b))(?:\s+(includ(?:e|es|ed|ing)|add(?:s|ed|ing)?|collect(?:s|ed|ing)?|requir(?:e|es|ing)|ask(?:s|ed|ing)? for))?|(exclud(?:e|es|ed|ing)|omit(?:s|ted|ting)?|without|skip(?:s|ped|ping)?|no(?: need for)?|leaving out|except)|(or\s+)?(but|includ(?:e|es|ed|ing)|add(?:s|ed|ing)?|collect(?:s|ed|ing)?|requir(?:e|es|ing)|ask(?:s|ed|ing)? for))\b/g;
+      for (const directive of before.matchAll(directives)) {
+        if (directive[1] || directive[3]) {
+          negated = directive[2] === 'require' ? 'optional' : 'exclude';
+        } else if (directive[4] && negated && directive[5] !== 'but') {
+          negated = directive[5] === 'require' ? 'optional' : 'exclude';
+        } else {
+          negated = undefined;
+        }
+      }
+      // The head clause's own polarity starts the list's anchor.
+      if (headPending) { anchorNegated = negated; headPending = false; }
+      const prefix = /\b(not\s+(?:\w+\s+)?)?(require|required|must collect|optional|optionally)\s*(?:(?:an?|the)\s*)?$/.exec(before);
+      const suffix = /^(?:(?:is|are|as)\s+)?(not\s+(?:\w+\s+)?)?(required|optional)\b/.exec(after);
+      const requirement = qualifier((prefix ?? suffix)?.[2] ?? '', Boolean((prefix ?? suffix)?.[1]));
+      if (!negated) {
+        append(mention, requirement ?? (isContinuation ? inherited : undefined));
+      } else if (negated === 'exclude') {
+        if (mention.candidates.length === 1) {
+          const name = mention.candidates[0]!.name;
+          draft.fields = draft.fields.filter(({ field }) => field.name !== name);
+        }
+        draft.unmatched = draft.unmatched.filter((label) => label !== mention.label);
+      } else if (mention.candidates.length === 1) {
+        const existing = draft.fields.find(({ field }) => field.name === mention.candidates[0]!.name);
+        if (existing) existing.required = false;
+      }
+      previousEnd = mention.end;
+      comma = false;
+      // Only a forward-scoped list requirement carries to the next coordinated item. An exclusion says nothing
+      // about how mandatory the rest of the list is, so it does not end the requirement scope: "Require email,
+      // don't include phone, and notes." keeps notes with the required head of the list.
+      if (!negated) {
+        if (requirement === false || (!isContinuation && !prefix)) inherited = undefined;
+        else if (prefix) inherited = requirement;
+      }
+    }
+    // A clause that ends positive becomes the anchor for the items coordinated with it.
+    if (negated === undefined) anchorNegated = undefined;
+  }
+  return draft;
+}
diff --git a/extension/src/services/fmWebRuntimeGenerator.ts b/extension/src/services/fmWebRuntimeGenerator.ts
index 47349b9..793b5e1 100644
--- a/extension/src/services/fmWebRuntimeGenerator.ts
+++ b/extension/src/services/fmWebRuntimeGenerator.ts
@@ -147,13 +147,13 @@ export const SHIPPED_MARKED_HASHES: Record<string, string[]> = {
 
 /** Known generated shared sources (including generated package.json). Keep prior identities when updating. */
 export const SHIPPED_SHARED_HASHES: Record<string, string[]> = {
-  'src/intake-starters.ts': ['1f7bccc0f7dfb6025cc82e44dc86ea5e0a83e660116d09960c93e762fe653b2a'],
+  'src/intake-starters.ts': ['1f7bccc0f7dfb6025cc82e44dc86ea5e0a83e660116d09960c93e762fe653b2a', 'bc6791710fae65a0ba5ea6429db6cc8780cc5d8766f6adf048916823eefc037d', '2a464f2ed137dcdc677214245e29d64626e327aa94ea2ab62fec13a325167af2', 'fbde56291fa2e796e3232feb4d0a9945e948d7340d72075a83a6c1fb3ba8cb0a'],
   'src/field-order.ts': ['2c1a5d992d4daf838e2d13c43b1939043a4163eb13af4eae0cbddf6ad27ec966', '3b60a97a6b9b023be8d7e3d86d4c7cc0125e3f6bd9bde2db8ca7706b063e6bfa'],
   'src/layout-schema.ts': ['e7f4b45780facf95f8250a74b4e60afd27c5af455ee015e879fa062e69f0d63b', '5f19d99380319c6c1e1352730784559dbb23ba03da792bcdf9fc7118be024129', '1a1f837967649e78baa192dc0d735e026a1349080d7dfe9000e4aa8d8aa044cd', 'cb6a8e7c5c79fdde431b3e004fb1ae4897ce7a481712370ed545ff5d36ec9a38'],
   'src/ui-renderer.tsx': ['485d4b2022d64ac21ebcd36c58f57792e36b448a7fec9b9a6a2eeb1373a522ab', 'dea92786b52f47ddbd02a1f0b4f34c73155303a9725e06cbcf2a3ade8301e0c7', '72926b784cc27a5d5046b448797b25b80a30f1af8fe12d70ef2d8061b2746728', '083c1a277145bbe9b08e36f5020322dd95d32766ac6c7ae8730a2e392594f082', 'ce2223340e0dd67a0b74e8fe0604d5cbd7f73011728442df09c8566afbf3780a', '9d1998bddce48ddcb138c3d606a30091db89e8c30d5688ed641bbf91de1fded2', 'd261d2c2e95c8414dfa402f90a3169ee4623c0e5dc0281cef7c393229427f230', 'b22bc542cad58058be38eea520684a5e52c5d457b196cfb426123f4bd274cccf', 'f95fe0fdf2e60fb0afb59e2a742f59e4afe3f97c6398cc881f3b4ffc33c64f2b'],
   'src/field-standards.ts': ['dbd9dcbac9791a895962a977c37a3f3602729f0903c8ccbda05f40fc873421cf', '94b0eadb1666dce9e7f98ae43effde612dbab49cbdccfa80cf819de80dbb7547', '3ff4a3d7ae593c0edc13ccd41007f7a56d9bba620bbebaf26f960068c487ad82', 'afd81a07b641a620894238a0383c1fca55f265b5e0484ebd6d1ab644aa343a5e', 'e5ac70259470aea19e72065ed9150f8802e998a5f01e75231941c6b75aed7bfd', '6778e726e0ca9e1351bf9df86c4ad2dd60e7ea38d3c4cb8598475bdc35fc57af'],
   'src/record-edit.ts': ['6f3b044bb3fbbbc00f80ce85761d2c8f02daa874ad62e310c7ba6e5c7b12132c', '8ec99479832ae7f19bd3d34027a014e02db6ebeb2b05d20f29685ab6a04639d3', 'b44afc69a6766e1bbc06ed12f46ad8402075454505eb04a0fb077b71d3e87e51', '7d1308d3c1e015448c4f420ca9549cad84d3b8247b65f16d7f78f7b8376f9c44', 'a19ca01072fa6c0309fcf077c7801f024b307cd4ee918c7cc796a005d44171fb', 'ca68a1755203a2343568128ed51bc13695f899e850d68b9cc839addee0b2f5bd', '96035065dfe20a4a53608cef6ed74af438ab4ab349204f88c7a0f158c31bd37d', '65bf659996a5cfd1778f6011a102c8c149e3f25a7a3f6201b79fdc37bc351c1e'],
-  'src/index.ts': ['a78e69d0c2565173c08ca580ebd1f640e9c6fcecee7cecf58a36ce2a82ad96c2', '06c864f496f814f388ecf810d7ccff61b81ebcb434b45b46ed19a0ccf0fdb201', '343e6054fb7cc512f235739c53d9e19768e90960ca038f17f1fd795717c0df46', 'd2a391e29938de24f23bc6ca138f51609c35ba99311b9e32878a5937165d2952', '550ce92a0e8e7c28b49eb84db49a10788f217ea201519c2bd25ab70642040c31'],
+  'src/index.ts': ['a78e69d0c2565173c08ca580ebd1f640e9c6fcecee7cecf58a36ce2a82ad96c2', '06c864f496f814f388ecf810d7ccff61b81ebcb434b45b46ed19a0ccf0fdb201', '343e6054fb7cc512f235739c53d9e19768e90960ca038f17f1fd795717c0df46', 'd2a391e29938de24f23bc6ca138f51609c35ba99311b9e32878a5937165d2952', '550ce92a0e8e7c28b49eb84db49a10788f217ea201519c2bd25ab70642040c31', '8c8f08ae77705c0b8368916230d8a08dcf0547ed992e5cfee4223126b513af09'],
   'package.json': ['304d3c7084ac8c0d59f83461fbdf4cb97feb64f9a19062ed8345e520b637247c', 'bb0fcb4d253b13d7116c659da2be09774b674c10a8b82823d08e5acf88c64c82', 'dfc8712f1dc893048abc19198115d700c816667d739d6811a77b8e899b24b33f'],
   'src/intake.ts': ['ba3cd6806344732c37b75c7129174937508fe62a176b7758d211cdd081fbdc9f', '240f97dfd483001d52d8e1d6a35fbaa93fd68fdb51ec3e886081f7e5c8d377da', 'e120a48607496e4abb473f4b8fe85cc7382ede427d8a710e2d8b65cac7e6dd27', '24fc9e0dad86d1add5bc303d93158875edab601529e1c9edfdc24b3a467a1840', 'f64a8842f7adee76b75cb6a27caeb0d898c28cec09d6940c17748d89c8f5caef']
 };
diff --git a/extension/src/webviews/connectionWizard/save.ts b/extension/src/webviews/connectionWizard/save.ts
index 89e4249..7ae520f 100644
--- a/extension/src/webviews/connectionWizard/save.ts
+++ b/extension/src/webviews/connectionWizard/save.ts
@@ -129,9 +129,10 @@ export async function handleSave(ctx: WizardContext, data: WizardFormData): Prom
       message: `Profile "${profile.name}" saved.`
     });
 
-    if (isNewProfile && ctx.options.afterSave === 'createFmWebApp') {
+    if (isNewProfile && ctx.options.afterSave) {
+      const continuation = ctx.options.afterSave;
       ctx.options.afterSave = undefined;
-      await vscode.commands.executeCommand('filemakerDataApiTools.createFmWebApp', { source: 'filemaker', changeSource: true });
+      await vscode.commands.executeCommand('filemakerDataApiTools.createFmWebApp', { source: continuation.source, changeSource: true, ...(continuation.starter ? { starter: continuation.starter } : {}) });
       return;
     }
 
diff --git a/extension/src/webviews/connectionWizard/types.ts b/extension/src/webviews/connectionWizard/types.ts
index df9015d..d253699 100644
--- a/extension/src/webviews/connectionWizard/types.ts
+++ b/extension/src/webviews/connectionWizard/types.ts
@@ -8,7 +8,7 @@ export type ConnectionWizardTestPolicy = 'off' | 'warn' | 'block';
 
 export interface ConnectionWizardOptions {
   /** One-shot continuation after credentials have been saved successfully. */
-  afterSave?: 'createFmWebApp';
+  afterSave?: { source: 'filemaker' | 'draft'; starter?: string };
   /** Resolved at message time so settings updates flow live. */
   getTestPolicy?: () => ConnectionWizardTestPolicy;
 }
diff --git a/extension/src/webviews/fmWebApp/index.ts b/extension/src/webviews/fmWebApp/index.ts
index 52bcf39..165f327 100644
--- a/extension/src/webviews/fmWebApp/index.ts
+++ b/extension/src/webviews/fmWebApp/index.ts
@@ -8,7 +8,7 @@ export interface AppEditorActions {
   save(definition: IntakeDefinition): Promise<void>;
   run(action: 'preview' | 'export' | 'layout' | 'filemaker'): Promise<void>;
   assertAvailable(): void;
-  changeSource?(): Promise<void>;
+  changeSource?(source?: 'filemaker' | 'draft'): Promise<void>;
 }
 
 export class FmWebAppPanel {
@@ -22,13 +22,13 @@ export class FmWebAppPanel {
     this.current.panel.reveal(vscode.ViewColumn.One);return true;
   }
 
-  static open(context: vscode.ExtensionContext, definition: IntakeDefinition, layout: LayoutDefinition, actions: AppEditorActions): void {
+  static open(context: vscode.ExtensionContext, definition: IntakeDefinition, layout: LayoutDefinition, actions: AppEditorActions, draft?: { unmatched: string[] }): void {
     if (this.revealIfOpen()) return;
-    const panel = vscode.window.createWebviewPanel('filemakerFmWebApp', 'FM Web App — Event registration', vscode.ViewColumn.One,
+    const panel = vscode.window.createWebviewPanel('filemakerFmWebApp', `FM Web App — ${definition.title}`, vscode.ViewColumn.One,
       { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webviews', 'fmWebApp', 'ui')] });
     const editor = new FmWebAppPanel(panel, definition, layout, actions);
     this.current = editor;context.subscriptions.push(panel);
-    panel.webview.html = renderAppEditor(panel.webview, context, definition, editor.fields, layout.fmLayoutName);
+    panel.webview.html = renderAppEditor(panel.webview, context, definition, editor.fields, layout.fmLayoutName, draft);
   }
 
   private constructor(private readonly panel: vscode.WebviewPanel, private readonly original: IntakeDefinition,
@@ -45,16 +45,17 @@ export class FmWebAppPanel {
       this.actions.assertAvailable();
       if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('Invalid app editor request.');
       const request = message as Record<string, unknown>;
-      if (!['save', 'preview', 'export', 'layout', 'source', 'filemaker'].includes(String(request.action))
+      if (!['save', 'preview', 'export', 'layout', 'source', 'draft', 'filemaker'].includes(String(request.action))
         || Object.keys(request).some((key) => !['action', 'definition'].includes(key))) throw new Error('Unsupported app editor action.');
-      if (request.action === 'source') {
-        const answer = await vscode.window.showWarningMessage('Choose a new field source? Unsaved edits in this tab will be discarded. Your saved app stays unchanged until you save the replacement.', { modal: true }, 'Choose fields');
-        if (answer === 'Choose fields') { this.panel.dispose();await this.actions.changeSource?.(); }
+      if (request.action === 'source' || request.action === 'draft') {
+        const label = request.action === 'draft' ? 'Draft form' : 'Choose fields';
+        const answer = await vscode.window.showWarningMessage(`${label}? Unsaved edits in this tab will be discarded. Your saved app stays unchanged until you save the replacement.`, { modal: true }, label);
+        if (answer === label) { this.panel.dispose();await this.actions.changeSource?.(request.action === 'draft' ? 'draft' : undefined); }
         else await this.panel.webview.postMessage({ type: 'saved', message: 'Field source unchanged. Your edits remain in this tab.' });
         return;
       }
       const checked = intakeDefinitionSchema.safeParse(request.definition);
-      if (!checked.success) throw new Error('Check the event title, labels and character limits. Single-choice fields need 1–100 unique choices, each at most 200 characters.');
+      if (!checked.success) throw new Error('Check the form title, labels and character limits. Single-choice fields need 1–100 unique choices, each at most 200 characters.');
       const definition = checked.data;
       if (definition.id !== this.original.id || definition.layoutId !== this.original.layoutId || definition.environmentId !== this.original.environmentId
         || definition.fields.some((field) => !this.fields.some((allowed) => allowed.id === field.id && allowed.fmFieldName === field.fmFieldName))) {
@@ -70,7 +71,7 @@ export class FmWebAppPanel {
   }
 }
 
-export function renderAppEditor(webview: vscode.Webview, context: vscode.ExtensionContext, definition: IntakeDefinition, fields: IntakeField[], sourceName = 'Sample registration fields'): string {
+export function renderAppEditor(webview: vscode.Webview, context: vscode.ExtensionContext, definition: IntakeDefinition, fields: IntakeField[], sourceName = 'Sample fields', draft?: { unmatched: string[] }): string {
   const nonce = createNonce();
   const script = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'webviews', 'fmWebApp', 'ui', 'main.js'));
   const selected = new Set(definition.fields.map((field) => field.id));
@@ -79,16 +80,18 @@ export function renderAppEditor(webview: vscode.Webview, context: vscode.Extensi
 <meta http-equiv="Content-Security-Policy" content="${buildWebviewCsp(webview, { nonce, allowInlineStyleWithNonce: true })}"/>
 <title>Create FM Web App</title><style nonce="${nonce}">${standardFieldsCss(true)}
 body{max-width:1000px;margin:0 auto;padding:24px}label{display:block;margin-top:12px}input,select,textarea{box-sizing:border-box;max-width:100%;width:100%}input[type=checkbox]{width:auto}fieldset{margin:16px 0;padding:16px;border:1px solid var(--vscode-panel-border)}.actions{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.field-title{display:flex;align-items:center;gap:8px}.field-title label{margin:0}.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}.wide{grid-column:1/-1}code{white-space:pre-wrap;overflow-wrap:anywhere}button{cursor:pointer}#status{white-space:pre-wrap}#status.error{color:var(--vscode-errorForeground)}@media(max-width:600px){.field-grid{grid-template-columns:1fr}}
-</style></head><body class="fm-page"><h1>Create FM Web App</h1><p>Event registration · Select fields, customize your form, then save and preview.</p><p>Field layout: <strong>${escapeHtml(sourceName)}</strong></p>
-<p role="note">Save and preview uses sample registrations. Save to FileMaker enables real record creation only after you confirm the connection and layout in VS Code.</p>
-<form id="app-form"><button type="button" data-action="source">Choose FileMaker fields</button><fieldset><legend>Event and branding</legend>
-${input('title', 'Event title', definition.title, 160)}
+</style></head><body class="fm-page"><h1>Create FM Web App</h1><p>Select fields, customize your form, then save and preview.</p><p>Field layout: <strong>${escapeHtml(sourceName)}</strong></p>
+<p role="note">Save and preview uses sample submissions. Save to FileMaker enables real record creation only after you confirm the connection and layout in VS Code.</p>
+${draft ? '<p role="note">Review the suggested field mappings and required settings before saving.</p>' : ''}
+${draft?.unmatched.length ? `<p>Check these requests against your FileMaker fields: ${escapeHtml(draft.unmatched.join(', '))}.</p>` : ''}
+<form id="app-form"><button type="button" data-action="source">Choose FileMaker fields</button><button type="button" data-action="draft">Draft form from a prompt</button><fieldset><legend>Form and branding</legend>
+${input('title', 'Form title', definition.title, 160)}
 <label for="description">Description</label><textarea id="description" maxlength="2000">${escapeHtml(definition.description)}</textarea>
 <label for="organization">Organization</label><input id="organization" maxlength="120" value="${escapeHtml(definition.branding?.organizationName ?? '')}"/>
 <label for="accent">Accent color</label><input id="accent" type="color" value="${escapeHtml(definition.branding?.accentColor ?? '#215EA6')}"/>
 ${input('submit-label', 'Submit button text', definition.submitLabel, 80)}
 ${input('success-message', 'Success message', definition.successMessage, 1000)}
-</fieldset><h2>Registration fields</h2><p>Uncheck fields to exclude them. Use Move up or Move down to change their order. FileMaker names stay unchanged.</p>
+</fieldset><h2>Form fields</h2><p>Uncheck fields to exclude them. Use Move up or Move down to change their order. FileMaker names stay unchanged.</p>
 <div id="fields">${fields.map((field, index) => `<fieldset class="app-field" data-field="${index}"><legend>${escapeHtml(field.label)}</legend>
 <div class="field-title"><input type="checkbox" id="include-${index}" class="include" ${selected.has(field.id) ? 'checked' : ''}/><label for="include-${index}">Include field</label></div><p>FileMaker field: <code>${escapeHtml(field.fmFieldName)}</code></p>
 <div class="field-grid"><div><label for="label-${index}">Label</label><input id="label-${index}" class="field-label" maxlength="200" required value="${escapeHtml(field.label)}"/></div>
diff --git a/extension/src/webviews/fmWebApp/ui/main.js b/extension/src/webviews/fmWebApp/ui/main.js
index 75412d4..1f9a900 100644
--- a/extension/src/webviews/fmWebApp/ui/main.js
+++ b/extension/src/webviews/fmWebApp/ui/main.js
@@ -38,7 +38,9 @@
   form.addEventListener('submit', event => { event.preventDefault();send('save'); });
   form.addEventListener('click', event => {
     const button = event.target.closest('button');if (!button || busy) return;
-    if (button.dataset.action === 'source') { vscode.postMessage({ action: 'source' });return; }
+    if (button.dataset.action === 'source' || button.dataset.action === 'draft') {
+      vscode.postMessage({ action: button.dataset.action });return;
+    }
     if (button.dataset.action) send(button.dataset.action);
     if (button.dataset.move) {
       const row = button.closest('.app-field');
diff --git a/extension/test/integration/fmWebRegistration.mock.test.ts b/extension/test/integration/fmWebRegistration.mock.test.ts
new file mode 100644
index 0000000..9b5d716
--- /dev/null
+++ b/extension/test/integration/fmWebRegistration.mock.test.ts
@@ -0,0 +1,104 @@
+import { randomUUID } from 'node:crypto';
+import { mkdtemp, rm } from 'node:fs/promises';
+import { tmpdir } from 'node:os';
+import path from 'node:path';
+import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
+import { FMClient } from '../../src/services/fmClient';
+import { registrationAppFromFields } from '../../src/services/fmWebAppModel';
+import { FmWebRegistrationService } from '../../src/services/fmWebRegistrationService';
+import { SecretStore } from '../../src/services/secretStore';
+import type { ConnectionProfile } from '../../src/types/fm';
+import { InMemorySecretStorage } from '../unit/mocks';
+import { api, type RunningMock, startMockProcess } from '../unit/mockServer/mockHelper';
+
+const recordPath = '/layouts/Contacts/records';
+let mock: RunningMock;
+beforeAll(async () => { mock = await startMockProcess({ TLS: 'off', ADMIN_PORT: '0' }); }, 30000);
+afterAll(async () => mock?.stop());
+
+async function armPostCreateDrop() {
+  const response = await fetch(mock.adminUrl + '/__admin/fault', {
+    method: 'POST',
+    headers: { 'Content-Type': 'application/json' },
+    body: JSON.stringify({
+      name: 'drop-after-create',
+      count: 1,
+      path: '/databases/Sales/layouts/Contacts/records$'
+    })
+  });
+  expect(response.status).toBe(200);
+  await response.json();
+}
+
+describe('registration over the running mock FileMaker Data API', () => {
+  it.each(['direct', 'proxy'] as const)(
+    'preserves one committed record when the %s client loses the create reply',
+    async (authMode) => {
+      const root = await mkdtemp(path.join(tmpdir(), 'fm-registration-mock-'));
+      try {
+        const profile: ConnectionProfile = {
+          id: `registration-mock-${authMode}`,
+          name: 'Synthetic registration target',
+          authMode,
+          serverUrl: mock.baseUrl,
+          database: 'Sales',
+          username: 'tester',
+          proxyEndpoint: mock.proxyUrl,
+          apiBasePath: '/fmi/data',
+          apiVersionPath: 'vLatest'
+        };
+        const secrets = new SecretStore(new InMemorySecretStorage() as never);
+        await secrets.setPassword(profile.id, 'testpass1');
+        await secrets.setProxyApiKey(profile.id, 'mock-proxy-key');
+        const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
+        const client = new FMClient(secrets, logger, 5000);
+        const target = {
+          ...registrationAppFromFields('Contacts', [{ name: 'FirstName' }, { name: 'Email' }]),
+          profile,
+          ledgerRoot: path.join(root, 'receipts'),
+          assertAllowed: async () => undefined,
+          createRecord: client.createRecord.bind(client)
+        };
+        const email = `receipt-${authMode}@example.invalid`;
+        const request = {
+          intakeId: target.definition.id,
+          submissionId: randomUUID(),
+          values: { 'field-1': 'Synthetic attendee', 'field-2': email }
+        };
+
+        await armPostCreateDrop();
+        const http = api(mock.baseUrl);
+        const { token } = await http.login('Sales');
+        const rejected = await http.call('POST', '/databases/Sales' + recordPath, {
+          token, body: { fieldData: { NoSuchField: 'synthetic' } }
+        });
+        expect(rejected.body.messages[0].code).toBe('102');
+
+        const service = new FmWebRegistrationService(target);
+        expect(await service.submit(request)).toEqual({ status: 'uncertain' });
+        expect(await service.submit(request)).toEqual({ status: 'uncertain' });
+        expect(await new FmWebRegistrationService(target).submit(request)).toEqual({ status: 'uncertain' });
+
+        const stored = await client.findRecords(profile, 'Contacts', { query: [{ Email: `==${email}` }] });
+        expect(stored.data).toHaveLength(1);
+        expect(stored.data[0]?.fieldData).toMatchObject({ FirstName: 'Synthetic attendee', Email: email });
+
+        type LogEntry = { method: string; path: string; fault?: string; body?: { fieldData?: { Email?: string } } };
+        const logged = await fetch(mock.adminUrl + '/__admin/log');
+        const { log } = await logged.json() as { log: LogEntry[] };
+        const creates = log.filter((entry) => entry.method === 'POST' && entry.path === recordPath
+          && entry.body?.fieldData?.Email === email);
+        expect(creates).toMatchObject([{ fault: 'drop-after-create' }]);
+
+        const next = await service.submit({
+          ...request,
+          submissionId: randomUUID(),
+          values: { ...request.values, 'field-2': `next-${email}` }
+        });
+        expect(next).toMatchObject({ status: 'accepted', receipt: expect.stringMatching(/^fm-\d+$/) });
+      } finally {
+        await rm(root, { recursive: true, force: true });
+      }
+    }
+  );
+});
diff --git a/extension/test/mock-server/lib/engine.mjs b/extension/test/mock-server/lib/engine.mjs
index 85ee2b9..0018fd3 100644
--- a/extension/test/mock-server/lib/engine.mjs
+++ b/extension/test/mock-server/lib/engine.mjs
@@ -989,9 +989,12 @@ export function createEngine(options = {}) {
     table.rows.push(row);
     if (isPlainObject(body.portalData))
       applyPortalData(db, layout, row, body.portalData, fmt, body.options);
-    return withScripts(db, scriptParamsFrom(body, ctx.query), ctx, async () => ({
+    const result = await withScripts(db, scriptParamsFrom(body, ctx.query), ctx, async () => ({
       response: { recordId: row.recordId, modId: row.modId }
-    })).then((r) => json(okBody(r.response)));
+    }));
+    // The row is already committed. A dropped reply leaves the client unsure whether to retry.
+    if (takeFault('drop-after-create', ctx)) return { drop: true, fault: 'drop-after-create' };
+    return json(okBody(result.response));
   }
 
   function applyPortalData(db, layout, row, portalData, fmt, options) {
@@ -1346,6 +1349,7 @@ export function createEngine(options = {}) {
       code: out.json?.messages?.[0]?.code ?? code,
       ms: Date.now() - started
     };
+    if (out.fault) entry.fault = out.fault;
     if (ctx.body && typeof ctx.body === 'object' && Object.keys(ctx.body).length)
       entry.body = truncate(ctx.body);
     state.log.push(entry);
diff --git a/extension/test/mock-server/lib/proxy.mjs b/extension/test/mock-server/lib/proxy.mjs
index 6fec37f..e06d57f 100644
--- a/extension/test/mock-server/lib/proxy.mjs
+++ b/extension/test/mock-server/lib/proxy.mjs
@@ -138,6 +138,7 @@ export async function handleProxy(engine, input) {
       const r = await authed('POST', `${L(payload.layout)}/records`, {
         body: { fieldData: payload.fieldData }
       });
+      if (r.drop) return r;
       return done(r, {
         result: {
           recordId: r.json?.response?.recordId,
diff --git a/extension/test/unit/createFmWebApp.test.ts b/extension/test/unit/createFmWebApp.test.ts
index 74ddfcd..49bcb70 100644
--- a/extension/test/unit/createFmWebApp.test.ts
+++ b/extension/test/unit/createFmWebApp.test.ts
@@ -3,14 +3,14 @@ import path from 'path';
 import { tmpdir } from 'os';
 import * as vscode from 'vscode';
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
-import { eventRegistrationExample } from '@fmweb/shared';
-import { createFmWebApp } from '../../src/commands/createFmWebApp';
+import { eventRegistrationExample, type feedbackRequestExample } from '@fmweb/shared';
+import { createFmWebApp, PENDING_FIRST_RUN_KEY } from '../../src/commands/createFmWebApp';
 import { FmWebAppPanel, type AppEditorActions } from '../../src/webviews/fmWebApp';
 import { FmWebIntakeService } from '../../src/services/fmWebIntakeService';
 let root: string;
 let open: ReturnType<typeof vi.spyOn>;
 function fixture() {
-  const project = { getWorkspaceRoot: () => root, getProjectRoot: () => path.join(root, '.fmweb'),
+  const project = { getWorkspaceRoot: (): string | undefined => root, getProjectRoot: () => path.join(root, '.fmweb'),
     getLayoutsDirPath: () => path.join(root, '.fmweb', 'layouts'), isWorkspaceTrusted: () => true,
     ensureProjectInitialized: vi.fn(async () => { await mkdir(path.join(root, '.fmweb', 'layouts'), { recursive: true });return {} as never; }),
     setActiveProfile: vi.fn(async () => undefined), syncMetadata: vi.fn(async () => undefined) };
@@ -19,10 +19,11 @@ function fixture() {
     { name: 'Calc', type: 'calculation', result: 'number' }, { name: 'Global', type: 'normal', result: 'text', global: true }
   ] })) };
   const profile = { id: 'profile', name: 'Dev', database: 'Events' };
-  const deps = { context: { extensionUri: { fsPath: '/extension' }, subscriptions: [] }, project,
+  const context = { extensionUri: { fsPath: '/extension' }, subscriptions: [], globalState: { get: vi.fn(), update: vi.fn(async () => undefined) } };
+  const deps = { context, project,
     generator: { getGeneratedRuntimeRoot: () => path.join(root, '.fmweb/generated/runtime-next') },
     profileStore: { listProfiles: vi.fn(async () => [profile]) }, fmClient };
-  return { deps, project, fmClient };
+  return { deps, project, fmClient, context };
 }
 beforeEach(async () => {
   root = await mkdtemp(path.join(tmpdir(), 'fm-create-flow-'));vi.clearAllMocks();
@@ -32,14 +33,128 @@ beforeEach(async () => {
 });
 afterEach(async () => { vi.restoreAllMocks();await rm(root, { recursive: true, force: true }); });
 function actions(): AppEditorActions { return open.mock.calls[0]![3] as AppEditorActions; }
-function pickFileMaker() {
+type Picker = { label?: string; value?: string; picked?: boolean };
+/**
+ * Answer each QuickPick in turn. The first pick of a step names the wanted label;
+ * the steps after it (connection, layout) take their first item.
+ */
+function pickSequence(wanted: string[]) {
+  let index = 0;
   vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items, options) => {
-    const choices = items as unknown as Array<Record<string, unknown>>;
+    const choices = items as unknown as Picker[];
     if (options?.canPickMany) return choices as never;
-    return choices[0] as never;
+    const wantedLabel = wanted[index++];
+    if (!wantedLabel) return choices[0] as never;
+    return (choices.find((item) => item.label === wantedLabel) ?? choices[0]) as never;
   });
 }
+function pickFileMaker() { pickSequence(['Event Registration', 'Use FileMaker fields']); }
 describe('Create FM Web App production controller', () => {
+  it('preselects prompt matches from the chosen layout and opens a draft without saving or starting preview', async () => {
+    const { deps, project } = fixture();
+    vi.mocked(vscode.window.showInputBox).mockResolvedValue('Require attendee name and email, add optional session');
+    let step = 0;
+    vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items, options) => {
+      const choices = items as unknown as Array<Picker & { picked?: boolean }>;
+      if (options?.canPickMany) {
+        expect(choices.map(({ label, picked }) => [label, picked])).toEqual([[' Full Name ', true], ['Email', true]]);
+        return choices.filter((item) => item.picked) as never;
+      }
+      if (step++ === 0) return (choices.find((item) => item.label === 'Event Registration') ?? choices[0]) as never;
+      return (choices.find((item) => item.label === 'Draft form from a prompt') ?? choices[0]) as never;
+    });
+    await createFmWebApp(deps as never);
+    const definition = open.mock.calls[0]![1] as ReturnType<typeof eventRegistrationExample>['definition'];
+    expect(definition.fields.map((field) => [field.fmFieldName, field.required])).toEqual([[' Full Name ', true], ['Email', true]]);
+    expect(open.mock.calls[0]![4]).toMatchObject({ unmatched: expect.arrayContaining([expect.stringMatching(/session/i)]) });
+    expect(project.ensureProjectInitialized).not.toHaveBeenCalled();
+    expect(project.syncMetadata).not.toHaveBeenCalled();
+    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
+    await actions().save(definition);
+    await actions().run('preview');
+    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: 'event-registration' });
+  });
+
+  it('gives the same starter the same title on the sample and the FileMaker path', async () => {
+    const { deps } = fixture();
+    pickSequence(['Feedback or Request Form', 'Try sample fields']);
+    await createFmWebApp(deps as never);
+    const sampled = open.mock.calls[0]![1] as ReturnType<typeof feedbackRequestExample>['definition'];
+    expect(sampled.title).toBe('Feedback or request form');
+    open.mockClear();
+    pickSequence(['Feedback or Request Form', 'Use FileMaker fields']);
+    await createFmWebApp(deps as never);
+    const fromFileMaker = open.mock.calls[0]![1] as ReturnType<typeof feedbackRequestExample>['definition'];
+    expect(fromFileMaker.title).toBe('Feedback or request form');
+    expect(fromFileMaker.submitLabel).toBe('Send');
+    expect(fromFileMaker.id).toBe('feedback-request');
+  });
+
+  it('keeps the event registration title on the FileMaker path', async () => {
+    const { deps } = fixture();pickFileMaker();
+    await createFmWebApp(deps as never);
+    const definition = open.mock.calls[0]![1] as ReturnType<typeof eventRegistrationExample>['definition'];
+    expect(definition.title).toBe('Event registration');
+    expect(definition.submitLabel).toBe('Register');
+    expect(definition.id).toBe('event-registration');
+  });
+
+  it('refuses a starter identifier the wizard does not offer', async () => {
+    const { deps } = fixture();
+    await expect(createFmWebApp(deps as never, { starter: 'not-a-starter' })).rejects.toThrow('starter');
+    expect(open).not.toHaveBeenCalled();
+  });
+
+  it('offers both starters and uses the chosen starter for the sample app, its file and its preview route', async () => {
+    const { deps, project } = fixture();
+    pickSequence(['Feedback or Request Form', 'Try sample fields']);
+    await createFmWebApp(deps as never);
+    const definition = open.mock.calls[0]![1] as ReturnType<typeof feedbackRequestExample>['definition'];
+    expect(definition.id).toBe('feedback-request');
+    expect(definition.title).toBe('Feedback or request form');
+    expect(definition.fields.map((field) => field.fmFieldName)).toEqual([' Full Name ', 'Email Address', 'Topic', 'Message']);
+    await actions().save(definition);
+    await expect(readFile(path.join(root, '.fmweb/intakes/feedback-request.intake.json'), 'utf8')).resolves.toContain('feedback-request');
+    await actions().run('preview');
+    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: 'feedback-request' });
+    expect(project.ensureProjectInitialized).toHaveBeenCalled();
+  });
+
+  it('cancelling the starter step opens no editor and writes no app files', async () => {
+    const { deps, project } = fixture();
+    vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);
+    await createFmWebApp(deps as never);
+    expect(open).not.toHaveBeenCalled();
+    expect(project.ensureProjectInitialized).not.toHaveBeenCalled();
+  });
+
+  it('cancels the prompt without selecting fields, saving files or opening an editor', async () => {
+    const { deps, project } = fixture();pickFileMaker();
+    vi.mocked(vscode.window.showInputBox).mockResolvedValue(undefined);
+    await createFmWebApp(deps as never, { source: 'draft' });
+    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(3);
+    expect(open).not.toHaveBeenCalled();
+    expect(project.ensureProjectInitialized).not.toHaveBeenCalled();
+  });
+
+  it('resumes prompt drafting after creating the first connection', async () => {
+    const { deps } = fixture();deps.profileStore.listProfiles.mockResolvedValue([]);
+    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Add Connection' as never);
+    pickSequence(['Event Registration', 'Use FileMaker fields']);
+    await createFmWebApp(deps as never, { source: 'draft' });
+    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true, draft: true, starter: 'event-registration' });
+    expect(open).not.toHaveBeenCalled();
+  });
+
+  it('keeps the chosen starter when it hands over to the connection wizard', async () => {
+    const { deps } = fixture();deps.profileStore.listProfiles.mockResolvedValue([]);
+    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Add Connection' as never);
+    pickSequence(['Feedback or Request Form', 'Use FileMaker fields']);
+    await createFmWebApp(deps as never);
+    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true, starter: 'feedback-request' });
+    expect(open).not.toHaveBeenCalled();
+  });
+
   it('chooses exact FileMaker layout/fields, excludes readonly fields, and saves before preview', async () => {
     const { deps, project, fmClient } = fixture();pickFileMaker();
     await createFmWebApp(deps as never);
@@ -59,7 +174,7 @@ describe('Create FM Web App production controller', () => {
     const { deps } = fixture();deps.profileStore.listProfiles.mockResolvedValue([]);pickFileMaker();
     vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Add Connection' as never);
     await createFmWebApp(deps as never);
-    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true });
+    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true, starter: 'event-registration' });
     expect(open).not.toHaveBeenCalled();
   });
   it('changes a sample app to FileMaker fields on Save and preserves the original source', async () => {
@@ -86,22 +201,27 @@ describe('Create FM Web App production controller', () => {
   it('resumes a saved app without repeating setup or reading the server', async () => {
     const { deps, project, fmClient } = fixture();const app = eventRegistrationExample();
     await new FmWebIntakeService(project).createApp(app.definition, app.layout);
+    pickSequence(['Event Registration']);
     await createFmWebApp(deps as never);
-    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();expect(fmClient.listLayouts).not.toHaveBeenCalled();
+    expect(fmClient.listLayouts).not.toHaveBeenCalled();
+    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(1);
     await actions().save({ ...app.definition, title: 'Resumed app' });
     expect((await new FmWebIntakeService(project).load('event-registration')).definition.title).toBe('Resumed app');
   });
-  it.each([0, 1, 2, 3])('cancels at setup stage %s without creating app files', async (cancelAt) => {
+  it.each([0, 1, 2, 3, 4])('cancels at setup stage %s without creating app files', async (cancelAt) => {
     const { deps, project } = fixture();let step = 0;
     vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items, options) => {
       if (step++ === cancelAt) return undefined;
       const choices = items as unknown as Array<Record<string, unknown>>;
-      return (options?.canPickMany ? choices : choices[0]) as never;
+      if (options?.canPickMany) return choices as never;
+      // The steps are the starter, the data source, the connection, the layout and the fields.
+      if (options?.title === 'Create FM Web App · Data') return (choices.find((item) => item.value === 'filemaker') ?? choices[0]) as never;
+      return choices[0] as never;
     });
     await createFmWebApp(deps as never);expect(open).not.toHaveBeenCalled();expect(project.ensureProjectInitialized).not.toHaveBeenCalled();
   });
   it('supports sample fields and refuses changed-workspace saves', async () => {
-    const { deps } = fixture();vi.mocked(vscode.window.showQuickPick).mockResolvedValue({ value: 'sample' } as never);
+    const { deps } = fixture();pickSequence(['Event Registration', 'Try sample fields']);
     await createFmWebApp(deps as never);const model = open.mock.calls[0]![1] as ReturnType<typeof eventRegistrationExample>['definition'];
     const previous = root;root += '-changed';
     await expect(actions().save(model)).rejects.toThrow('workspace changed');root = previous;
@@ -114,4 +234,14 @@ describe('Create FM Web App production controller', () => {
     const { writeFile } = await import('fs/promises');await writeFile(path.join(root, '.fmweb/intakes/event-registration.intake.json'), '{bad');
     await expect(createFmWebApp(deps as never)).rejects.toThrow();expect(project.setActiveProfile).not.toHaveBeenCalled();
   });
+  it('remembers the wizard while a folder is opened so it can resume after the window reloads', async () => {
+    const { deps, context, project } = fixture();
+    project.getWorkspaceRoot = () => undefined;
+    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Open Folder' as never);
+    vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([{ fsPath: '/tmp/app' }] as never);
+    await createFmWebApp(deps as never);
+    expect(context.globalState.update).toHaveBeenCalledWith(PENDING_FIRST_RUN_KEY, true);
+    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('vscode.openFolder', { fsPath: '/tmp/app' });
+    expect(open).not.toHaveBeenCalled();
+  });
 });
diff --git a/extension/test/unit/fmWebAppPanel.test.ts b/extension/test/unit/fmWebAppPanel.test.ts
index 07586a5..5952000 100644
--- a/extension/test/unit/fmWebAppPanel.test.ts
+++ b/extension/test/unit/fmWebAppPanel.test.ts
@@ -66,6 +66,13 @@ describe('FM Web app form editor', () => {
     await vi.waitFor(() => expect(changeSource).toHaveBeenCalledOnce());
     expect(save).not.toHaveBeenCalled();expect(panel.dispose).toHaveBeenCalledOnce();
   });
+  it('opens prompt drafting from an existing editor only after confirmation', async () => {
+    const { webview, save, changeSource, panel } = fixture();const { document } = browser(webview.html);
+    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Draft form' as never);
+    (document.querySelector('[data-action="draft"]') as DomElement).click();
+    await vi.waitFor(() => expect(changeSource).toHaveBeenCalledWith('draft'));
+    expect(save).not.toHaveBeenCalled();expect(panel.dispose).toHaveBeenCalledOnce();
+  });
   it('keeps the editor and draft when changing fields is canceled', async () => {
     const { webview, save, changeSource, panel } = fixture();const { document } = browser(webview.html);
     vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined);
diff --git a/extension/test/unit/fmWebPromptDraft.test.ts b/extension/test/unit/fmWebPromptDraft.test.ts
new file mode 100644
index 0000000..1df5c63
--- /dev/null
+++ b/extension/test/unit/fmWebPromptDraft.test.ts
@@ -0,0 +1,214 @@
+import { describe, expect, it } from 'vitest';
+import { MAX_FORM_PROMPT_LENGTH, suggestPromptFields } from '../../src/services/fmWebPromptDraft';
+
+describe('prompt form suggestions', () => {
+  it('recognizes registration concepts and preserves FileMaker spelling and value lists', () => {
+    const session = { name: 'WorkshopSession', type: 'text', options: ['Morning', 'Afternoon'] };
+    const result = suggestPromptFields(
+      'Build a workshop registration form. Require attendee name and email, let attendees choose a session, and add an optional accessibility notes field.',
+      [{ name: 'Accessibility_Notes' }, { name: 'AttendeeName' }, { name: ' Email Address ' }, session, { name: 'Notes' }]
+    );
+    expect(result.title).toBe('Workshop registration');
+    expect(result.fields.map(({ field, required }) => [field.name, required])).toEqual([
+      ['AttendeeName', true],
+      [' Email Address ', true],
+      ['WorkshopSession', undefined],
+      ['Accessibility_Notes', false]
+    ]);
+    expect(result.fields[2]?.field).toEqual(session);
+    expect(result.unmatched).toEqual([]);
+  });
+
+  it('does not guess between similar fields or match unrelated fields on substrings', () => {
+    const result = suggestPromptFields('Require email and phone. Include notes.', [
+      { name: ' Email ' }, { name: 'EmailAddress' }, { name: 'Microphone' }, { name: 'Notebook' }
+    ]);
+    expect(result.fields).toEqual([]);
+    expect(result.unmatched).toEqual(['Email', 'Phone', 'Notes']);
+  });
+
+  it('accepts exact quoted custom names and reports read-only or unknown requests', () => {
+    const custom = { name: ' Registration::Badge, Display ' };
+    const result = suggestPromptFields(
+      'Draft a form titled "Badge print". Include " Registration::Badge, Display ", "Count", and "Missing".',
+      [custom, { name: 'Count', kind: 'calculation' }]
+    );
+    expect(result.title).toBe('Badge print');
+    expect(result.fields).toEqual([{ field: custom, required: undefined }]);
+    expect(result.unmatched).toEqual(['Count', 'Missing']);
+  });
+
+  it('does not broaden accessibility into generic notes or pick excluded and global fields', () => {
+    const result = suggestPromptFields('Include accessibility notes. Do not include email. Require phone.', [
+      { name: 'Notes' }, { name: 'Email' }, { name: 'Phone', kind: 'global' }
+    ]);
+    expect(result.fields).toEqual([]);
+    expect(result.unmatched).toEqual(['Accessibility notes', 'Phone']);
+  });
+
+  it('leaves metadata and exact field names unchanged and does not suggest a column twice', () => {
+    const metadata = { name: 'Given Name', required: true };
+    const result = suggestPromptFields('Include first name and given name.', Object.freeze([Object.freeze(metadata)]));
+    expect(result.fields).toEqual([{ field: metadata, required: undefined }]);
+    expect(metadata.required).toBe(true);
+  });
+
+  it('does not suggest attendee name when the prompt asks only for company name', () => {
+    const result = suggestPromptFields('Include a company name.', [{ name: 'Name' }, { name: 'Company' }]);
+    expect(result.fields.map(({ field }) => field.name)).toEqual(['Company']);
+  });
+
+  it('updates an earlier suggestion with a later explicit requirement', () => {
+    const result = suggestPromptFields('Include email. Email is required. Include email.', [{ name: 'Email' }]);
+    expect(result.fields).toEqual([{ field: { name: 'Email' }, required: true }]);
+  });
+
+  it('scopes exclusions to their own fields and respects a later positive instruction', () => {
+    const result = suggestPromptFields(
+      "Include email but exclude phone and company, and add notes. Don't require session.",
+      [{ name: 'Email' }, { name: 'Phone' }, { name: 'Company' }, { name: 'Notes' }, { name: 'Session' }]
+    );
+    expect(result.fields.map(({ field }) => field.name)).toEqual(['Email', 'Notes']);
+    expect(result.unmatched).toEqual([]);
+  });
+
+  it('carries requirements across a list and resets them for later instructions', () => {
+    const result = suggestPromptFields('Require name, email, and phone. Add optional notes, then session.', [
+      { name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Session' }
+    ]);
+    expect(result.fields.map(({ field, required }) => [field.name, required])).toEqual([
+      ['Name', true], ['Email', true], ['Phone', true], ['Notes', false], ['Session', undefined]
+    ]);
+  });
+
+  it('does not confuse literal marker text with an exact quoted field', () => {
+    const result = suggestPromptFields('Include zzfmquote1zz but exclude "Phone".', [
+      { name: 'zzfmquote1zz' }, { name: 'Phone' }
+    ]);
+    expect(result.fields.map(({ field }) => field.name)).toEqual(['zzfmquote1zz']);
+  });
+
+  it('continues a negated directive across or but allows a positive instruction after but', () => {
+    const fields = [{ name: 'Email' }, { name: 'Phone' }];
+    expect(suggestPromptFields('Do not include "Email" or collect "Phone".', fields).fields).toEqual([]);
+    expect(suggestPromptFields('Do not include "Email", but collect "Phone".', fields).fields)
+      .toEqual([{ field: fields[1], required: undefined }]);
+  });
+
+  it('removes a previously suggested field and permits an explicit reinclude', () => {
+    const fields = [{ name: 'Email' }, { name: 'Phone' }];
+    const excludePhone = 'Include "Email" and "Phone". Exclude "Phone".';
+    expect(suggestPromptFields(excludePhone, fields).fields.map(({ field }) => field.name)).toEqual(['Email']);
+    expect(suggestPromptFields(excludePhone + ' Include optional "Phone".', fields).fields)
+      .toEqual([{ field: fields[0], required: undefined }, { field: fields[1], required: false }]);
+  });
+
+  it('does not remove an included field just because it should not be required', () => {
+    const fields = [{ name: 'Phone' }];
+    expect(suggestPromptFields('Require "Phone". Do not require "Phone".', fields).fields)
+      .toEqual([{ field: fields[0], required: false }]);
+    expect(suggestPromptFields('Do not require "Phone".', fields).fields).toEqual([]);
+  });
+
+  it('distinguishes collecting a field from requiring it in a coordinated exclusion', () => {
+    const fields = [{ name: 'Email' }, { name: 'Phone' }];
+    const result = suggestPromptFields('Include "Email". Do not collect "Phone" or require "Email".', fields);
+    expect(result.fields).toEqual([{ field: fields[0], required: false }]);
+  });
+
+  it('limits prompt size before attempting any match', () => {
+    expect(() => suggestPromptFields('x'.repeat(MAX_FORM_PROMPT_LENGTH + 1), [])).toThrow('2,000 characters');
+  });
+
+  it('treats a bare "not" as an exclusion', () => {
+    expect(suggestPromptFields('Include email but not phone.', [{ name: 'Email' }, { name: 'Phone' }]).fields)
+      .toEqual([{ field: { name: 'Email' }, required: undefined }]);
+    expect(suggestPromptFields('Require name and email, but not phone.', [
+      { name: 'Name' }, { name: 'Email' }, { name: 'Phone' }
+    ]).fields).toEqual([
+      { field: { name: 'Name' }, required: true },
+      { field: { name: 'Email' }, required: true }
+    ]);
+    expect(suggestPromptFields('Include email, not phone.', [{ name: 'Email' }, { name: 'Phone' }]).fields)
+      .toEqual([{ field: { name: 'Email' }, required: undefined }]);
+  });
+
+  it('reads "not required" as optional and "not optional" as required', () => {
+    expect(suggestPromptFields('Include email. Email is not required.', [{ name: 'Email' }]).fields)
+      .toEqual([{ field: { name: 'Email' }, required: false }]);
+    expect(suggestPromptFields('Include email but not required phone.', [{ name: 'Email' }, { name: 'Phone' }]).fields)
+      .toEqual([{ field: { name: 'Email' }, required: undefined }, { field: { name: 'Phone' }, required: false }]);
+    expect(suggestPromptFields('Include email and email is not optional.', [{ name: 'Email' }]).fields)
+      .toEqual([{ field: { name: 'Email' }, required: true }]);
+    expect(suggestPromptFields('Include email and not strictly required phone.', [{ name: 'Email' }, { name: 'Phone' }]).fields)
+      .toEqual([{ field: { name: 'Email' }, required: undefined }, { field: { name: 'Phone' }, required: false }]);
+  });
+
+  it('keeps a coordinated item with the list head rather than with the item before it', () => {
+    // "notes" coordinates with the head "Include email", so the exclusion of phone does not swallow it.
+    expect(suggestPromptFields("Include email, don't include phone, and notes.", [
+      { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }
+    ]).fields.map(({ field }) => field.name)).toEqual(['Email', 'Notes']);
+    // The head is negated here, so the coordinated item stays excluded with it.
+    expect(suggestPromptFields("Don't include phone, notes.", [{ name: 'Phone' }, { name: 'Notes' }]).fields)
+      .toEqual([]);
+    // An exclusion still covers the whole list it names.
+    expect(suggestPromptFields('Exclude phone, company, and notes.', [
+      { name: 'Phone' }, { name: 'Company' }, { name: 'Notes' }
+    ]).fields).toEqual([]);
+  });
+
+  it('keeps a coordinated item with an explicit reversal of the list', () => {
+    const fields = [{ name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];
+    expect(suggestPromptFields("Don't include phone, but include email, and notes.", fields).fields
+      .map(({ field }) => field.name)).toEqual(['Email', 'Notes']);
+  });
+
+  it('reads an emphatic inclusion as an inclusion', () => {
+    const fields = [{ name: 'Email' }, { name: 'Phone' }];
+    expect(suggestPromptFields('Include not only email but also phone.', fields).fields
+      .map(({ field }) => field.name)).toEqual(['Email', 'Phone']);
+    expect(suggestPromptFields('Include all the fields, not just email.', fields).fields
+      .map(({ field }) => field.name)).toEqual(['Email']);
+  });
+
+  it('reads the usual ways of excluding a field', () => {
+    const fields = [{ name: 'Email' }, { name: 'Phone' }];
+    expect(suggestPromptFields('Make a form that excludes phone and includes email.', fields).fields
+      .map(({ field }) => field.name)).toEqual(['Email']);
+    expect(suggestPromptFields('Create a form that omits phone. Include email.', fields).fields
+      .map(({ field }) => field.name)).toEqual(['Email']);
+    expect(suggestPromptFields('Draft a registration form leaving out phone, including email.', fields).fields
+      .map(({ field }) => field.name)).toEqual(['Email']);
+    expect(suggestPromptFields('Include everything except phone and email.', fields).fields).toEqual([]);
+  });
+
+  it('keeps the instruction that precedes an unterminated quote', () => {
+    const result = suggestPromptFields('Require "Name and email', [{ name: 'Name' }, { name: 'Email' }]);
+    expect(result.fields.map(({ field, required }) => [field.name, required])).toEqual([['Name', true], ['Email', true]]);
+  });
+
+  it('does not take the article for the title', () => {
+    expect(suggestPromptFields('Make a form with email.', [{ name: 'Email' }]).title).toBeUndefined();
+    expect(suggestPromptFields('Make the form.', []).title).toBeUndefined();
+    expect(suggestPromptFields('Make a registration form.', []).title).toBe('Registration');
+    expect(suggestPromptFields('Create an A Team form with email.', [{ name: 'Email' }]).title).toBe('A Team');
+  });
+
+  it('suggests the fields named in the title as well', () => {
+    const result = suggestPromptFields('Make a name and email form.', [{ name: 'Name' }, { name: 'Email' }]);
+    expect(result.title).toBe('Name and email');
+    expect(result.fields.map(({ field }) => field.name)).toEqual(['Name', 'Email']);
+  });
+
+  it('reads a requirement negation that follows the field', () => {
+    const fields = [{ name: 'Email' }, { name: 'Notes' }];
+    expect(suggestPromptFields('Require email, notes not required.', fields).fields
+      .map(({ field, required }) => [field.name, required])).toEqual([['Email', true], ['Notes', false]]);
+    expect(suggestPromptFields('Require email, notes optional.', fields).fields
+      .map(({ field, required }) => [field.name, required])).toEqual([['Email', true], ['Notes', false]]);
+    expect(suggestPromptFields("Require email, don't include phone, notes not required.", [
+      { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }
+    ]).fields.map(({ field, required }) => [field.name, required])).toEqual([['Email', true], ['Notes', false]]);
+  });
+});
diff --git a/extension/test/unit/webviews/connectionWizardConnectOffer.test.ts b/extension/test/unit/webviews/connectionWizardConnectOffer.test.ts
index 962d505..42aad13 100644
--- a/extension/test/unit/webviews/connectionWizardConnectOffer.test.ts
+++ b/extension/test/unit/webviews/connectionWizardConnectOffer.test.ts
@@ -17,7 +17,7 @@ interface CapturedPanel {
   secretStore: { setPassword: ReturnType<typeof vi.fn> };
 }
 
-function setupPanel(editingProfile?: Record<string, unknown>, afterSave?: 'createFmWebApp'): CapturedPanel {
+function setupPanel(editingProfile?: Record<string, unknown>, afterSave?: { source: 'filemaker' | 'draft'; starter?: string }): CapturedPanel {
   const posted: unknown[] = [];
   let messageHandler: ((message: unknown) => unknown) | undefined;
 
@@ -110,7 +110,7 @@ describe('Connection wizard post-save connect offer', () => {
   });
 
   it('resumes app creation only after credentials are saved', async () => {
-    const panel = setupPanel(undefined, 'createFmWebApp');
+    const panel = setupPanel(undefined, { source: 'filemaker' });
     let release!: () => void;
     panel.secretStore.setPassword.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
     void panel.fireMessage(validSavePayload);
@@ -119,8 +119,20 @@ describe('Connection wizard post-save connect offer', () => {
     await vi.waitFor(() => expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.createFmWebApp', { source: 'filemaker', changeSource: true }));
     expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
   });
+  it('resumes the prompt path after the first connection is saved', async () => {
+    const panel = setupPanel(undefined, { source: 'draft' });
+    await panel.fireMessage(validSavePayload);
+    await vi.waitFor(() => expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
+      'filemakerDataApiTools.createFmWebApp', { source: 'draft', changeSource: true }));
+  });
+  it('keeps the starter the user chose when it resumes after the connection is saved', async () => {
+    const panel = setupPanel(undefined, { source: 'filemaker', starter: 'feedback-request' });
+    await panel.fireMessage(validSavePayload);
+    await vi.waitFor(() => expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
+      'filemakerDataApiTools.createFmWebApp', { source: 'filemaker', changeSource: true, starter: 'feedback-request' }));
+  });
   it('does not resume app creation when credentials fail to save', async () => {
-    const panel = setupPanel(undefined, 'createFmWebApp');panel.secretStore.setPassword.mockRejectedValueOnce(new Error('Credential store unavailable'));
+    const panel = setupPanel(undefined, { source: 'filemaker' });panel.secretStore.setPassword.mockRejectedValueOnce(new Error('Credential store unavailable'));
     await panel.fireMessage(validSavePayload);
     await vi.waitFor(() => expect(panel.posted).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'saveError' })])));
     expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
diff --git a/runtime-next/app/page.tsx b/runtime-next/app/page.tsx
index 216733a..6f698df 100644
--- a/runtime-next/app/page.tsx
+++ b/runtime-next/app/page.tsx
@@ -7,6 +7,7 @@ export default function HomePage(): JSX.Element {
       <h1>FM Web Runtime Template</h1>
       <p>Open a generated layout page to preview runtime rendering.</p>
       <p><Link href="/intake/event-registration">Try the event registration sample</Link></p>
+      <p><Link href="/intake/feedback-request">Try the feedback or request sample</Link></p>
       <p><Link href="/layouts/example">Open Example Layout</Link></p>
     </main>
   );
diff --git a/runtime-next/lib/intake-registry.test.ts b/runtime-next/lib/intake-registry.test.ts
index ffa5e87..abed7ee 100644
--- a/runtime-next/lib/intake-registry.test.ts
+++ b/runtime-next/lib/intake-registry.test.ts
@@ -22,6 +22,20 @@ describe('private portal definition registry', () => {
     expect((await registry.load(id))?.definition.title).toBe(example.definition.title);
     for (const target of ['../escape', 'Unknown', 'a'.repeat(65), 'other']) expect(await registry.load(target)).toBeUndefined();
   });
+  it('serves the feedback starter from the catalogue when nothing is saved', async () => {
+    const registry = new PreviewIntakeRegistry(root);
+    const loaded = await registry.load('feedback-request');
+    expect(loaded?.definition.id).toBe('feedback-request');
+    expect(loaded?.definition.title).toBe('Feedback or request form');
+    expect(loaded?.layout.objects[0]).toMatchObject({ fmFieldName: ' Full Name ' });
+  });
+  it('serves a starter with no saved file even when another app is saved', async () => {
+    await files();
+    const registry = new PreviewIntakeRegistry(root);
+    expect((await registry.load('feedback-request'))?.definition.id).toBe('feedback-request');
+    expect((await registry.load(id))?.definition.title).toBe('Saved custom event');
+    expect(await registry.load('other')).toBeUndefined();
+  });
   it('loads saved mappings and branding, derives the view, and snapshots them until restart', async () => {
     const { form } = await files();const registry = new PreviewIntakeRegistry(root);
     const loaded = await registry.load(id);
diff --git a/runtime-next/lib/intake-registry.ts b/runtime-next/lib/intake-registry.ts
index a19aab2..84e7689 100644
--- a/runtime-next/lib/intake-registry.ts
+++ b/runtime-next/lib/intake-registry.ts
@@ -1,4 +1,4 @@
-import { eventRegistrationExample, intakeDefinitionSchema, intakeLayout, migrateIntakeSource, type IntakeDefinition, type LayoutDefinition } from '@fmweb/shared';
+import { intakeDefinitionSchema, intakeLayout, migrateIntakeSource, starterById, type IntakeDefinition, type LayoutDefinition } from '@fmweb/shared';
 import { constants } from 'node:fs';
 import { lstat, open, realpath } from 'node:fs/promises';
 import path from 'node:path';
@@ -51,14 +51,26 @@ export class PreviewIntakeRegistry {
       const root = await realpath(this.generatedRoot);
       try { await lstat(path.join(root, 'intakes')); }
       catch (error) {
-        if ((error as NodeJS.ErrnoException).code === 'ENOENT' && id === 'event-registration') return eventRegistrationExample();
+        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return this.starter(id);
+        throw error;
+      }
+      let definition: IntakeDefinition;
+      try { definition = intakeDefinitionSchema.parse(await readJson(root, 'intakes', `${id}.intake.json`)); }
+      catch (error) {
+        // No saved app with this identifier yet: the synthetic starter answers for it.
+        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return this.starter(id);
         throw error;
       }
-      const definition = intakeDefinitionSchema.parse(await readJson(root, 'intakes', `${id}.intake.json`));
       if (definition.id !== id || definition.environmentId !== 'sample') return undefined;
       const source = migrateIntakeSource(definition, await readJson(root, 'intake-layouts', `${definition.layoutId}.layout.json`));
       return { definition, layout: intakeLayout(definition, source) };
     } catch { return undefined; }
   }
+
+  /** The synthetic starter for an identifier the catalogue knows, or nothing. */
+  private starter(id: string): PreviewIntake | undefined {
+    const starter = starterById(id);
+    return starter ? starter.example() : undefined;
+  }
 }
 export const previewIntakes = new PreviewIntakeRegistry();
diff --git a/shared/src/index.ts b/shared/src/index.ts
index f3f08d2..7ed61ec 100644
--- a/shared/src/index.ts
+++ b/shared/src/index.ts
@@ -25,4 +25,4 @@ export type { StandardFieldMetadata, StandardControlKind } from './field-standar
 export * from './record-edit';
 
 export * from './intake';
-export { eventRegistrationExample } from './intake-starters';
+export { eventRegistrationExample, feedbackRequestExample, intakeStarters, starterById, type IntakeStarter } from './intake-starters';
diff --git a/shared/src/intake-starters.ts b/shared/src/intake-starters.ts
index c5c22d4..68f4e93 100644
--- a/shared/src/intake-starters.ts
+++ b/shared/src/intake-starters.ts
@@ -1,6 +1,35 @@
 import { createBlankLayout, layoutDefinitionSchema } from './layout-schema';
 import { intakeDefinitionSchema, intakeLayout } from './intake';
 
+/** A starter a user can pick in the first-run wizard: an identifier, a label and a synthetic example. */
+export interface IntakeStarter {
+  /** The identifier the saved app, its file name and its preview route all use. */
+  id: string;
+  label: string;
+  description: string;
+  /**
+   * The copy a form built from this starter's FileMaker fields carries. The synthetic
+   * example keeps its own demo copy, as the event registration starter always has.
+   */
+  copy: { title: string; description: string; submitLabel: string; successMessage: string };
+  example: () => { definition: ReturnType<typeof intakeDefinitionSchema.parse>; layout: ReturnType<typeof layoutDefinitionSchema.parse> };
+}
+
+function starterLayout(
+  definition: { layoutId: string; fields: Array<{ label: string; fmFieldName: string }> },
+  layoutName: string,
+  fmLayoutName: string
+) {
+  const blank = createBlankLayout(layoutName);
+  return layoutDefinitionSchema.parse({ ...blank, id: definition.layoutId,
+    fmLayoutName, canvas: { ...blank.canvas, width: 640 },
+    objects: definition.fields.map((field, index) => ({ type: 'field',
+      id: `b1111111-1111-4111-8111-${String(index).padStart(12, '0')}`, name: field.label,
+      fmFieldName: field.fmFieldName, x: 24, y: 24 + index * 80, width: 560, height: 34,
+      kind: 'normal', label: field.label
+    })) });
+}
+
 /** Entirely synthetic: no saved profile, server address or customer data is used. */
 export function eventRegistrationExample() {
   const definition = intakeDefinitionSchema.parse({
@@ -18,13 +47,42 @@ export function eventRegistrationExample() {
       { id: 'notes', fmFieldName: 'Notes', label: 'Anything we should know?', kind: 'textarea', helpText: 'Use invented information in this sample.', maxLength: 1000 }
     ]
   });
-  const blank = createBlankLayout('Registration');
-  const layout = layoutDefinitionSchema.parse({ ...blank, id: definition.layoutId,
-    fmLayoutName: ' Registrations ', canvas: { ...blank.canvas, width: 640 },
-    objects: definition.fields.map((field, index) => ({ type: 'field',
-      id: `b1111111-1111-4111-8111-${String(index).padStart(12, '0')}`, name: field.label,
-      fmFieldName: field.fmFieldName, x: 24, y: 24 + index * 80, width: 560, height: 34,
-      kind: 'normal', label: field.label
-    })) });
+  const layout = starterLayout(definition, 'Registration', ' Registrations ');
   return { definition, layout: intakeLayout(definition, layout) };
 }
+
+/** Entirely synthetic: no saved profile, server address or customer data is used. */
+export function feedbackRequestExample() {
+  const definition = intakeDefinitionSchema.parse({
+    schemaVersion: 1, id: 'feedback-request', environmentId: 'sample',
+    layoutId: 'a2222222-2222-4222-8222-222222222222',
+    title: 'Feedback or request form',
+    branding: { organizationName: 'Your organization', accentColor: '#215EA6' },
+    description: 'Try a feedback or request form with sample data. This private preview does not contact a FileMaker server.',
+    submitLabel: 'Send with sample data',
+    successMessage: 'Sample feedback accepted. No FileMaker record was created.',
+    fields: [
+      { id: 'name', fmFieldName: ' Full Name ', label: 'Your name', kind: 'text', required: true, maxLength: 120 },
+      { id: 'email', fmFieldName: 'Email Address', label: 'Email address', kind: 'email', required: true, maxLength: 254 },
+      { id: 'topic', fmFieldName: 'Topic', label: 'What is this about?', kind: 'select', required: true, options: ['General question', 'Request a call back', 'Report a problem'], maxLength: 40 },
+      { id: 'message', fmFieldName: 'Message', label: 'Your message', kind: 'textarea', required: true, helpText: 'Use invented information in this sample.', maxLength: 2000 }
+    ]
+  });
+  const layout = starterLayout(definition, 'Feedback', ' Feedback ');
+  return { definition, layout: intakeLayout(definition, layout) };
+}
+
+/** The starters the first-run wizard offers, in the order it offers them. */
+export const intakeStarters: readonly IntakeStarter[] = [
+  { id: 'event-registration', label: 'Event Registration', description: 'Collect names, email and session choices for an event',
+    copy: { title: 'Event registration', description: 'Register for our event.', submitLabel: 'Register', successMessage: 'Sample registration accepted. No FileMaker record was created.' },
+    example: eventRegistrationExample },
+  { id: 'feedback-request', label: 'Feedback or Request Form', description: 'Collect a message, a topic and contact details',
+    copy: { title: 'Feedback or request form', description: 'Send us feedback or a request.', submitLabel: 'Send', successMessage: 'Sample message accepted. No FileMaker record was created.' },
+    example: feedbackRequestExample }
+];
+
+/** The starter with this identifier, or undefined when the identifier names no starter. */
+export function starterById(id: string): IntakeStarter | undefined {
+  return intakeStarters.find((starter) => starter.id === id);
+}
diff --git a/shared/test/intake-starters.test.ts b/shared/test/intake-starters.test.ts
index d323f77..b376bef 100644
--- a/shared/test/intake-starters.test.ts
+++ b/shared/test/intake-starters.test.ts
@@ -1,5 +1,5 @@
 import { describe, expect, it } from 'vitest';
-import { eventRegistrationExample, intakeDefinitionSchema, intakeLayout, migrateIntakeSource, validateIntakeSubmission } from '../src';
+import { eventRegistrationExample, feedbackRequestExample, intakeDefinitionSchema, intakeLayout, intakeStarters, migrateIntakeSource, starterById, validateIntakeSubmission } from '../src';
 describe('reusable portal starter and branding', () => {
   it('migrates legacy sources with a stable reference and exact names', () => {
     const { definition, layout } = eventRegistrationExample();
@@ -47,3 +47,48 @@ describe('reusable portal starter and branding', () => {
     }
   });
 });
+
+describe('the starter catalogue the first-run wizard offers', () => {
+  it('offers an event registration and a feedback or request form', () => {
+    expect(intakeStarters.map((starter) => starter.id)).toEqual(['event-registration', 'feedback-request']);
+    expect(intakeStarters.map((starter) => starter.label)).toEqual(['Event Registration', 'Feedback or Request Form']);
+    expect(intakeStarters.every((starter) => starter.description.length > 0)).toBe(true);
+  });
+  it('resolves a starter by identifier and refuses an unknown one', () => {
+    expect(starterById('feedback-request')?.label).toBe('Feedback or Request Form');
+    expect(starterById('event-registration')?.label).toBe('Event Registration');
+    expect(starterById('other')).toBeUndefined();
+    expect(starterById('')).toBeUndefined();
+  });
+  it('gives every starter its own copy for a form built from its fields', () => {
+    expect(intakeStarters.map((starter) => starter.copy.title)).toEqual(['Event registration', 'Feedback or request form']);
+    expect(intakeStarters.map((starter) => starter.copy.submitLabel)).toEqual(['Register', 'Send']);
+    expect(intakeStarters.every((starter) => starter.copy.description.length > 0 && starter.copy.successMessage.length > 0)).toBe(true);
+    expect(new Set(intakeStarters.map((starter) => starter.copy.title)).size).toBe(intakeStarters.length);
+  });
+  it('gives every starter its own identifier, layout and exact field names', () => {
+    const ids = new Set<string>();
+    for (const starter of intakeStarters) {
+      const { definition, layout } = starter.example();
+      expect(definition.id).toBe(starter.id);
+      expect(definition.environmentId).toBe('sample');
+      expect(definition.id).toMatch(/^[a-z][a-z0-9_-]{0,63}$/);
+      expect(ids.has(definition.id)).toBe(false);ids.add(definition.id);
+      expect(layout.id).toBe(definition.layoutId);
+      expect(layout.objects).toHaveLength(definition.fields.length);
+      for (const object of layout.objects) {
+        if (object.type !== 'field') continue;
+        expect(object.fmFieldName.trim().length).toBeGreaterThan(0);
+      }
+    }
+  });
+  it('builds a feedback form that validates only invented sample values', () => {
+    const sample = feedbackRequestExample();
+    expect(sample.definition.title).toBe('Feedback or request form');
+    expect(sample.definition.fields.map((field) => field.fmFieldName)).toEqual([' Full Name ', 'Email Address', 'Topic', 'Message']);
+    expect(sample.layout.fmLayoutName).toBe(' Feedback ');
+    expect(validateIntakeSubmission(sample.definition, { name: 'Sample', email: 'sample@example.test', topic: 'General question', message: 'Invented' }).valid).toBe(true);
+    expect(validateIntakeSubmission(sample.definition, { name: 'Sample', email: 'sample@example.test', topic: 'General question' }).valid).toBe(false);
+    expect(feedbackRequestExample()).toEqual(sample);
+  });
+});
```
