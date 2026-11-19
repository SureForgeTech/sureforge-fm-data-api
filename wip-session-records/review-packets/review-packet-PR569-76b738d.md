# Independent review packet — PR #569 (head 76b738d)

- Repository: SureForgeTech/sureforge-fm-data-api
- Working checkout: /workspace/sureforge-fm-data-api-wt-569
- Branch: codex/mock-registration-lost-receipt
- Exact head SHA under review: 76b738d531d3f6622d617f7d5edbde2a6ea9a1ba
- Head tree SHA: f593eb520b1b9379ab4263dbb33967ae6ca58bb3
- Base ref: origin/main (882d2884f617ca58a2d07755df4db550f9e6dd37)
- Merge base: 882d2884f617ca58a2d07755df4db550f9e6dd37
- Commit under review:
    76b738d531d3f6622d617f7d5edbde2a6ea9a1ba
    author: Alan Deffenderfer (macbookprom5) <4432479+macbookprom5@users.noreply.github.com>
    date: Wed Nov 18 02:25:48 2026 -0700
    subject: Merge origin/main into codex/mock-registration-lost-receipt
    body:
  Signed-off-by: Alan Deffenderfer (macbookprom5) <4432479+macbookprom5@users.noreply.github.com>
  

## Validation the author ran, and the actual exit status of each step

Gate script: /tmp/opencode/fm-gate.sh. It runs the repository's declared validation
in the same order as .github/workflows/ci.yml job build-test. Exit statuses:

```
```

The authoritative per-step exit codes are printed in the gate transcript and recorded
in the summary below.

```
(summary not yet written)
```

### Note on the sandbox proxy environment

The sandbox exports HTTP_PROXY/HTTPS_PROXY. The extension's TLS/proxy code treats an
environment proxy as 'a proxy is configured on this computer' and fails closed, which
changes the outcome of 26 TLS/proxy unit tests that assert on a direct route.
GitHub-hosted runners have no proxy variables, so the gate unsets them for the test
steps. This was reproduced on unmodified main in this same sandbox before any change
was made: those 26 tests fail with the proxy set and pass with it unset.

## Acceptance criteria (from the pull request)

## Acceptance criteria mirror

- [x] Fault runs after a successful create for direct and proxy connections.
- [x] Validate a persisted record and a single create across retry and service restart.
- [x] Document how to reproduce with synthetic fixtures.

## Test plan

## Repository rules that bound this change

- AGENTS.md (repo root, read the checked-out copy at /workspace/sureforge-fm-data-api-wt-569/AGENTS.md).
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

This branch's feature work is a single commit, `7059d4f6bd9793f8d72e1a101b9d5551ad33744b`. The head under review, `76b738d531d3f6622d617f7d5edbde2a6ea9a1ba`, is that commit merged with the then-current `origin/main` (`882d288`), which is the merge of the prompt drafting pull request.

An earlier review of the feature commit at `7059d4f` returned no findings. Under the repository's rule, "a clean automatic merge of the base branch keeps the review". Your review must nevertheless judge the CURRENT head independently, and in particular confirm that the merge did not change the behaviour under test.

What the change does, and what to hold it to:

1. The mock commits the record and only then drops the reply. The commit must happen before the socket is closed; the client must see a lost reply, not an error response.
2. The fault is opt-in, one-use and path-scoped, so it cannot fire on unrelated requests or leak into another test.
3. The test proves the acceptance criteria end to end: exactly one committed record; the reply dropped; no second create when the same submission is retried; and no second create when the registration service is restarted. Check that the "no second create" claim is asserted against the request log and not only inferred from the record count.
4. The proxy path behaves the same as the direct path.
5. The fault is recorded in the request log for the dropped request only.
6. Synthetic data only: no real credentials, no customer data, no secret written to disk or into a log.

The issue the change closes, #568, states the same acceptance criteria and records that standalone packaging and public distribution are separate work that this change does not attempt.

## Complete git-generated diff (origin/main...HEAD)

