# Independent review packet — PR #580 (head merged)

- Repository: SureForgeTech/sureforge-fm-data-api
- Working checkout: /workspace/sureforge-fm-data-api-wt-wording
- Branch: fix/starter-neutral-preview-wording
- Exact head SHA under review: a09396721744d2a7f934391682779542ab6da5f1
- Head tree SHA: 468e3c57fa8e4e38e215274ced0366071e4fe618
- Base ref: 3887300bd80ec302c936f6ac19382e749be9ead3 (3887300bd80ec302c936f6ac19382e749be9ead3)
- Merge base: 3887300bd80ec302c936f6ac19382e749be9ead3
- Commit under review:
    a09396721744d2a7f934391682779542ab6da5f1
    author: Alan Deffenderfer (macbookprom5) <4432479+macbookprom5@users.noreply.github.com>
    date: Wed Nov 18 16:59:35 2026 -0700
    subject: fix: make the private preview's wording starter-neutral
    body:
  The private preview's form said "registration" for a form that is not one,
  so a user who drafted a feedback or request form read "registration" in the
  browser.
  
  The previewed form, the runtime's 404 body and the extension's two
  FileMaker-saves messages now talk about the submission the user is making.
  The states, the messages and the safety behaviour are unchanged.
  
  The session-storage key that names the duplicate-protection state and the
  bridge route stay as they are: they are state and protocol, not wording, and
  each now says so where it is used.
  
  These three runtime files are ordinary template files, so no template version
  bump and no shipped-source hash entry are owed, and the change reaches newly
  generated apps.
  
  Signed-off-by: Alan Deffenderfer <4432479+macbookprom5@users.noreply.github.com>
  

## Validation the author ran, and the actual exit status of each step

Gate script: /tmp/opencode/fm-2026-11-18/fm-gate.sh. It runs the repository's declared
validation in the same order as .github/workflows/ci.yml job build-test. Exit statuses:

```
(summary not yet written)
```

Per-step logs are under /tmp/opencode/fm-2026-11-18/gate/merged.

### Note on the sandbox proxy environment

The sandbox exports HTTP_PROXY/HTTPS_PROXY. The extension's TLS/proxy code treats an
environment proxy as 'a proxy is configured on this computer' and fails closed, so the
outcome of 26 TLS/proxy unit tests that assert on a direct route changes. GitHub-hosted
runners have no proxy variables, so the gate unsets the proxy variables for the test
steps and keeps it only for the two steps that need the network (npm ci, npm audit) — the
sandbox cannot resolve DNS without it. On unmodified main in this same sandbox those
26 tests fail with the proxy set and pass with it unset; that was reproduced before any
change was made.

## Repository rules that bound this change

- AGENTS.md (repo root, read the checked-out copy).
- Merge rule: a fresh independent review of the exact head must have zero unresolved P0/P1 findings.
- Validation gate: npm ci, npm run lint, npm run typecheck, npm run mock:check -w extension,
  npm run test:coverage, npm run build, npm test -w designer-ui -w runtime-next, npm run package:check,
  plus npm audit --omit=dev --audit-level=high and the VSIX size budget.
- Synthetic/mock FileMaker data only. Never real customer data or credentials.
- Preserve exact layout, script and field names; do not trim them.

## What this change does

The private preview's own wording still says "registration" for a form that is not one. A user who drafts a **Feedback or Request Form** reads "registration" in the browser.

The wording is cosmetic and no behaviour depends on it. This change makes the previewed form, the runtime's 404 body and the extension's two FileMaker-saves messages talk about the **submission** the user is making instead of a registration.

## What changes

