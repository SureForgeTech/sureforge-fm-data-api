# Independent review packet — PR #574 (head wizard4)

- Repository: SureForgeTech/sureforge-fm-data-api
- Working checkout: /workspace/sureforge-fm-data-api-wt-wizard
- Branch: feat/first-run-wizard
- Exact head SHA under review: ae299871511e24828d911c4e9daaca8e6d77b3bf
- Head tree SHA: 8a2813839d9db1dc6ecd7d1ee6c8cdd095abaa92
- Base ref: origin/main (162e35a4ed788c6994a353978c9c1d1f3474d554)
- Merge base: 162e35a4ed788c6994a353978c9c1d1f3474d554
- Commit under review:
    ae299871511e24828d911c4e9daaca8e6d77b3bf
    author: Alan Deffenderfer (macbookprom5) <4432479+macbookprom5@users.noreply.github.com>
    date: Wed Nov 18 03:17:16 2026 -0700
    subject: fix: keep the wizard and its documentation free of registration wording
    body:
  A follow-up review of the wizard found that the word "registration" still
  reached a feedback user in the wizard's own error message and in the
  sentences this change had already rewritten.
  
  The wizard now says "Choose a layout with editable fields", and the user
  guide, the FM Web reference and the walkthrough describe the fields rather
  than registration fields.
  
  The private preview's own wording lives in the shipped runtime template and
  is tracked separately, because changing it moves the template's versioned
  sources and reaches only newly generated apps.
  
  Signed-off-by: Alan Deffenderfer <4432479+macbookprom5@users.noreply.github.com>
  

## Validation the author ran, and the actual exit status of each step

Gate script: /tmp/opencode/fm-gate.sh. It runs the repository's declared validation
in the same order as .github/workflows/ci.yml job build-test. Exit statuses:

```
[01-scripts-test] (see /tmp/opencode/fm-gate/wizard4/01-scripts-test.log)
[02-audit] (see /tmp/opencode/fm-gate/wizard4/02-audit.log)
[03-lint] (see /tmp/opencode/fm-gate/wizard4/03-lint.log)
[04-ci-test] (see /tmp/opencode/fm-gate/wizard4/04-ci-test.log)
[05-build-shared] (see /tmp/opencode/fm-gate/wizard4/05-build-shared.log)
[06-mock-check] (see /tmp/opencode/fm-gate/wizard4/06-mock-check.log)
[07-typecheck] (see /tmp/opencode/fm-gate/wizard4/07-typecheck.log)
[08-test-coverage] (see /tmp/opencode/fm-gate/wizard4/08-test-coverage.log)
[09-build] (see /tmp/opencode/fm-gate/wizard4/09-build.log)
[10-designer-runtime-test] (see /tmp/opencode/fm-gate/wizard4/10-designer-runtime-test.log)
[11-package-check] (see /tmp/opencode/fm-gate/wizard4/11-package-check.log)
[12-vsix-size-budget] (see /tmp/opencode/fm-gate/wizard4/12-vsix-size-budget.log)
```

The authoritative per-step exit codes are printed in the gate transcript and recorded
in the summary below.

```
01-scripts-test =>	--- exit=0 duration=0s log=/tmp/opencode/fm-gate/wizard4/01-scripts-test.log
02-audit =>	--- exit=0 duration=1s log=/tmp/opencode/fm-gate/wizard4/02-audit.log
03-lint =>	--- exit=0 duration=7s log=/tmp/opencode/fm-gate/wizard4/03-lint.log
04-ci-test =>	--- exit=0 duration=1s log=/tmp/opencode/fm-gate/wizard4/04-ci-test.log
05-build-shared =>	--- exit=0 duration=0s log=/tmp/opencode/fm-gate/wizard4/05-build-shared.log
06-mock-check =>	--- exit=0 duration=1s log=/tmp/opencode/fm-gate/wizard4/06-mock-check.log
07-typecheck =>	--- exit=0 duration=1s log=/tmp/opencode/fm-gate/wizard4/07-typecheck.log
08-test-coverage =>	--- exit=0 duration=45s log=/tmp/opencode/fm-gate/wizard4/08-test-coverage.log
09-build =>	--- exit=0 duration=1s log=/tmp/opencode/fm-gate/wizard4/09-build.log
10-designer-runtime-test =>	--- exit=0 duration=4s log=/tmp/opencode/fm-gate/wizard4/10-designer-runtime-test.log
11-package-check =>	--- exit=0 duration=1s log=/tmp/opencode/fm-gate/wizard4/11-package-check.log
12-vsix-size-budget =>	--- exit=0 duration=0s log=/tmp/opencode/fm-gate/wizard4/12-vsix-size-budget.log
```

### Note on the sandbox proxy environment

The sandbox exports HTTP_PROXY/HTTPS_PROXY. The extension's TLS/proxy code treats an
environment proxy as 'a proxy is configured on this computer' and fails closed, which
changes the outcome of 26 TLS/proxy unit tests that assert on a direct route.
GitHub-hosted runners have no proxy variables, so the gate unsets them for the test
steps. This was reproduced on unmodified main in this same sandbox before any change
was made: those 26 tests fail with the proxy set and pass with it unset.

## Acceptance criteria (from the pull request)


## Repository rules that bound this change

- AGENTS.md (repo root, read the checked-out copy at /workspace/sureforge-fm-data-api-wt-wizard/AGENTS.md).
- Merge rule: a fresh independent review of the exact head must have zero unresolved P0/P1 findings.
- Validation gate: npm ci, npm run lint, npm run typecheck, npm run mock:check -w extension,
  npm run test:coverage, npm run build, npm test -w designer-ui -w runtime-next, npm run package:check,
  plus npm audit --omit=dev --audit-level=high and the VSIX size budget.