This diff is produced verbatim by git. Every changed path and hunk is included;
nothing is summarized, reformatted or truncated.

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index ad785d9..fecbb22 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -45,6 +45,8 @@ PR title prefix matches the highest-tier label added:
 
 ### [INTERNAL]
 
+- The loopback FileMaker mock can save a record and drop its reply, so registration tests verify that an uncertain write is not retried.
+
 - Pull requests are now welcome with a DCO sign-off (`git commit -s`): the organization contributing guide says so, and a new `dco` workflow checks the sign-off on pull requests from outside contributors.
 - The licence changes from MIT to Apache-2.0, with a NOTICE file. Releases published before this change keep the MIT licence they shipped with; only new releases carry Apache-2.0.
 - Update `CODE_OF_CONDUCT.md` to the Contributor Covenant 2.1 text with the project-wide enforcement contact (contribute@sureforgetech.com).
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
```

## Commits on the branch (origin/main..HEAD)

76b738d531d3f6622d617f7d5edbde2a6ea9a1ba Merge origin/main into codex/mock-registration-lost-receipt
7059d4f6bd9793f8d72e1a101b9d5551ad33744b Test committed registrations with lost FileMaker replies

## The tip commit on its own (the most recent round's findings)

```diff
diff --git a/.github/workflows/dco.yml b/.github/workflows/dco.yml
index 0a52415..810d716 100644
--- a/.github/workflows/dco.yml
+++ b/.github/workflows/dco.yml
@@ -28,13 +28,15 @@ jobs:
           PR: ${{ github.event.pull_request.number }}
           ASSOCIATION: ${{ github.event.pull_request.author_association }}
           AUTHOR_TYPE: ${{ github.event.pull_request.user.type }}
+        # Messages are checked with carriage returns removed, so a commit written with
+        # Windows line endings is recognised as signed off.
         run: |
           case "$ASSOCIATION" in
             OWNER|MEMBER|COLLABORATOR) echo "Maintainer pull request: sign-off not required."; exit 0 ;;
           esac
           if [ "$AUTHOR_TYPE" = "Bot" ]; then echo "Bot pull request: sign-off not required."; exit 0; fi
           missing=$(gh api --paginate "repos/$REPO/pulls/$PR/commits" \
-            --jq '.[] | select((.parents | length) == 1) | select((.commit.message | test("(^|\n)Signed-off-by: [^\n]+ <[^>\n]+>(\n|$)")) | not) | .sha[0:12]')
+            --jq '.[] | select((.parents | length) == 1) | select((.commit.message | gsub("\r"; "") | test("(^|\n)Signed-off-by: [^\n]+ <[^>\n]+>(\n|$)")) | not) | .sha[0:12]')
           if [ -n "$missing" ]; then
             echo "These commits are missing a Signed-off-by line (amend them with git commit -s, then force-push the branch with --force-with-lease):"
             echo "$missing"
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 8fd2550..fecbb22 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -24,6 +24,8 @@ PR title prefix matches the highest-tier label added:
 
 ### [FEATURE]
 
+- Draft a form from a prompt using your existing FileMaker connection, then review suggested fields and preview in the visual editor.
+
 - Event-registration forms can save real records to an explicitly confirmed FileMaker connection through the private extension bridge. Persistent submission tracking prevents automatic retries after an uncertain write; sample preview remains available.
 
 - Create FM Web App is the main guided workflow: choose FileMaker or sample fields, customize an event-registration form without JSON, save and preview, then reopen it to continue editing. Existing commands remain available.
diff --git a/extension/CHANGELOG.md b/extension/CHANGELOG.md
index 65eb094..8baec33 100644
--- a/extension/CHANGELOG.md
+++ b/extension/CHANGELOG.md
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+- Describe a form in Create FM Web App and review suggested FileMaker fields in the visual editor.
+
 **Licence**
 
 - The licence changes from MIT to Apache-2.0, with a NOTICE file. Releases published before this change keep the MIT licence they shipped with; only new releases carry Apache-2.0.