- `runtime-next/app/intake/[id]/intake-form.tsx`: "Registration safety state could not be restored…", "Enable session storage before starting another registration.", "Your browser cannot save registration safety state…", "The registration service reached its safety limit…", "Live FileMaker registration…", the error heading "Check your registration", the legend "Registration details", "Registration saved to FileMaker." and "resubmitting could create another registration" all name the submission instead.
- `runtime-next/lib/filemaker-intake-adapter.ts`: "Check the registration fields before submitting again." becomes "Check the form fields before submitting again."
- `runtime-next/app/api/intake/[id]/route.ts`: the 404 body "Unknown or invalid registration form." becomes "Unknown or invalid form."
- `extension/src/commands/fmWebProject.ts`: "Choose an existing registration app." becomes "Choose an existing app." and "The registration source is missing." becomes "The source layout is missing." These two are only reachable by invoking the preview command directly; the editor always saves the app first.

## What deliberately does not change

- The session-storage key `fmweb.registration.v1.…` in the intake form. It names the duplicate-protection state, so renaming it would silently discard that state. A comment now says so.
- The bridge route `/submitRegistration` and the environment variable `FMWEB_REGISTRATION_MODE`. They are protocol constants shared with the extension's bridge server, not user-visible wording. A comment now says so.
- The event registration starter's own copy, the legacy "Build a Portal" command, the receipt-ledger diagnostics and the "registration notes" matching synonym. Those name the event registration starter or an internal protocol, not a generic form.

## Why this is a separate change

These three runtime files are ordinary template files: they carry no `fmweb-managed` marker and are not in the extension's `MANAGED_TEMPLATE_FILES`, `SHIPPED_MARKED_HASHES` or `SHIPPED_SHARED_HASHES`. So no template version bump and no hash entry are owed, and the change reaches only newly generated apps; an app generated by an earlier extension version keeps its old copy. That is the correct behaviour for a file the generator does not manage, and it is why this is its own change rather than part of the first-run wizard work.

## Acceptance criteria

- Each of the strings above reads the same for an event registration form and for a feedback or request form.
- The private preview still shows the same states, messages and safety behaviour.
- The extension's shipped-source hash list is unchanged and still correct, and the shipped template still matches the sources.
- The repository's full gate passes.

## Complete git-generated diff (3887300bd80ec302c936f6ac19382e749be9ead3...HEAD)

This diff is produced verbatim by git. Every changed path and hunk is included;
nothing is summarized, reformatted or truncated.

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 2f482d6..194dfa3 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -42,6 +42,8 @@ PR title prefix matches the highest-tier label added:
 
 ### [FIX]
 
+- The private preview's form talks about the submission you are making rather than about a registration, so a feedback or request form does not read as an event registration.
+
 - Record editing and intake validation preserve long decimal values that would otherwise be rounded when converted to JavaScript numbers.
 
 
diff --git a/extension/CHANGELOG.md b/extension/CHANGELOG.md
index 0708438..35ee706 100644
--- a/extension/CHANGELOG.md
+++ b/extension/CHANGELOG.md
@@ -19,6 +19,8 @@
 
 **Local portal sample**
 
+- The private preview's form now talks about the submission you are making, not about a registration, so it reads the same for an event registration form and for a feedback or request form.
+
 - Generated file replacement now refuses hard-linked targets, including aliases added during confirmation, so replacing an export cannot change another linked file.
 
 - Export app scaffold now carries saved forms and source layouts into the generated app. Re-export keeps identical files and asks before replacing changed data, including marked generated layouts.