- Synthetic/mock FileMaker data only. Never real customer data or credentials.
- Preserve exact layout, script and field names; do not trim them.

## What this branch changes

This branch adds prompt-based FileMaker form drafting: a new module parses a free-text
prompt and suggests which writable layout fields the user meant; the create wizard gains a
'draft' source that shows the prompt, pre-picks the suggestions and opens the visual editor.

## Review history: what earlier rounds found, and what the tip commit changed

This branch adds the first-run wizard for **Create FM Web App**. It is a single commit on top of the current `origin/main` (`162e35a`).

## What it changes

**The wizard order.** The wizard now asks what kind of form you are making before it asks where the fields come from. Two starters are offered: **Event Registration** and **Feedback or Request Form**. The starter is the app's identity: it names the saved app, its file name under `.fmweb/intakes/`, and its preview address. Choosing the same starter again reopens that app instead of starting over.

**The data step.** The data step now offers **Try sample fields** first, then **Use FileMaker fields** and **Draft form from a prompt**, so the shortest path to a first sample receipt needs no FileMaker connection, no code and no JSON editing.

**Resume.** The wizard used to stop in two places. It now resumes in both:
- After a folder is opened. Opening a folder reloads the window, so the pending wizard is written to `globalState` before `vscode.openFolder` runs and the extension re-runs the wizard on the next activation.
- After a first connection is saved. The connection wizard's one-shot continuation now carries the starter identifier, so the resumed wizard keeps the starter the user chose instead of asking again.

**The starter catalogue.** `shared/src/intake-starters.ts` gains a second starter and an `intakeStarters` catalogue with `starterById`. The extension, the intake service and the private preview resolve a starter by identifier, so the identifier is the single source of truth. The private runtime serves either starter from the catalogue when nothing has been saved yet.

**The intake id is no longer hard-coded.** `FmWebIntakeService.createApp` accepted only the identifier `event-registration`, and `saveApp` reloaded that identifier literally. Both now use the definition's own identifier, and `createApp` accepts any identifier the catalogue knows.

## What to hold it to

1. The starter identifier must be honoured everywhere: the saved app's file, the definition's `id`, the preview address and the intake service's checks. A starter that resolves in one place and not another is a defect.
2. Cancelling at any step must create no app files, open no editor and change no saved app.
3. The resume after a folder selection must not fire when the user cancels the folder dialog, and must not fire twice.
4. The resume after the connection is saved must carry the starter, and must keep the existing one-shot behaviour (it must not resume for an existing profile, and it must not resume when saving the credentials failed).
5. The existing single-app behaviour must not regress: the event registration starter, the prompt drafting path, the change-source path and the real FileMaker save path.
6. The generated runtime's shipped-source hashes must include the new shared sources, so a previously generated runtime is still recognised as the extension's own and refreshed rather than treated as a user edit.
7. Synthetic data only; no credentials, no customer data, and no secret written to disk or into a log.

## What was verified, and what was not

The full repository gate passed on this head. The reviewer should re-run what it can.

**Verified by the author in this environment:** the runtime's real HTTP route was exercised against a running `next dev` server on 127.0.0.1:3000 with the preview session cookie: `POST /api/intake/feedback-request` with invented values answered `201` with a `sample-…` receipt, the same submission identifier returned the same receipt, `GET /intake/feedback-request` rendered the form with all four fields, the original `event-registration` starter still answered `201` with a receipt, and a submission missing required fields was answered `422` with field-level errors.

**Not verified, and why:** the packaged-VSIX browser journey was not run here. The e2e-ui harness downloads VS Code from `update.code.visualstudio.com`, and the sandbox proxy refuses that host with `403` on CONNECT, so the harness cannot start at all in this environment. The same environment cannot install the preview's npm dependencies inside VS Code either, because the harness's environment allowlist does not pass the proxy variables to the processes it starts. Please treat the browser half of the journey as unverified.

## Complete git-generated diff (origin/main...HEAD)

This diff is produced verbatim by git. Every changed path and hunk is included;
nothing is summarized, reformatted or truncated.

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index fecbb22..2f482d6 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -24,6 +24,8 @@ PR title prefix matches the highest-tier label added:
 
 ### [FEATURE]
 
+- Create FM Web App starts with a starter: Event Registration or Feedback or Request Form. The starter names the saved app, so choosing the same one again reopens it. Sample fields come first, the wizard resumes by itself after you open a folder or add a first connection, and the sample receipt needs no credentials, code or JSON.
+
 - Draft a form from a prompt using your existing FileMaker connection, then review suggested fields and preview in the visual editor.
 
 - Event-registration forms can save real records to an explicitly confirmed FileMaker connection through the private extension bridge. Persistent submission tracking prevents automatic retries after an uncertain write; sample preview remains available.
diff --git a/extension/CHANGELOG.md b/extension/CHANGELOG.md
index 8baec33..0708438 100644
--- a/extension/CHANGELOG.md
+++ b/extension/CHANGELOG.md
@@ -11,6 +11,8 @@
 
 **FM Web app creation**
 
+- Create FM Web App now starts with a starter: **Event Registration** or **Feedback or Request Form**. The starter names the saved app, so choosing the same one again reopens it. Sample fields come first, so a first sample receipt needs no connection, no code and no JSON editing. The wizard resumes by itself after you open a folder or add a first connection.
+
 - Save to FileMaker opens a private registration form after confirming the connection, database and layout. Submitting creates a real record with the mapped fields; credentials stay in the extension. Persistent submission tracking prevents the same submission from being dispatched again after a restart or uncertain result. Sample preview remains available.
 
 - Create FM Web App guides connection, layout and field selection, then opens a form editor for labels, rules, order and branding without JSON editing. Save and preview uses sample submissions; reopen the command to continue editing. Existing advanced commands are preserved.