diff --git a/extension/docs/FM_WEB.md b/extension/docs/FM_WEB.md
index 6796a32..653a56f 100644
--- a/extension/docs/FM_WEB.md
+++ b/extension/docs/FM_WEB.md
@@ -6,11 +6,12 @@ Reference for the FM Web workflow (Layout Mode, generated Next.js runtime and th
 
 **FileMaker: Create FM Web App** is the main entry point. It is also available from the new-file button above Connections and the first Getting Started step.
 
-1. Open a trusted workspace folder. Choose **Use FileMaker fields** or **Try sample fields**.
+1. Open a trusted workspace folder. Choose **Use FileMaker fields**, **Draft form from a prompt** or **Try sample fields**.
 2. For FileMaker fields, choose a saved connection, a layout and the registration fields. The picker excludes calculations, summaries, containers and globals. Exact layout and field names are preserved. If no connection exists, the flow offers the existing connection setup.
-3. Customize the event-registration form in its editor: event title and description, submit/success text, organization and accent color, included fields, labels, help, required rules, input types, maximum lengths and single-choice options. Move fields up or down to set their order.
-4. Choose **Save and preview** for a sample-only browser session with invented details, or **Save to FileMaker** to accept real registrations. The latter saves the form, names the connection, database and layout in a native confirmation, and opens a private browser session only after you choose **Enable FileMaker saves**. Submitting that browser form creates a real FileMaker record.
-5. Run **Create FM Web App** again to continue editing the saved app. No setup commands or JSON editing are needed for the normal create/customize/preview path.
+3. For a prompt, describe the form in your own words. The extension suggests the writable fields of the chosen layout that your wording points at, marks the ones you called required or optional, and lists the requests it could not map. Review the suggestions in the field picker and the form editor before saving. Exact layout and field names are preserved, and read-only or ambiguous fields are never suggested.
+4. Customize the event-registration form in its editor: event title and description, submit/success text, organization and accent color, included fields, labels, help, required rules, input types, maximum lengths and single-choice options. Move fields up or down to set their order.
+5. Choose **Save and preview** for a sample-only browser session with invented details, or **Save to FileMaker** to accept real registrations. The latter saves the form, names the connection, database and layout in a native confirmation, and opens a private browser session only after you choose **Enable FileMaker saves**. Submitting that browser form creates a real FileMaker record.
+6. Run **Create FM Web App** again to continue editing the saved app. No setup commands or JSON editing are needed for the normal create/customize/preview path.
 
 Saves preserve the authored source layout and refuse to replace a form changed by another editor. Reopen the app editor to load those changes. Cancelling field selection creates no app definition. The advanced **Export app** action generates an editable app folder and reveals it in VS Code; **Source layout** opens Layout Mode. Export does not publish a website or configure a live submission backend.
 
diff --git a/extension/docs/USER_GUIDE.md b/extension/docs/USER_GUIDE.md
index 7efbf6c..19cc797 100644
--- a/extension/docs/USER_GUIDE.md
+++ b/extension/docs/USER_GUIDE.md
@@ -802,9 +802,9 @@ Regenerate after a schema change, and use a [schema diff](#schema-snapshots-and-
 
 ## FM Web and Layout Mode
 
-Start with **FileMaker: Create FM Web App**, or the new-file button above Connections. Choose **Use FileMaker fields** to select a saved connection, layout and writable registration fields, or choose **Try sample fields** without a connection. The form editor lets you change labels, help text, required rules, input types, choices, field order, event text and organization/color branding without editing JSON. Choose **Save and preview** for invented sample registrations, or **Save to FileMaker** for real registrations. The latter names the connection, database and layout in a native confirmation; choose **Enable FileMaker saves** to open the private browser form. Submitting that form creates a real record.
+Start with **FileMaker: Create FM Web App**, or the new-file button above Connections. Choose **Use FileMaker fields** to select a saved connection, layout and writable registration fields, choose **Draft form from a prompt** to describe the form in words and review the fields the extension suggests, or choose **Try sample fields** without a connection. The form editor lets you change labels, help text, required rules, input types, choices, field order, event text and organization/color branding without editing JSON. Choose **Save and preview** for invented sample registrations, or **Save to FileMaker** for real registrations. The latter names the connection, database and layout in a native confirmation; choose **Enable FileMaker saves** to open the private browser form. Submitting that form creates a real record.
 
-Reopen **Create FM Web App** to continue editing the saved app. Sample preview creates no records. Real registrations use only the confirmed connection, layout and mapped fields, with workspace trust, offline and write-policy checks; credentials stay in the extension. A persisted submission identifier prevents a completed or uncertain write from being dispatched again after restarting the preview. If a result is uncertain, check FileMaker before starting a new submission. Use **Choose FileMaker fields** in the editor to replace sample fields or select fields again. Your saved app stays unchanged until you save the replacement. **Export app** creates an editable app folder, not a public deployment. See [Create FM Web App](./FM_WEB.md#create-fm-web-app) for the complete flow.
+Reopen **Create FM Web App** to continue editing the saved app. Sample preview creates no records. Real registrations use only the confirmed connection, layout and mapped fields, with workspace trust, offline and write-policy checks; credentials stay in the extension. A persisted submission identifier prevents a completed or uncertain write from being dispatched again after restarting the preview. If a result is uncertain, check FileMaker before starting a new submission. Use **Choose FileMaker fields** in the editor to replace sample fields or select fields again, or **Draft form from a prompt** to describe the form in words instead. Your saved app stays unchanged until you save the replacement. **Export app** creates an editable app folder, not a public deployment. See [Create FM Web App](./FM_WEB.md#create-fm-web-app) for the complete flow.
 
 The following commands remain available for advanced projects, existing workflows and source-layout editing. **Build a Portal** also retains its earlier JSON-based starter and repair actions.
 
diff --git a/extension/docs/walkthroughs/create-web-app.md b/extension/docs/walkthroughs/create-web-app.md
index 07982b5..33986e5 100644
--- a/extension/docs/walkthroughs/create-web-app.md
+++ b/extension/docs/walkthroughs/create-web-app.md
@@ -2,6 +2,8 @@
 
 Run **FileMaker: Create FM Web App**, or use the new-file button above Connections.
 
+Choose **Draft form from a prompt** to describe the fields you want. Pick a FileMaker layout, review the suggested mappings, and adjust the draft in the form editor. Suggestions use field metadata and the extension matches them on your computer.
+
 Choose FileMaker fields from a saved connection and layout, or start with sample fields. Select the registration fields, then edit the event title, branding, labels, required rules and choices in the form editor. Use Move up and Move down to arrange fields.
 
 Choose **Save and preview** for an invented-data sample, or **Save to FileMaker** to accept real registrations. The latter saves the app and names the connection, database and layout in a native confirmation. Choose **Enable FileMaker saves**, then submit the private browser form to create a real record. Credentials stay in the extension. Return to **Create FM Web App** to continue editing the saved app.
diff --git a/extension/src/commands/createFmWebApp.ts b/extension/src/commands/createFmWebApp.ts
index 396fb18..65f3c47 100644
--- a/extension/src/commands/createFmWebApp.ts
+++ b/extension/src/commands/createFmWebApp.ts
@@ -4,6 +4,7 @@ import { designerLayoutMetadata } from '../fmweb/fieldMetadata';
 import { FmWebAppPanel } from '../webviews/fmWebApp';
 import { FmWebIntakeService, type SavedIntake } from '../services/fmWebIntakeService';
 import { registrationAppFromFields, writableAppFields } from '../services/fmWebAppModel';
+import { MAX_FORM_PROMPT_LENGTH, suggestPromptFields } from '../services/fmWebPromptDraft';
 import type { FMClient } from '../services/fmClient';
 import type { FmWebProjectService } from '../services/fmWebProjectService';
 import type { FmWebRuntimeGenerator } from '../services/fmWebRuntimeGenerator';
@@ -18,7 +19,7 @@ interface CreateAppDependencies {
   fmClient: FMClient;
 }
 
-export interface CreateAppOptions { source?: 'filemaker'; changeSource?: boolean }
+export interface CreateAppOptions { source?: 'filemaker' | 'draft'; changeSource?: boolean }
 
 export async function createFmWebApp(deps: CreateAppDependencies, options: CreateAppOptions = {}): Promise<void> {
   const { context, project, generator, profileStore, fmClient } = deps;
@@ -41,6 +42,7 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
   let saved: SavedIntake | undefined;
   let model: { definition: IntakeDefinition; layout: LayoutDefinition };
   let profile: ConnectionProfile | undefined;
+  let draft: ReturnType<typeof suggestPromptFields> | undefined;
   try { saved = await intakes.loadForEditing('event-registration');model = saved; }
   catch (error) {
     if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
@@ -49,8 +51,9 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
     catch (existingError) { if ((existingError as NodeJS.ErrnoException).code !== 'ENOENT') throw existingError; }
   }
   if (!saved || options.changeSource) {
-    const source = options.source === 'filemaker' ? { value: 'filemaker' } : await vscode.window.showQuickPick([
+    const source = options.source ? { value: options.source } : await vscode.window.showQuickPick([
       { label: 'Use FileMaker fields', description: 'Choose a connection, layout and registration fields', value: 'filemaker' },
+      { label: 'Draft form from a prompt', description: 'Describe a form and review suggested FileMaker fields', value: 'draft' },
       { label: 'Try sample fields', description: 'Start immediately without a FileMaker connection', value: 'sample' }
     ], { title: 'Create FM Web App · Event registration', placeHolder: 'Where should the form fields come from?', ignoreFocusOut: true });
     if (!source) return;
@@ -60,7 +63,7 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
       if (!profiles.length) {
         const answer = await vscode.window.showInformationMessage('Add a FileMaker connection to choose its fields.', 'Add Connection');
         if (answer !== 'Add Connection') return;
-        await vscode.commands.executeCommand('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true });
+        await vscode.commands.executeCommand('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true, ...(source.value === 'draft' ? { draft: true } : {}) });
         return;
       }
       const picked = await vscode.window.showQuickPick(profiles.map((item) => ({ label: item.name, description: item.database, profile: item })),
@@ -74,9 +77,33 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
       const all = designerLayoutMetadata(selected.name, metadata).fields;
       const writable = writableAppFields(all);
       if (!writable.length) throw new Error('This layout has no writable, nonglobal fields. Choose a registration layout with editable fields.');
-      const fields = await vscode.window.showQuickPick(writable.map((field) => ({ label: field.name,
-        description: field.type ?? 'Text', picked: /^(?:full[ _]?name|first[ _]?name|last[ _]?name|email(?:[ _]?address)?|session|notes)$/i.test(field.name.trim()), field })),
-      { title: 'Create FM Web App · Fields', placeHolder: 'Select 1–100 registration fields. Calculations, summaries, containers and globals are excluded.', canPickMany: true, ignoreFocusOut: true });
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
+          : 'Select 1–100 writable registration fields.',
+        canPickMany: true, ignoreFocusOut: true
+      });
       if (!fields) return;
       model = registrationAppFromFields(selected.name, fields.map((item) => item.field));
     }
@@ -89,6 +116,14 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
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
@@ -107,7 +142,7 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
         saved = saved ? await intakes.saveApp(definition, saved.revision, selectedModel.layout) : await intakes.createApp(definition, selectedModel.layout);
       } else saved = await intakes.saveApp(definition, saved.revision);
     },
-    changeSource: async () => { await vscode.commands.executeCommand('filemakerDataApiTools.createFmWebApp', { source: 'filemaker', changeSource: true }); },
+    changeSource: async (source = 'filemaker') => { await vscode.commands.executeCommand('filemakerDataApiTools.createFmWebApp', { source, changeSource: true }); },
     run: async (action) => {
       assertAvailable();
       if (action === 'filemaker') await vscode.commands.executeCommand('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: 'event-registration', registrationMode: 'filemaker' });
@@ -118,5 +153,5 @@ export async function createFmWebApp(deps: CreateAppDependencies, options: Creat
         await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(generator.getGeneratedRuntimeRoot()));
       }
     }
-  });
+  }, draft);
 }
diff --git a/extension/src/commands/fmWebProject.ts b/extension/src/commands/fmWebProject.ts
index 2d6366c..b75a9f8 100644
--- a/extension/src/commands/fmWebProject.ts
+++ b/extension/src/commands/fmWebProject.ts
@@ -62,7 +62,7 @@ export function registerFmWebProjectCommands(
     vscode.commands.registerCommand('filemakerDataApiTools.createFmWebApp', async (arg: unknown) => {
       if (appStarting) return;
       appStarting = true;
-      try { await createFmWebApp({ context, project: fmWebProjectService, generator: fmWebRuntimeGenerator, profileStore, fmClient }, arg && typeof arg === 'object' ? { source: 'source' in arg && arg.source === 'filemaker' ? 'filemaker' : undefined, changeSource: 'changeSource' in arg && arg.changeSource === true } : {}); }
+      try { await createFmWebApp({ context, project: fmWebProjectService, generator: fmWebRuntimeGenerator, profileStore, fmClient }, arg && typeof arg === 'object' ? { source: 'source' in arg && (arg.source === 'filemaker' || arg.source === 'draft') ? arg.source : undefined, changeSource: 'changeSource' in arg && arg.changeSource === true } : {}); }
       catch (error) { await showCommandError(error, { fallbackMessage: 'Could not create the FM Web app.', logger, logMessage: 'Create FM Web App failed.' }); }
       finally { appStarting = false; }
     }),
diff --git a/extension/src/commands/index.ts b/extension/src/commands/index.ts
index f589bbe..6a6d4de 100644
--- a/extension/src/commands/index.ts
+++ b/extension/src/commands/index.ts
@@ -95,7 +95,8 @@ export function registerCoreCommands(deps: RegisterCoreCommandDeps): vscode.Disp
 
       ConnectionWizardPanel.createOrShow(context, profileStore, secretStore, fmClient, logger, undefined, {
         getTestPolicy: deps.getConnectionWizardTestPolicy,
-        afterSave: arg && typeof arg === 'object' && 'continueToFmWebApp' in arg && arg.continueToFmWebApp === true ? 'createFmWebApp' : undefined
+        afterSave: arg && typeof arg === 'object' && 'continueToFmWebApp' in arg && arg.continueToFmWebApp === true
+          ? ('draft' in arg && arg.draft === true ? 'draftFmWebApp' : 'createFmWebApp') : undefined
       });
     }),
 
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
diff --git a/extension/src/webviews/connectionWizard/save.ts b/extension/src/webviews/connectionWizard/save.ts
index 89e4249..09c33e1 100644
--- a/extension/src/webviews/connectionWizard/save.ts
+++ b/extension/src/webviews/connectionWizard/save.ts
@@ -129,9 +129,10 @@ export async function handleSave(ctx: WizardContext, data: WizardFormData): Prom
       message: `Profile "${profile.name}" saved.`
     });
 