diff --git a/extension/src/commands/fmWebProject.ts b/extension/src/commands/fmWebProject.ts
index 05789f3..0337247 100644
--- a/extension/src/commands/fmWebProject.ts
+++ b/extension/src/commands/fmWebProject.ts
@@ -355,12 +355,12 @@ export function registerFmWebProjectCommands(
         let registration: { definition: ReturnType<typeof intakeDefinitionSchema.parse>; layout: ReturnType<typeof layoutDefinitionSchema.parse> } | undefined;
         if (real) {
           if (!profile || !context.globalStorageUri?.fsPath || !workspaceRoot) throw new Error('Choose FileMaker fields and a saved connection before enabling FileMaker saves.');
-          if (typeof requestedIntake !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(requestedIntake)) throw new Error('Choose an existing registration app.');
+          if (typeof requestedIntake !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(requestedIntake)) throw new Error('Choose an existing app.');
           const raw = portalFiles.intakes.get(`${requestedIntake}.intake.json`);
-          if (!raw) throw new Error('Choose an existing registration app.');
+          if (!raw) throw new Error('Choose an existing app.');
           const definition = intakeDefinitionSchema.parse(JSON.parse(raw.toString('utf8')));
           const source = portalFiles.layouts.get(`${definition.layoutId}.layout.json`);
-          if (!source) throw new Error('The registration source is missing.');
+          if (!source) throw new Error('The source layout is missing.');
           const layout = layoutDefinitionSchema.parse(JSON.parse(source.toString('utf8')));
           if (!layout.fmLayoutName) throw new Error('Choose a FileMaker layout before enabling saves.');
           const metadata = await fmClient.getLayoutMetadata(profile, layout.fmLayoutName, { recordHistory: false });
diff --git a/runtime-next/app/api/intake/[id]/route.ts b/runtime-next/app/api/intake/[id]/route.ts
index 218b6f4..d376ac0 100644
--- a/runtime-next/app/api/intake/[id]/route.ts
+++ b/runtime-next/app/api/intake/[id]/route.ts
@@ -15,7 +15,7 @@ export async function POST(request: NextRequest, context: { params: Promise<{ id
   if (request.headers.get('origin') !== `http://${request.headers.get('host')}`) return reply({ error: 'Origin is not allowed.' }, 403);
   const { id } = await context.params;
   const example = await previewIntakes.load(id);
-  if (!example) return reply({ error: 'Unknown or invalid registration form.' }, 404);
+  if (!example) return reply({ error: 'Unknown or invalid form.' }, 404);
   if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply({ error: 'Use a JSON submission.' }, 415);
   let body = '';
   const reader = request.body?.getReader();
diff --git a/runtime-next/app/intake/[id]/intake-form.tsx b/runtime-next/app/intake/[id]/intake-form.tsx
index 8d2394f..10b83fa 100644
--- a/runtime-next/app/intake/[id]/intake-form.tsx
+++ b/runtime-next/app/intake/[id]/intake-form.tsx
@@ -14,6 +14,8 @@ export function IntakeForm({ definition, layout, mode = 'sample' }: { definition
   const canvasHost = React.useRef<HTMLDivElement>(null);
   const summary = React.useRef<HTMLDivElement>(null);
   const locked = status !== 'editing';
+  // The storage key names the duplicate-protection state, so it keeps its name even though the
+  // wording around it no longer says "registration".
   const attemptKey = `fmweb.registration.v1.${definition.id}.${definition.layoutId}`;
   React.useEffect(() => {
     if (mode !== 'filemaker') return;
@@ -28,7 +30,7 @@ export function IntakeForm({ definition, layout, mode = 'sample' }: { definition
         setReceipt(value.receipt);setStatus('accepted');
       } else setStatus('uncertain');
     } catch {
-      setErrors([{ code: 'shape', message: 'Registration safety state could not be restored. Enable session storage and ask the app operator to check any earlier submission.' }]);
+      setErrors([{ code: 'shape', message: 'Submission safety state could not be restored. Enable session storage and ask the app operator to check any earlier submission.' }]);
       setStatus('uncertain');busy.current = true;
     }
   }, [mode, attemptKey]);
@@ -48,7 +50,7 @@ export function IntakeForm({ definition, layout, mode = 'sample' }: { definition
     try {
       clearAttempt();submissionId.current = undefined;busy.current = false;
       setValues({});setErrors([]);setReceipt('');setStatus('editing');
-    } catch { setErrors([{ code: 'shape', message: 'Enable session storage before starting another registration.' }]); }
+    } catch { setErrors([{ code: 'shape', message: 'Enable session storage before starting another submission.' }]); }
   }
   React.useEffect(() => { if (errors.length) summary.current?.focus(); }, [errors]);
   React.useEffect(() => {
@@ -72,7 +74,7 @@ export function IntakeForm({ definition, layout, mode = 'sample' }: { definition
     submissionId.current ??= crypto.randomUUID();
     try { storeAttempt('pending'); }
     catch {
-      setErrors([{ code: 'shape', message: 'Your browser cannot save registration safety state. Enable session storage before submitting.' }]);
+      setErrors([{ code: 'shape', message: 'Your browser cannot save submission safety state. Enable session storage before submitting.' }]);
       busy.current = false;setStatus('editing');return;
     }
     try {
@@ -96,7 +98,7 @@ export function IntakeForm({ definition, layout, mode = 'sample' }: { definition
         || (response.status === 503 && body.status === 'capacity')) {
         clearAttempt();if (mode === 'filemaker' && body.status === 'rejected') submissionId.current = undefined;
         setErrors([{ code: 'value', message: body.status === 'capacity'
-          ? mode === 'filemaker' ? 'The registration service reached its safety limit. Keep your values and contact the app operator.' : 'The sample preview reached its limit. Restart the preview to continue.'
+          ? mode === 'filemaker' ? 'The submission service reached its safety limit. Keep your values and contact the app operator.' : 'The sample preview reached its limit. Restart the preview to continue.'
           : 'The submission was not accepted. Review your values and the form definition before trying again.' }]);
         busy.current = false; setStatus('editing');
       } else setStatus('uncertain');
@@ -112,9 +114,9 @@ export function IntakeForm({ definition, layout, mode = 'sample' }: { definition
   return <section aria-label={definition.title} style={{ borderTop: `6px solid ${definition.branding?.accentColor ?? '#215EA6'}`, paddingTop: 16 }}>
     {definition.branding?.organizationName ? <p>{definition.branding.organizationName}</p> : null}
     <h1>{definition.title}</h1><p>{definition.description}</p>
-    <p role="note">{mode === 'filemaker' ? 'Live FileMaker registration. Submitting this form creates a real record in the approved FileMaker connection.' : 'Private sample preview. Use invented details. Duplicate protection lasts only while this preview process runs.'}</p>
+    <p role="note">{mode === 'filemaker' ? 'Live FileMaker submission. Submitting this form creates a real record in the approved FileMaker connection.' : 'Private sample preview. Use invented details. Duplicate protection lasts only while this preview process runs.'}</p>
     {errors.length ? <div ref={summary} role="alert" tabIndex={-1}>
-      <h2>Check your registration</h2><ul>{errors.map((error, index) => <li key={index}>
+      <h2>Check your submission</h2><ul>{errors.map((error, index) => <li key={index}>
         {error.fieldId ? <button type="button" onClick={() => focusField(error.fieldId!)}>
           {definition.fields.find((field) => field.id === error.fieldId)?.label}: {error.message}
         </button> : error.message}
@@ -122,7 +124,7 @@ export function IntakeForm({ definition, layout, mode = 'sample' }: { definition
     </div> : null}
     <form noValidate onSubmit={submit} aria-busy={status === 'submitting'}>
       <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
-        <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Registration details</legend>
+        <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Submission details</legend>
         <div ref={canvasHost} style={{ width: '100%' }}>
           <LayoutContainer layout={layout} mode="runtime" runtimeData={{ creating: true, editing: !locked,
             viewport: { width, height: layout.canvas.height },
@@ -141,11 +143,11 @@ export function IntakeForm({ definition, layout, mode = 'sample' }: { definition
       <button type="submit" disabled={locked}>{status === 'submitting' ? 'Submitting…' : mode === 'filemaker' && definition.submitLabel === 'Register with sample data' ? 'Register' : definition.submitLabel}</button>
     </form>
     <div role="status" aria-live="polite">
-      {status === 'accepted' ? <p>{mode === 'filemaker' ? 'Registration saved to FileMaker.' : definition.successMessage} Reference: {receipt}</p> : null}
+      {status === 'accepted' ? <p>{mode === 'filemaker' ? 'Submission saved to FileMaker.' : definition.successMessage} Reference: {receipt}</p> : null}
       {mode === 'filemaker' && status === 'accepted' ? <button type="button" onClick={startAnother}>Register another attendee</button> : null}
       {status === 'uncertain' ? <p>{mode === 'filemaker'
         ? 'The submission outcome is uncertain. Keep this page open and ask the app operator to check FileMaker before submitting again. A record may already exist. Nothing was retried automatically.'
-        : 'The submission outcome is uncertain. Keep this page open. This sample has no outcome lookup; reloading or restarting the preview loses duplicate protection and resubmitting could create another registration. Nothing was retried automatically.'}</p> : null}
+        : 'The submission outcome is uncertain. Keep this page open. This sample has no outcome lookup; reloading or restarting the preview loses duplicate protection and resubmitting could create another submission. Nothing was retried automatically.'}</p> : null}
     </div>
   </section>;
 }
diff --git a/runtime-next/lib/filemaker-intake-adapter.ts b/runtime-next/lib/filemaker-intake-adapter.ts
index 3a44f6b..50445e3 100644
--- a/runtime-next/lib/filemaker-intake-adapter.ts
+++ b/runtime-next/lib/filemaker-intake-adapter.ts
@@ -10,6 +10,8 @@ export async function submitFileMakerRegistration(intakeId: string, submissionId
     endpoint = new URL(environment.FMWEB_BRIDGE_URL ?? '');
     if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || !endpoint.port
       || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/fm') return { status: 'rejected' };
+    // The bridge route is a protocol constant shared with the extension's bridge server.
+    // It is not user-visible wording, so it keeps its name.
     endpoint.pathname += '/submitRegistration';
   } catch { return { status: 'rejected' }; }
   const token = environment.FMWEB_BRIDGE_TOKEN;
@@ -26,7 +28,7 @@ export async function submitFileMakerRegistration(intakeId: string, submissionId
     const result = body as Record<string, unknown>;
     if (result.status === 'accepted') return typeof result.receipt === 'string' && /^[a-z0-9-]{1,80}$/i.test(result.receipt)
       ? { status: 'accepted', receipt: result.receipt } : { status: 'uncertain' };
-    if (result.status === 'invalid') return { status: 'invalid', errors: [{ code: 'value', message: 'Check the registration fields before submitting again.' }] };
+    if (result.status === 'invalid') return { status: 'invalid', errors: [{ code: 'value', message: 'Check the form fields before submitting again.' }] };
     if (result.status === 'pending' || result.status === 'uncertain' || result.status === 'rejected'
       || result.status === 'capacity' || result.status === 'conflict') return { status: result.status };
   } catch { /* A timeout or malformed reply cannot establish whether FileMaker committed the write. */ }
diff --git a/runtime-next/lib/intake-form.test.ts b/runtime-next/lib/intake-form.test.ts
index 44662e6..10ef575 100644
--- a/runtime-next/lib/intake-form.test.ts
+++ b/runtime-next/lib/intake-form.test.ts
@@ -113,7 +113,7 @@ describe('live FileMaker registration browser behavior', () => {
     vi.mocked(fetch).mockResolvedValueOnce(Response.json({ status:'accepted',receipt:'fm-real-123' },{status:201}));
     mount('filemaker');expect(host.querySelector('[role="note"]')?.textContent).toContain('creates a real record');
     expect(host.querySelector('button[type="submit"]')?.textContent).toBe('Register');fill();await submit();
-    expect(host.querySelector('[role="status"]')?.textContent).toContain('Registration saved to FileMaker.');
+    expect(host.querySelector('[role="status"]')?.textContent).toContain('Submission saved to FileMaker.');
     expect(host.querySelector('[role="status"]')?.textContent).not.toContain('No FileMaker record was created');
     expect(sessionStorage.getItem(storageKey())).not.toContain('Sample Attendee');
     expect(sessionStorage.getItem(storageKey())).not.toContain('sample@example.test');
```

## Commits on the branch (3887300bd80ec302c936f6ac19382e749be9ead3..HEAD)

a09396721744d2a7f934391682779542ab6da5f1 fix: make the private preview's wording starter-neutral