diff --git a/extension/docs/FM_WEB.md b/extension/docs/FM_WEB.md
index 653a56f..52d096e 100644
--- a/extension/docs/FM_WEB.md
+++ b/extension/docs/FM_WEB.md
@@ -6,12 +6,14 @@ Reference for the FM Web workflow (Layout Mode, generated Next.js runtime and th
 
 **FileMaker: Create FM Web App** is the main entry point. It is also available from the new-file button above Connections and the first Getting Started step.
 
-1. Open a trusted workspace folder. Choose **Use FileMaker fields**, **Draft form from a prompt** or **Try sample fields**.
-2. For FileMaker fields, choose a saved connection, a layout and the registration fields. The picker excludes calculations, summaries, containers and globals. Exact layout and field names are preserved. If no connection exists, the flow offers the existing connection setup.
-3. For a prompt, describe the form in your own words. The extension suggests the writable fields of the chosen layout that your wording points at, marks the ones you called required or optional, and lists the requests it could not map. Review the suggestions in the field picker and the form editor before saving. Exact layout and field names are preserved, and read-only or ambiguous fields are never suggested.
-4. Customize the event-registration form in its editor: event title and description, submit/success text, organization and accent color, included fields, labels, help, required rules, input types, maximum lengths and single-choice options. Move fields up or down to set their order.
-5. Choose **Save and preview** for a sample-only browser session with invented details, or **Save to FileMaker** to accept real registrations. The latter saves the form, names the connection, database and layout in a native confirmation, and opens a private browser session only after you choose **Enable FileMaker saves**. Submitting that browser form creates a real FileMaker record.
-6. Run **Create FM Web App** again to continue editing the saved app. No setup commands or JSON editing are needed for the normal create/customize/preview path.
+1. Open a trusted workspace folder. If none is open, the wizard offers to open one and resumes by itself once the window reloads.
+2. Choose a starter: **Event Registration** or **Feedback or Request Form**. The starter names the saved app, its file and its preview address, so choosing the same starter again reopens that app.
+3. Choose where the fields come from: **Try sample fields** starts immediately with invented data and no connection, **Use FileMaker fields** selects a saved connection, layout and fields, and **Draft form from a prompt** describes the form in your own words. If no connection exists, the flow offers the existing connection setup and resumes once it is saved.
+4. For FileMaker fields, choose a saved connection, a layout and the fields. The picker excludes calculations, summaries, containers and globals. Exact layout and field names are preserved.
+5. For a prompt, describe the form in your own words. The extension suggests the writable fields of the chosen layout that your wording points at, marks the ones you called required or optional, and lists the requests it could not map. Review the suggestions in the field picker and the form editor before saving. Exact layout and field names are preserved, and read-only or ambiguous fields are never suggested.
+6. Customize the form in its editor: title and description, submit/success text, organization and accent color, included fields, labels, help, required rules, input types, maximum lengths and single-choice options. Move fields up or down to set their order.
+7. Choose **Save and preview** for a sample-only browser session with invented details, or **Save to FileMaker** to accept real registrations. The latter saves the form, names the connection, database and layout in a native confirmation, and opens a private browser session only after you choose **Enable FileMaker saves**. Submitting that browser form creates a real FileMaker record.
+8. Run **Create FM Web App** again to continue editing the saved app. No setup commands or JSON editing are needed for the normal create/customize/preview path.
 
 Saves preserve the authored source layout and refuse to replace a form changed by another editor. Reopen the app editor to load those changes. Cancelling field selection creates no app definition. The advanced **Export app** action generates an editable app folder and reveals it in VS Code; **Source layout** opens Layout Mode. Export does not publish a website or configure a live submission backend.
 
diff --git a/extension/docs/USER_GUIDE.md b/extension/docs/USER_GUIDE.md
index 19cc797..52bd38e 100644
--- a/extension/docs/USER_GUIDE.md
+++ b/extension/docs/USER_GUIDE.md
@@ -802,7 +802,7 @@ Regenerate after a schema change, and use a [schema diff](#schema-snapshots-and-
 
 ## FM Web and Layout Mode
 
-Start with **FileMaker: Create FM Web App**, or the new-file button above Connections. Choose **Use FileMaker fields** to select a saved connection, layout and writable registration fields, choose **Draft form from a prompt** to describe the form in words and review the fields the extension suggests, or choose **Try sample fields** without a connection. The form editor lets you change labels, help text, required rules, input types, choices, field order, event text and organization/color branding without editing JSON. Choose **Save and preview** for invented sample registrations, or **Save to FileMaker** for real registrations. The latter names the connection, database and layout in a native confirmation; choose **Enable FileMaker saves** to open the private browser form. Submitting that form creates a real record.
+Start with **FileMaker: Create FM Web App**, or the new-file button above Connections. Choose a starter, **Event Registration** or **Feedback or Request Form**; the starter names the saved app, so choosing the same one again reopens it. Then choose where the fields come from: **Try sample fields** to start immediately with invented data and no connection, **Use FileMaker fields** to select a saved connection, layout and writable fields, or **Draft form from a prompt** to describe the form in words and review the fields the extension suggests. If no workspace folder is open, the wizard offers to open one and resumes by itself afterwards; if no connection exists, the wizard offers the existing connection setup and resumes once it is saved. The form editor lets you change labels, help text, required rules, input types, choices, field order, the title and description and organization/color branding without editing JSON. Choose **Save and preview** for invented sample submissions, or **Save to FileMaker** for real submissions. The latter names the connection, database and layout in a native confirmation; choose **Enable FileMaker saves** to open the private browser form. Submitting that form creates a real record.
 
 Reopen **Create FM Web App** to continue editing the saved app. Sample preview creates no records. Real registrations use only the confirmed connection, layout and mapped fields, with workspace trust, offline and write-policy checks; credentials stay in the extension. A persisted submission identifier prevents a completed or uncertain write from being dispatched again after restarting the preview. If a result is uncertain, check FileMaker before starting a new submission. Use **Choose FileMaker fields** in the editor to replace sample fields or select fields again, or **Draft form from a prompt** to describe the form in words instead. Your saved app stays unchanged until you save the replacement. **Export app** creates an editable app folder, not a public deployment. See [Create FM Web App](./FM_WEB.md#create-fm-web-app) for the complete flow.
 
diff --git a/extension/docs/walkthroughs/create-web-app.md b/extension/docs/walkthroughs/create-web-app.md
index 33986e5..b48ca26 100644
--- a/extension/docs/walkthroughs/create-web-app.md
+++ b/extension/docs/walkthroughs/create-web-app.md
@@ -1,10 +1,12 @@
 # Create an FM Web app
 
-Run **FileMaker: Create FM Web App**, or use the new-file button above Connections.
+Run **FileMaker: Create FM Web App**, or use the new-file button above Connections. If no folder is open yet, the wizard offers to open one and picks up where it left off afterwards.
 
-Choose **Draft form from a prompt** to describe the fields you want. Pick a FileMaker layout, review the suggested mappings, and adjust the draft in the form editor. Suggestions use field metadata and the extension matches them on your computer.
+Choose a starter, **Event Registration** or **Feedback or Request Form**. The starter names the saved app, so choosing the same starter again reopens it instead of starting over.
+
+Choose **Try sample fields** to start with invented data and no connection, or **Use FileMaker fields** from a saved connection and layout. Select the fields, then edit the title, branding, labels, required rules and choices in the form editor. Use Move up and Move down to arrange fields.
 
-Choose FileMaker fields from a saved connection and layout, or start with sample fields. Select the registration fields, then edit the event title, branding, labels, required rules and choices in the form editor. Use Move up and Move down to arrange fields.
+Choose **Draft form from a prompt** to describe the fields you want. Pick a FileMaker layout, review the suggested mappings, and adjust the draft in the form editor. Suggestions use field metadata and the extension matches them on your computer.
 
 Choose **Save and preview** for an invented-data sample, or **Save to FileMaker** to accept real registrations. The latter saves the app and names the connection, database and layout in a native confirmation. Choose **Enable FileMaker saves**, then submit the private browser form to create a real record. Credentials stay in the extension. Return to **Create FM Web App** to continue editing the saved app.
 
diff --git a/extension/src/commands/createFmWebApp.ts b/extension/src/commands/createFmWebApp.ts
index 65f3c47..5037e9b 100644
--- a/extension/src/commands/createFmWebApp.ts
+++ b/extension/src/commands/createFmWebApp.ts
@@ -1,5 +1,5 @@
 import * as vscode from 'vscode';
-import { eventRegistrationExample, type IntakeDefinition, type LayoutDefinition } from '@fmweb/shared';
+import { eventRegistrationExample, intakeStarters, starterById, type IntakeDefinition, type IntakeStarter, type LayoutDefinition } from '@fmweb/shared';
 import { designerLayoutMetadata } from '../fmweb/fieldMetadata';
 import { FmWebAppPanel } from '../webviews/fmWebApp';
 import { FmWebIntakeService, type SavedIntake } from '../services/fmWebIntakeService';
@@ -11,6 +11,9 @@ import type { FmWebRuntimeGenerator } from '../services/fmWebRuntimeGenerator';
 import type { ProfileStore } from '../services/profileStore';
 import type { ConnectionProfile } from '../types/fm';
 
+/** The key the pending first-run wizard is stored under while a folder is opened. */
+export const PENDING_FIRST_RUN_KEY = 'filemaker.pendingFirstRunWizard';
+
 interface CreateAppDependencies {
   context: vscode.ExtensionContext;
   project: FmWebProjectService;
@@ -19,7 +22,18 @@ interface CreateAppDependencies {
   fmClient: FMClient;
 }
 
-export interface CreateAppOptions { source?: 'filemaker' | 'draft'; changeSource?: boolean }
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
@@ -28,7 +42,16 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
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
@@ -39,31 +62,44 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
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
   let draft: ReturnType<typeof suggestPromptFields> | undefined;
-  try { saved = await intakes.loadForEditing('event-registration');model = saved; }
+  try { saved = await intakes.loadForEditing(appId);model = saved; }
   catch (error) {
     if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
     // Missing sources are an existing app needing repair, not permission to replace its definition.
-    try { await intakes.definitionPathForEdit('event-registration');throw new Error('The saved app has a missing source layout. Open Build a Portal to repair it.', { cause: error }); }
+    try { await intakes.definitionPathForEdit(appId);throw new Error('The saved app has a missing source layout. Open Build a Portal to repair it.', { cause: error }); }
     catch (existingError) { if ((existingError as NodeJS.ErrnoException).code !== 'ENOENT') throw existingError; }
   }
   if (!saved || options.changeSource) {
     const source = options.source ? { value: options.source } : await vscode.window.showQuickPick([
-      { label: 'Use FileMaker fields', description: 'Choose a connection, layout and registration fields', value: 'filemaker' },
-      { label: 'Draft form from a prompt', description: 'Describe a form and review suggested FileMaker fields', value: 'draft' },
-      { label: 'Try sample fields', description: 'Start immediately without a FileMaker connection', value: 'sample' }
-    ], { title: 'Create FM Web App · Event registration', placeHolder: 'Where should the form fields come from?', ignoreFocusOut: true });
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
-        await vscode.commands.executeCommand('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true, ...(source.value === 'draft' ? { draft: true } : {}) });
+        await vscode.commands.executeCommand('filemakerDataApiTools.addConnectionProfile', {
+          continueToFmWebApp: true, ...(source.value === 'draft' ? { draft: true } : {}), ...(starter ? { starter: starter.id } : {})
+        });
         return;
       }
       const picked = await vscode.window.showQuickPick(profiles.map((item) => ({ label: item.name, description: item.database, profile: item })),
@@ -71,12 +107,12 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
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
+      if (!writable.length) throw new Error('This layout has no writable, nonglobal fields. Choose a layout with editable fields.');
       if (source.value === 'draft') {
         const prompt = await vscode.window.showInputBox({
           title: 'Draft form from a prompt',
@@ -101,11 +137,11 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
         title: draft ? 'Review suggested FileMaker fields' : 'Create FM Web App · Fields',
         placeHolder: draft && !suggested.size
           ? 'No confident matches. Choose the FileMaker fields for your form.'
-          : 'Select 1–100 writable registration fields.',
+          : 'Select 1–100 writable fields.',
         canPickMany: true, ignoreFocusOut: true
       });
       if (!fields) return;
-      model = registrationAppFromFields(selected.name, fields.map((item) => item.field));
+      model = registrationAppFromFields(selected.name, fields.map((item) => item.field), { id: appId, copy: starter?.copy });
     }
   }
   if (saved && options.changeSource) {
@@ -142,11 +178,11 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
         saved = saved ? await intakes.saveApp(definition, saved.revision, selectedModel.layout) : await intakes.createApp(definition, selectedModel.layout);
       } else saved = await intakes.saveApp(definition, saved.revision);
     },
-    changeSource: async (source = 'filemaker') => { await vscode.commands.executeCommand('filemakerDataApiTools.createFmWebApp', { source, changeSource: true }); },
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
diff --git a/extension/src/commands/fmWebProject.ts b/extension/src/commands/fmWebProject.ts
index b75a9f8..05789f3 100644
--- a/extension/src/commands/fmWebProject.ts
+++ b/extension/src/commands/fmWebProject.ts
@@ -62,7 +62,7 @@ export function registerFmWebProjectCommands(
     vscode.commands.registerCommand('filemakerDataApiTools.createFmWebApp', async (arg: unknown) => {
       if (appStarting) return;
       appStarting = true;
-      try { await createFmWebApp({ context, project: fmWebProjectService, generator: fmWebRuntimeGenerator, profileStore, fmClient }, arg && typeof arg === 'object' ? { source: 'source' in arg && (arg.source === 'filemaker' || arg.source === 'draft') ? arg.source : undefined, changeSource: 'changeSource' in arg && arg.changeSource === true } : {}); }
+      try { await createFmWebApp({ context, project: fmWebProjectService, generator: fmWebRuntimeGenerator, profileStore, fmClient }, arg && typeof arg === 'object' ? { source: 'source' in arg && (arg.source === 'filemaker' || arg.source === 'draft') ? arg.source : undefined, changeSource: 'changeSource' in arg && arg.changeSource === true, starter: 'starter' in arg && typeof arg.starter === 'string' ? arg.starter : undefined } : {}); }
       catch (error) { await showCommandError(error, { fallbackMessage: 'Could not create the FM Web app.', logger, logMessage: 'Create FM Web App failed.' }); }
       finally { appStarting = false; }
     }),
diff --git a/extension/src/commands/index.ts b/extension/src/commands/index.ts
index 6a6d4de..01811c9 100644
--- a/extension/src/commands/index.ts
+++ b/extension/src/commands/index.ts
@@ -96,7 +96,8 @@ export function registerCoreCommands(deps: RegisterCoreCommandDeps): vscode.Disp
       ConnectionWizardPanel.createOrShow(context, profileStore, secretStore, fmClient, logger, undefined, {
         getTestPolicy: deps.getConnectionWizardTestPolicy,
         afterSave: arg && typeof arg === 'object' && 'continueToFmWebApp' in arg && arg.continueToFmWebApp === true
-          ? ('draft' in arg && arg.draft === true ? 'draftFmWebApp' : 'createFmWebApp') : undefined
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
index 09c33e1..7ae520f 100644
--- a/extension/src/webviews/connectionWizard/save.ts
+++ b/extension/src/webviews/connectionWizard/save.ts
@@ -130,9 +130,9 @@ export async function handleSave(ctx: WizardContext, data: WizardFormData): Prom
     });
 
     if (isNewProfile && ctx.options.afterSave) {
-      const source = ctx.options.afterSave === 'draftFmWebApp' ? 'draft' : 'filemaker';
+      const continuation = ctx.options.afterSave;
       ctx.options.afterSave = undefined;
-      await vscode.commands.executeCommand('filemakerDataApiTools.createFmWebApp', { source, changeSource: true });
+      await vscode.commands.executeCommand('filemakerDataApiTools.createFmWebApp', { source: continuation.source, changeSource: true, ...(continuation.starter ? { starter: continuation.starter } : {}) });
       return;
     }
 
diff --git a/extension/src/webviews/connectionWizard/types.ts b/extension/src/webviews/connectionWizard/types.ts
index 7919e7d..d253699 100644
--- a/extension/src/webviews/connectionWizard/types.ts
+++ b/extension/src/webviews/connectionWizard/types.ts
@@ -8,7 +8,7 @@ export type ConnectionWizardTestPolicy = 'off' | 'warn' | 'block';
 
 export interface ConnectionWizardOptions {
   /** One-shot continuation after credentials have been saved successfully. */
-  afterSave?: 'createFmWebApp' | 'draftFmWebApp';
+  afterSave?: { source: 'filemaker' | 'draft'; starter?: string };
   /** Resolved at message time so settings updates flow live. */
   getTestPolicy?: () => ConnectionWizardTestPolicy;
 }
diff --git a/extension/src/webviews/fmWebApp/index.ts b/extension/src/webviews/fmWebApp/index.ts
index 08026e1..165f327 100644
--- a/extension/src/webviews/fmWebApp/index.ts
+++ b/extension/src/webviews/fmWebApp/index.ts
@@ -24,7 +24,7 @@ export class FmWebAppPanel {
 
   static open(context: vscode.ExtensionContext, definition: IntakeDefinition, layout: LayoutDefinition, actions: AppEditorActions, draft?: { unmatched: string[] }): void {
     if (this.revealIfOpen()) return;
-    const panel = vscode.window.createWebviewPanel('filemakerFmWebApp', 'FM Web App — Event registration', vscode.ViewColumn.One,
+    const panel = vscode.window.createWebviewPanel('filemakerFmWebApp', `FM Web App — ${definition.title}`, vscode.ViewColumn.One,
       { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webviews', 'fmWebApp', 'ui')] });
     const editor = new FmWebAppPanel(panel, definition, layout, actions);
     this.current = editor;context.subscriptions.push(panel);
@@ -55,7 +55,7 @@ export class FmWebAppPanel {
         return;
       }
       const checked = intakeDefinitionSchema.safeParse(request.definition);
-      if (!checked.success) throw new Error('Check the event title, labels and character limits. Single-choice fields need 1–100 unique choices, each at most 200 characters.');
+      if (!checked.success) throw new Error('Check the form title, labels and character limits. Single-choice fields need 1–100 unique choices, each at most 200 characters.');
       const definition = checked.data;
       if (definition.id !== this.original.id || definition.layoutId !== this.original.layoutId || definition.environmentId !== this.original.environmentId
         || definition.fields.some((field) => !this.fields.some((allowed) => allowed.id === field.id && allowed.fmFieldName === field.fmFieldName))) {
@@ -71,7 +71,7 @@ export class FmWebAppPanel {
   }
 }
 
-export function renderAppEditor(webview: vscode.Webview, context: vscode.ExtensionContext, definition: IntakeDefinition, fields: IntakeField[], sourceName = 'Sample registration fields', draft?: { unmatched: string[] }): string {
+export function renderAppEditor(webview: vscode.Webview, context: vscode.ExtensionContext, definition: IntakeDefinition, fields: IntakeField[], sourceName = 'Sample fields', draft?: { unmatched: string[] }): string {
   const nonce = createNonce();
   const script = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'webviews', 'fmWebApp', 'ui', 'main.js'));
   const selected = new Set(definition.fields.map((field) => field.id));
@@ -80,18 +80,18 @@ export function renderAppEditor(webview: vscode.Webview, context: vscode.Extensi
 <meta http-equiv="Content-Security-Policy" content="${buildWebviewCsp(webview, { nonce, allowInlineStyleWithNonce: true })}"/>
 <title>Create FM Web App</title><style nonce="${nonce}">${standardFieldsCss(true)}
 body{max-width:1000px;margin:0 auto;padding:24px}label{display:block;margin-top:12px}input,select,textarea{box-sizing:border-box;max-width:100%;width:100%}input[type=checkbox]{width:auto}fieldset{margin:16px 0;padding:16px;border:1px solid var(--vscode-panel-border)}.actions{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.field-title{display:flex;align-items:center;gap:8px}.field-title label{margin:0}.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}.wide{grid-column:1/-1}code{white-space:pre-wrap;overflow-wrap:anywhere}button{cursor:pointer}#status{white-space:pre-wrap}#status.error{color:var(--vscode-errorForeground)}@media(max-width:600px){.field-grid{grid-template-columns:1fr}}
-</style></head><body class="fm-page"><h1>Create FM Web App</h1><p>Event registration · Select fields, customize your form, then save and preview.</p><p>Field layout: <strong>${escapeHtml(sourceName)}</strong></p>
-<p role="note">Save and preview uses sample registrations. Save to FileMaker enables real record creation only after you confirm the connection and layout in VS Code.</p>
+</style></head><body class="fm-page"><h1>Create FM Web App</h1><p>Select fields, customize your form, then save and preview.</p><p>Field layout: <strong>${escapeHtml(sourceName)}</strong></p>
+<p role="note">Save and preview uses sample submissions. Save to FileMaker enables real record creation only after you confirm the connection and layout in VS Code.</p>
 ${draft ? '<p role="note">Review the suggested field mappings and required settings before saving.</p>' : ''}
 ${draft?.unmatched.length ? `<p>Check these requests against your FileMaker fields: ${escapeHtml(draft.unmatched.join(', '))}.</p>` : ''}
-<form id="app-form"><button type="button" data-action="source">Choose FileMaker fields</button><button type="button" data-action="draft">Draft form from a prompt</button><fieldset><legend>Event and branding</legend>
-${input('title', 'Event title', definition.title, 160)}
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
diff --git a/extension/test/unit/createFmWebApp.test.ts b/extension/test/unit/createFmWebApp.test.ts
index 9f4a2bd..49bcb70 100644
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
@@ -32,23 +33,34 @@ beforeEach(async () => {
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
   it('preselects prompt matches from the chosen layout and opens a draft without saving or starting preview', async () => {
     const { deps, project } = fixture();
     vi.mocked(vscode.window.showInputBox).mockResolvedValue('Require attendee name and email, add optional session');
+    let step = 0;
     vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items, options) => {
-      const choices = items as unknown as Array<{ label: string; picked?: boolean }>;
+      const choices = items as unknown as Array<Picker & { picked?: boolean }>;
       if (options?.canPickMany) {
         expect(choices.map(({ label, picked }) => [label, picked])).toEqual([[' Full Name ', true], ['Email', true]]);
         return choices.filter((item) => item.picked) as never;
       }
+      if (step++ === 0) return (choices.find((item) => item.label === 'Event Registration') ?? choices[0]) as never;
       return (choices.find((item) => item.label === 'Draft form from a prompt') ?? choices[0]) as never;
     });
     await createFmWebApp(deps as never);
@@ -63,11 +75,64 @@ describe('Create FM Web App production controller', () => {
     expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: 'event-registration' });
   });
 
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
   it('cancels the prompt without selecting fields, saving files or opening an editor', async () => {
     const { deps, project } = fixture();pickFileMaker();
     vi.mocked(vscode.window.showInputBox).mockResolvedValue(undefined);
     await createFmWebApp(deps as never, { source: 'draft' });
-    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(2);
+    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(3);
     expect(open).not.toHaveBeenCalled();
     expect(project.ensureProjectInitialized).not.toHaveBeenCalled();
   });
@@ -75,8 +140,18 @@ describe('Create FM Web App production controller', () => {
   it('resumes prompt drafting after creating the first connection', async () => {
     const { deps } = fixture();deps.profileStore.listProfiles.mockResolvedValue([]);
     vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Add Connection' as never);
+    pickSequence(['Event Registration', 'Use FileMaker fields']);
     await createFmWebApp(deps as never, { source: 'draft' });
-    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true, draft: true });
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
     expect(open).not.toHaveBeenCalled();
   });
 
@@ -99,7 +174,7 @@ describe('Create FM Web App production controller', () => {
     const { deps } = fixture();deps.profileStore.listProfiles.mockResolvedValue([]);pickFileMaker();
     vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Add Connection' as never);
     await createFmWebApp(deps as never);
-    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true });
+    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true, starter: 'event-registration' });
     expect(open).not.toHaveBeenCalled();
   });
   it('changes a sample app to FileMaker fields on Save and preserves the original source', async () => {
@@ -126,22 +201,27 @@ describe('Create FM Web App production controller', () => {
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
@@ -154,4 +234,14 @@ describe('Create FM Web App production controller', () => {
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
diff --git a/extension/test/unit/webviews/connectionWizardConnectOffer.test.ts b/extension/test/unit/webviews/connectionWizardConnectOffer.test.ts
index 63bb279..42aad13 100644
--- a/extension/test/unit/webviews/connectionWizardConnectOffer.test.ts
+++ b/extension/test/unit/webviews/connectionWizardConnectOffer.test.ts
@@ -17,7 +17,7 @@ interface CapturedPanel {
   secretStore: { setPassword: ReturnType<typeof vi.fn> };
 }
 
-function setupPanel(editingProfile?: Record<string, unknown>, afterSave?: 'createFmWebApp' | 'draftFmWebApp'): CapturedPanel {
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
@@ -120,13 +120,19 @@ describe('Connection wizard post-save connect offer', () => {
     expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
   });
   it('resumes the prompt path after the first connection is saved', async () => {
-    const panel = setupPanel(undefined, 'draftFmWebApp');
+    const panel = setupPanel(undefined, { source: 'draft' });
     await panel.fireMessage(validSavePayload);
     await vi.waitFor(() => expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
       'filemakerDataApiTools.createFmWebApp', { source: 'draft', changeSource: true }));
   });
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

## Commits on the branch (origin/main..HEAD)

ae299871511e24828d911c4e9daaca8e6d77b3bf fix: keep the wizard and its documentation free of registration wording
4942169bf14428f047e7fe76b7aca533f639b41a fix: make the wizard wording starter-neutral
8472361b04e48872fa5c323b918264921ede4685 fix: make the starter identity consistent across the wizard
490743fd522aac8ca6db66fbb63ec512b50cc180 feat: start Create FM Web App from a starter

## The tip commit on its own (the most recent round's findings)

```diff
diff --git a/extension/docs/FM_WEB.md b/extension/docs/FM_WEB.md
index ca326bd..52d096e 100644
--- a/extension/docs/FM_WEB.md
+++ b/extension/docs/FM_WEB.md
@@ -8,8 +8,8 @@ Reference for the FM Web workflow (Layout Mode, generated Next.js runtime and th
 
 1. Open a trusted workspace folder. If none is open, the wizard offers to open one and resumes by itself once the window reloads.
 2. Choose a starter: **Event Registration** or **Feedback or Request Form**. The starter names the saved app, its file and its preview address, so choosing the same starter again reopens that app.
-3. Choose where the fields come from: **Try sample fields** starts immediately with invented data and no connection, **Use FileMaker fields** selects a saved connection, layout and registration fields, and **Draft form from a prompt** describes the form in your own words. If no connection exists, the flow offers the existing connection setup and resumes once it is saved.
-4. For FileMaker fields, choose a saved connection, a layout and the registration fields. The picker excludes calculations, summaries, containers and globals. Exact layout and field names are preserved.
+3. Choose where the fields come from: **Try sample fields** starts immediately with invented data and no connection, **Use FileMaker fields** selects a saved connection, layout and fields, and **Draft form from a prompt** describes the form in your own words. If no connection exists, the flow offers the existing connection setup and resumes once it is saved.
+4. For FileMaker fields, choose a saved connection, a layout and the fields. The picker excludes calculations, summaries, containers and globals. Exact layout and field names are preserved.
 5. For a prompt, describe the form in your own words. The extension suggests the writable fields of the chosen layout that your wording points at, marks the ones you called required or optional, and lists the requests it could not map. Review the suggestions in the field picker and the form editor before saving. Exact layout and field names are preserved, and read-only or ambiguous fields are never suggested.
 6. Customize the form in its editor: title and description, submit/success text, organization and accent color, included fields, labels, help, required rules, input types, maximum lengths and single-choice options. Move fields up or down to set their order.
 7. Choose **Save and preview** for a sample-only browser session with invented details, or **Save to FileMaker** to accept real registrations. The latter saves the form, names the connection, database and layout in a native confirmation, and opens a private browser session only after you choose **Enable FileMaker saves**. Submitting that browser form creates a real FileMaker record.
diff --git a/extension/docs/USER_GUIDE.md b/extension/docs/USER_GUIDE.md
index 49aa9ad..52bd38e 100644
--- a/extension/docs/USER_GUIDE.md
+++ b/extension/docs/USER_GUIDE.md
@@ -802,7 +802,7 @@ Regenerate after a schema change, and use a [schema diff](#schema-snapshots-and-
 
 ## FM Web and Layout Mode
 
-Start with **FileMaker: Create FM Web App**, or the new-file button above Connections. Choose a starter, **Event Registration** or **Feedback or Request Form**; the starter names the saved app, so choosing the same one again reopens it. Then choose where the fields come from: **Try sample fields** to start immediately with invented data and no connection, **Use FileMaker fields** to select a saved connection, layout and writable registration fields, or **Draft form from a prompt** to describe the form in words and review the fields the extension suggests. If no workspace folder is open, the wizard offers to open one and resumes by itself afterwards; if no connection exists, the wizard offers the existing connection setup and resumes once it is saved. The form editor lets you change labels, help text, required rules, input types, choices, field order, event text and organization/color branding without editing JSON. Choose **Save and preview** for invented sample registrations, or **Save to FileMaker** for real registrations. The latter names the connection, database and layout in a native confirmation; choose **Enable FileMaker saves** to open the private browser form. Submitting that form creates a real record.
+Start with **FileMaker: Create FM Web App**, or the new-file button above Connections. Choose a starter, **Event Registration** or **Feedback or Request Form**; the starter names the saved app, so choosing the same one again reopens it. Then choose where the fields come from: **Try sample fields** to start immediately with invented data and no connection, **Use FileMaker fields** to select a saved connection, layout and writable fields, or **Draft form from a prompt** to describe the form in words and review the fields the extension suggests. If no workspace folder is open, the wizard offers to open one and resumes by itself afterwards; if no connection exists, the wizard offers the existing connection setup and resumes once it is saved. The form editor lets you change labels, help text, required rules, input types, choices, field order, the title and description and organization/color branding without editing JSON. Choose **Save and preview** for invented sample submissions, or **Save to FileMaker** for real submissions. The latter names the connection, database and layout in a native confirmation; choose **Enable FileMaker saves** to open the private browser form. Submitting that form creates a real record.
 
 Reopen **Create FM Web App** to continue editing the saved app. Sample preview creates no records. Real registrations use only the confirmed connection, layout and mapped fields, with workspace trust, offline and write-policy checks; credentials stay in the extension. A persisted submission identifier prevents a completed or uncertain write from being dispatched again after restarting the preview. If a result is uncertain, check FileMaker before starting a new submission. Use **Choose FileMaker fields** in the editor to replace sample fields or select fields again, or **Draft form from a prompt** to describe the form in words instead. Your saved app stays unchanged until you save the replacement. **Export app** creates an editable app folder, not a public deployment. See [Create FM Web App](./FM_WEB.md#create-fm-web-app) for the complete flow.
 
diff --git a/extension/docs/walkthroughs/create-web-app.md b/extension/docs/walkthroughs/create-web-app.md
index 2e5cf59..b48ca26 100644
--- a/extension/docs/walkthroughs/create-web-app.md
+++ b/extension/docs/walkthroughs/create-web-app.md
@@ -4,7 +4,7 @@ Run **FileMaker: Create FM Web App**, or use the new-file button above Connectio
 
 Choose a starter, **Event Registration** or **Feedback or Request Form**. The starter names the saved app, so choosing the same starter again reopens it instead of starting over.
 
-Choose **Try sample fields** to start with invented data and no connection, or **Use FileMaker fields** from a saved connection and layout. Select the registration fields, then edit the title, branding, labels, required rules and choices in the form editor. Use Move up and Move down to arrange fields.
+Choose **Try sample fields** to start with invented data and no connection, or **Use FileMaker fields** from a saved connection and layout. Select the fields, then edit the title, branding, labels, required rules and choices in the form editor. Use Move up and Move down to arrange fields.
 
 Choose **Draft form from a prompt** to describe the fields you want. Pick a FileMaker layout, review the suggested mappings, and adjust the draft in the form editor. Suggestions use field metadata and the extension matches them on your computer.
 
diff --git a/extension/src/commands/createFmWebApp.ts b/extension/src/commands/createFmWebApp.ts
index fa2fb28..5037e9b 100644
--- a/extension/src/commands/createFmWebApp.ts
+++ b/extension/src/commands/createFmWebApp.ts
@@ -112,7 +112,7 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
       const metadata = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Reading fields' }, () => fmClient.getLayoutMetadata(profile!, selected.name, { recordHistory: false }));
       const all = designerLayoutMetadata(selected.name, metadata).fields;
       const writable = writableAppFields(all);
-      if (!writable.length) throw new Error('This layout has no writable, nonglobal fields. Choose a registration layout with editable fields.');
+      if (!writable.length) throw new Error('This layout has no writable, nonglobal fields. Choose a layout with editable fields.');
       if (source.value === 'draft') {
         const prompt = await vscode.window.showInputBox({
           title: 'Draft form from a prompt',
```