-    if (isNewProfile && ctx.options.afterSave === 'createFmWebApp') {
+    if (isNewProfile && ctx.options.afterSave) {
+      const source = ctx.options.afterSave === 'draftFmWebApp' ? 'draft' : 'filemaker';
       ctx.options.afterSave = undefined;
-      await vscode.commands.executeCommand('filemakerDataApiTools.createFmWebApp', { source: 'filemaker', changeSource: true });
+      await vscode.commands.executeCommand('filemakerDataApiTools.createFmWebApp', { source, changeSource: true });
       return;
     }
 
diff --git a/extension/src/webviews/connectionWizard/types.ts b/extension/src/webviews/connectionWizard/types.ts
index df9015d..7919e7d 100644
--- a/extension/src/webviews/connectionWizard/types.ts
+++ b/extension/src/webviews/connectionWizard/types.ts
@@ -8,7 +8,7 @@ export type ConnectionWizardTestPolicy = 'off' | 'warn' | 'block';
 
 export interface ConnectionWizardOptions {
   /** One-shot continuation after credentials have been saved successfully. */
-  afterSave?: 'createFmWebApp';
+  afterSave?: 'createFmWebApp' | 'draftFmWebApp';
   /** Resolved at message time so settings updates flow live. */
   getTestPolicy?: () => ConnectionWizardTestPolicy;
 }
diff --git a/extension/src/webviews/fmWebApp/index.ts b/extension/src/webviews/fmWebApp/index.ts
index 52bcf39..08026e1 100644
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
     const panel = vscode.window.createWebviewPanel('filemakerFmWebApp', 'FM Web App — Event registration', vscode.ViewColumn.One,
       { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webviews', 'fmWebApp', 'ui')] });
     const editor = new FmWebAppPanel(panel, definition, layout, actions);
     this.current = editor;context.subscriptions.push(panel);
-    panel.webview.html = renderAppEditor(panel.webview, context, definition, editor.fields, layout.fmLayoutName);
+    panel.webview.html = renderAppEditor(panel.webview, context, definition, editor.fields, layout.fmLayoutName, draft);
   }
 
   private constructor(private readonly panel: vscode.WebviewPanel, private readonly original: IntakeDefinition,
@@ -45,11 +45,12 @@ export class FmWebAppPanel {
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
@@ -70,7 +71,7 @@ export class FmWebAppPanel {
   }
 }
 
-export function renderAppEditor(webview: vscode.Webview, context: vscode.ExtensionContext, definition: IntakeDefinition, fields: IntakeField[], sourceName = 'Sample registration fields'): string {
+export function renderAppEditor(webview: vscode.Webview, context: vscode.ExtensionContext, definition: IntakeDefinition, fields: IntakeField[], sourceName = 'Sample registration fields', draft?: { unmatched: string[] }): string {
   const nonce = createNonce();
   const script = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'webviews', 'fmWebApp', 'ui', 'main.js'));
   const selected = new Set(definition.fields.map((field) => field.id));
@@ -81,7 +82,9 @@ export function renderAppEditor(webview: vscode.Webview, context: vscode.Extensi
 body{max-width:1000px;margin:0 auto;padding:24px}label{display:block;margin-top:12px}input,select,textarea{box-sizing:border-box;max-width:100%;width:100%}input[type=checkbox]{width:auto}fieldset{margin:16px 0;padding:16px;border:1px solid var(--vscode-panel-border)}.actions{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.field-title{display:flex;align-items:center;gap:8px}.field-title label{margin:0}.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}.wide{grid-column:1/-1}code{white-space:pre-wrap;overflow-wrap:anywhere}button{cursor:pointer}#status{white-space:pre-wrap}#status.error{color:var(--vscode-errorForeground)}@media(max-width:600px){.field-grid{grid-template-columns:1fr}}
 </style></head><body class="fm-page"><h1>Create FM Web App</h1><p>Event registration · Select fields, customize your form, then save and preview.</p><p>Field layout: <strong>${escapeHtml(sourceName)}</strong></p>
 <p role="note">Save and preview uses sample registrations. Save to FileMaker enables real record creation only after you confirm the connection and layout in VS Code.</p>
-<form id="app-form"><button type="button" data-action="source">Choose FileMaker fields</button><fieldset><legend>Event and branding</legend>
+${draft ? '<p role="note">Review the suggested field mappings and required settings before saving.</p>' : ''}
+${draft?.unmatched.length ? `<p>Check these requests against your FileMaker fields: ${escapeHtml(draft.unmatched.join(', '))}.</p>` : ''}
+<form id="app-form"><button type="button" data-action="source">Choose FileMaker fields</button><button type="button" data-action="draft">Draft form from a prompt</button><fieldset><legend>Event and branding</legend>
 ${input('title', 'Event title', definition.title, 160)}
 <label for="description">Description</label><textarea id="description" maxlength="2000">${escapeHtml(definition.description)}</textarea>
 <label for="organization">Organization</label><input id="organization" maxlength="120" value="${escapeHtml(definition.branding?.organizationName ?? '')}"/>
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
diff --git a/extension/test/unit/createFmWebApp.test.ts b/extension/test/unit/createFmWebApp.test.ts
index 74ddfcd..9f4a2bd 100644
--- a/extension/test/unit/createFmWebApp.test.ts
+++ b/extension/test/unit/createFmWebApp.test.ts
@@ -40,6 +40,46 @@ function pickFileMaker() {
   });
 }
 describe('Create FM Web App production controller', () => {
+  it('preselects prompt matches from the chosen layout and opens a draft without saving or starting preview', async () => {
+    const { deps, project } = fixture();
+    vi.mocked(vscode.window.showInputBox).mockResolvedValue('Require attendee name and email, add optional session');
+    vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items, options) => {
+      const choices = items as unknown as Array<{ label: string; picked?: boolean }>;
+      if (options?.canPickMany) {
+        expect(choices.map(({ label, picked }) => [label, picked])).toEqual([[' Full Name ', true], ['Email', true]]);
+        return choices.filter((item) => item.picked) as never;
+      }
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
+  it('cancels the prompt without selecting fields, saving files or opening an editor', async () => {
+    const { deps, project } = fixture();pickFileMaker();
+    vi.mocked(vscode.window.showInputBox).mockResolvedValue(undefined);
+    await createFmWebApp(deps as never, { source: 'draft' });
+    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(2);
+    expect(open).not.toHaveBeenCalled();
+    expect(project.ensureProjectInitialized).not.toHaveBeenCalled();
+  });
+
+  it('resumes prompt drafting after creating the first connection', async () => {
+    const { deps } = fixture();deps.profileStore.listProfiles.mockResolvedValue([]);
+    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Add Connection' as never);
+    await createFmWebApp(deps as never, { source: 'draft' });
+    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true, draft: true });
+    expect(open).not.toHaveBeenCalled();
+  });
+
   it('chooses exact FileMaker layout/fields, excludes readonly fields, and saves before preview', async () => {
     const { deps, project, fmClient } = fixture();pickFileMaker();
     await createFmWebApp(deps as never);
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
index 962d505..63bb279 100644
--- a/extension/test/unit/webviews/connectionWizardConnectOffer.test.ts
+++ b/extension/test/unit/webviews/connectionWizardConnectOffer.test.ts
@@ -17,7 +17,7 @@ interface CapturedPanel {
   secretStore: { setPassword: ReturnType<typeof vi.fn> };
 }
 
-function setupPanel(editingProfile?: Record<string, unknown>, afterSave?: 'createFmWebApp'): CapturedPanel {
+function setupPanel(editingProfile?: Record<string, unknown>, afterSave?: 'createFmWebApp' | 'draftFmWebApp'): CapturedPanel {
   const posted: unknown[] = [];
   let messageHandler: ((message: unknown) => unknown) | undefined;
 
@@ -119,6 +119,12 @@ describe('Connection wizard post-save connect offer', () => {
     await vi.waitFor(() => expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.createFmWebApp', { source: 'filemaker', changeSource: true }));
     expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
   });
+  it('resumes the prompt path after the first connection is saved', async () => {
+    const panel = setupPanel(undefined, 'draftFmWebApp');
+    await panel.fireMessage(validSavePayload);
+    await vi.waitFor(() => expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
+      'filemakerDataApiTools.createFmWebApp', { source: 'draft', changeSource: true }));
+  });
   it('does not resume app creation when credentials fail to save', async () => {
     const panel = setupPanel(undefined, 'createFmWebApp');panel.secretStore.setPassword.mockRejectedValueOnce(new Error('Credential store unavailable'));
     await panel.fireMessage(validSavePayload);
```
