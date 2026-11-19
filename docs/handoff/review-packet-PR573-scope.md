# Independent review packet — PR #573 (head scope)

- Repository: SureForgeTech/sureforge-fm-data-api
- Working checkout: /workspace/sureforge-fm-data-api-wt-scope
- Branch: fix/prompt-trailing-requirement-scope
- Exact head SHA under review: 33c995b80290c4ce4a9925a367a02b601573c02a
- Head tree SHA: ca2579bb433c598c689819921c8c6ec33f49471b
- Base ref: origin/main (3887300bd80ec302c936f6ac19382e749be9ead3)
- Merge base: 3887300bd80ec302c936f6ac19382e749be9ead3
- Commit under review:
    33c995b80290c4ce4a9925a367a02b601573c02a
    author: Alan Deffenderfer (macbookprom5) <4432479+macbookprom5@users.noreply.github.com>
    date: Wed Nov 18 17:08:18 2026 -0700
    subject: fix: apply a requirement stated at the end of a list to the whole list
    body:
  The prompt parser states a requirement in two places: before the fields it
  covers ("Require email and phone.") and after them ("Name and email are
  required."). Only the first form reached back over a list. A trailing
  requirement was applied to the last mention of a clause alone, so in "Name
  and email are required." only Email was marked required and Name stayed
  optional. "Make email and phone required." and "Name, email, and phone are
  required." behaved the same way.
  
  The field was still preselected and the user reviews the picker and the editor
  before saving, but the editor's "Required" box was unticked for a field the
  prompt had explicitly called required, which the prompt drafting pull request
  promised would not happen.
  
  A trailing requirement now reaches back over the list it concludes, when the
  qualifier carried a copula ("are required", "are optional") or when it is
  positive. A bare "not required" still overrides only the item it follows, so
  "Require email, notes not required." keeps Email required. A stated requirement
  settles the list it was stated for, so the next list is read on its own, and a
  requirement in another sentence does not reach back into the first one.
  
  The forward-scoped prefix requirement, the exclusion handling, the list-anchor
  polarity, the title extraction and the quoted-name matching are untouched.
  
  Signed-off-by: Alan Deffenderfer <4432479+macbookprom5@users.noreply.github.com>
  

## Validation the author ran, and the actual exit status of each step

Gate script: /tmp/opencode/fm-2026-11-18/fm-gate.sh. It runs the repository's declared
validation in the same order as .github/workflows/ci.yml job build-test. Exit statuses:

```
01-scripts-test =>	--- exit=0 duration=1s log=/tmp/opencode/fm-2026-11-18/gate/scope/01-scripts-test.log
02-audit =>	--- exit=0 duration=1s log=/tmp/opencode/fm-2026-11-18/gate/scope/02-audit.log
03-lint =>	--- exit=0 duration=15s log=/tmp/opencode/fm-2026-11-18/gate/scope/03-lint.log
04-ci-test =>	--- exit=0 duration=0s log=/tmp/opencode/fm-2026-11-18/gate/scope/04-ci-test.log
05-build-shared =>	--- exit=0 duration=1s log=/tmp/opencode/fm-2026-11-18/gate/scope/05-build-shared.log
06-mock-check =>	--- exit=0 duration=1s log=/tmp/opencode/fm-2026-11-18/gate/scope/06-mock-check.log
07-typecheck =>	--- exit=0 duration=2s log=/tmp/opencode/fm-2026-11-18/gate/scope/07-typecheck.log
08-test-coverage =>	--- exit=0 duration=63s log=/tmp/opencode/fm-2026-11-18/gate/scope/08-test-coverage.log
09-build =>	--- exit=0 duration=2s log=/tmp/opencode/fm-2026-11-18/gate/scope/09-build.log
10-designer-runtime-test =>	--- exit=0 duration=6s log=/tmp/opencode/fm-2026-11-18/gate/scope/10-designer-runtime-test.log
11-package-check =>	--- exit=0 duration=3s log=/tmp/opencode/fm-2026-11-18/gate/scope/11-package-check.log
12-vsix-size-budget =>	--- exit=0 duration=0s log=/tmp/opencode/fm-2026-11-18/gate/scope/12-vsix-size-budget.log
```

Per-step logs are under /tmp/opencode/fm-2026-11-18/gate/scope.

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

The prompt parser states a requirement in two places: before the fields it covers ("Require email and phone.") and after them ("Name and email are required."). Only the first form reached back over a list.

A trailing requirement was applied to the **last** mention of a clause alone, so in "Name and email are required." only Email was marked required and Name stayed optional. The same held for "Make email and phone required." and for a comma-separated list, "Name, email, and phone are required.", where only the last field was marked.

The user reviews the field picker and the editor before saving, so the field was still preselected — but the editor's "Required" box was unticked for a field the prompt had explicitly called required. The pull request that introduced the prompt drafting states that it "marks the ones you called required or optional", so the behaviour did not meet its own acceptance criterion.

An independent post-merge audit of `main` rated this a P1. An earlier review of the same code, before it merged, found the same behaviour and rated it P2; both ratings agree it is wrong, and the pull request's stated behaviour settles that it is.

## What this change does

A requirement stated after a list now reaches back over that list:

- "Name and email are required." marks both fields required.
- "Name, email, and phone are required." marks all three.
- "Make email and phone required." marks both.
- "Name and email are optional." marks both optional.

It reaches back when the qualifier carried a copula ("are required", "are optional") or when it is positive. A bare "not required" overrides only the item it follows, so "Require email, notes not required." still leaves Email required and Notes optional. A stated requirement settles the list it was stated for, so "Name and email are optional, notes and phone are required." reads the second list on its own.

A requirement in another sentence does not reach back into the first one: "Include email and phone. Phone required." leaves Email optional.

## What deliberately does not change

- The forward-scoped prefix requirement, the exclusion handling, the list-anchor polarity, the title extraction and the quoted-name matching are untouched.
- The existing tests for them are unchanged and still pass; the change adds tests.

## How to judge it

The risk in this change is the scope rule itself: a requirement that reaches back too far would mark a field required that the user did not call required. The cases that matter are in the new tests: a bare "not required" stays on the item it follows, a settled list does not bleed into the next list, and a requirement in another sentence does not reach back.

## Complete git-generated diff (origin/main...HEAD)

This diff is produced verbatim by git. Every changed path and hunk is included;
nothing is summarized, reformatted or truncated.

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 2f482d6..9aa3a5e 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -42,6 +42,8 @@ PR title prefix matches the highest-tier label added:
 
 ### [FIX]
 
+- A prompt that states the requirement at the end of a list of fields now marks every field of that list, so "Name and email are required" no longer leaves the first field optional.
+
 - Record editing and intake validation preserve long decimal values that would otherwise be rounded when converted to JavaScript numbers.
 
 
diff --git a/extension/CHANGELOG.md b/extension/CHANGELOG.md
index 0708438..224e96f 100644
--- a/extension/CHANGELOG.md
+++ b/extension/CHANGELOG.md
@@ -11,6 +11,8 @@
 
 **FM Web app creation**
 
+- A prompt that states the requirement at the end of a list of fields now marks every field of that list, so "Name and email are required" no longer leaves the first field optional.
+
 - Create FM Web App now starts with a starter: **Event Registration** or **Feedback or Request Form**. The starter names the saved app, so choosing the same one again reopens it. Sample fields come first, so a first sample receipt needs no connection, no code and no JSON editing. The wizard resumes by itself after you open a folder or add a first connection.
 
 - Save to FileMaker opens a private registration form after confirming the connection, database and layout. Submitting creates a real record with the mapped fields; credentials stay in the extension. Persistent submission tracking prevents the same submission from being dispatched again after a restart or uncertain result. Sample preview remains available.
diff --git a/extension/src/services/fmWebPromptDraft.ts b/extension/src/services/fmWebPromptDraft.ts
index 5bf1682..fe329c8 100644
--- a/extension/src/services/fmWebPromptDraft.ts
+++ b/extension/src/services/fmWebPromptDraft.ts
@@ -73,18 +73,19 @@ export function suggestPromptFields(prompt: string, fields: readonly DesignerFie
     byName.set(name, matches);
   }
   const concepts = new Map(CONCEPTS.flatMap((concept) => [...concept.phrases, ...concept.names].map((phrase) => [phrase, concept] as const)));
-  const append = (mention: Mention, required?: boolean): void => {
+  const append = (mention: Mention, required?: boolean): number => {
     const field = mention.candidates.length === 1 ? mention.candidates[0] : undefined;
     const existing = field && draft.fields.find((entry) => entry.field.name === field.name);
     if (existing) {
       if (required !== undefined) existing.required = required;
-      return;
+      return draft.fields.indexOf(existing);
     }
     if (!field || draft.fields.length === 100) {
       if (!draft.unmatched.includes(mention.label)) draft.unmatched.push(mention.label);
-      return;
+      return -1;
     }
     draft.fields.push({ field, required });
+    return draft.fields.length - 1;
   };
 
   // Keep punctuation inside explicitly quoted FileMaker names intact. The closing quote is optional so an
@@ -96,6 +97,9 @@ export function suggestPromptFields(prompt: string, fields: readonly DesignerFie
   // as the list head and moves to a clause that ends positive, so a negation inside the list does not swallow
   // a later coordinated request, while an explicit reversal ("but include ...") carries the items after it.
   let anchorNegated: 'exclude' | 'optional' | undefined;
+  // The items of the coordinated list being read, so that a requirement stated at the end of the list
+  // can reach the items before it.
+  let listMembers: number[] = [];
   let headPending = true;
   let comma = false;
   for (const raw of clauses) {
@@ -104,6 +108,7 @@ export function suggestPromptFields(prompt: string, fields: readonly DesignerFie
       negated = undefined;
       comma = false;
       anchorNegated = undefined;
+      listMembers = [];
       headPending = true;
       continue;
     }
@@ -172,8 +177,25 @@ export function suggestPromptFields(prompt: string, fields: readonly DesignerFie
       const prefix = /\b(not\s+(?:\w+\s+)?)?(require|required|must collect|optional|optionally)\s*(?:(?:an?|the)\s*)?$/.exec(before);
       const suffix = /^(?:(?:is|are|as)\s+)?(not\s+(?:\w+\s+)?)?(required|optional)\b/.exec(after);
       const requirement = qualifier((prefix ?? suffix)?.[2] ?? '', Boolean((prefix ?? suffix)?.[1]));
+      // A requirement stated after the list states the rule for the whole list, so it reaches back over the
+      // items before it: "Name and email are required." marks both. It reaches back when the qualifier
+      // carried a copula ("are required", "are optional") or when it is positive; a bare "not required"
+      // overrides only the item it follows, so "Require email, notes not required." keeps email required.
+      const trailing = !prefix && suffix !== null && requirement !== undefined
+        && (requirement === true || /^(?:is|are|as)\s/.test(suffix[0]));
       if (!negated) {
-        append(mention, requirement ?? (isContinuation ? inherited : undefined));
+        const index = append(mention, requirement ?? (isContinuation ? inherited : undefined));
+        if (index >= 0) {
+          // The coordinated list being read: its items since the list's head.
+          if (!isContinuation || listMembers.length === 0) listMembers = [];
+          listMembers.push(index);
+          if (trailing) {
+            for (const member of listMembers) {
+              const entry = draft.fields[member];
+              if (entry && entry.required === undefined) entry.required = requirement;
+            }
+          }
+        }
       } else if (negated === 'exclude') {
         if (mention.candidates.length === 1) {
           const name = mention.candidates[0]!.name;
@@ -184,6 +206,8 @@ export function suggestPromptFields(prompt: string, fields: readonly DesignerFie
         const existing = draft.fields.find(({ field }) => field.name === mention.candidates[0]!.name);
         if (existing) existing.required = false;
       }
+      // A stated requirement settles the list it was stated for, so the next list starts afresh.
+      if (requirement !== undefined) listMembers = [];
       previousEnd = mention.end;
       comma = false;
       // Only a forward-scoped list requirement carries to the next coordinated item. An exclusion says nothing
diff --git a/extension/test/unit/fmWebPromptDraft.test.ts b/extension/test/unit/fmWebPromptDraft.test.ts
index 1df5c63..96edd3a 100644
--- a/extension/test/unit/fmWebPromptDraft.test.ts
+++ b/extension/test/unit/fmWebPromptDraft.test.ts
@@ -164,6 +164,36 @@ describe('prompt form suggestions', () => {
       .map(({ field }) => field.name)).toEqual(['Email', 'Notes']);
   });
 
+  it('marks every field of a list when the requirement is stated at the end of the list', () => {
+    const fields = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];
+    expect(suggestPromptFields('Name and email are required.', fields).fields)
+      .toEqual([{ field: { name: 'Name' }, required: true }, { field: { name: 'Email' }, required: true }]);
+    expect(suggestPromptFields('Name, email, and phone are required.', fields).fields)
+      .toEqual([{ field: { name: 'Name' }, required: true }, { field: { name: 'Email' }, required: true },
+        { field: { name: 'Phone' }, required: true }]);
+    expect(suggestPromptFields('Make email and phone required.', fields).fields)
+      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: true }]);
+    expect(suggestPromptFields('Name and email are optional.', fields).fields)
+      .toEqual([{ field: { name: 'Name' }, required: false }, { field: { name: 'Email' }, required: false }]);
+  });
+
+  it('keeps a requirement at the end of the list off the items it does not cover', () => {
+    const fields = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];
+    // A bare "not required" overrides only the item it follows.
+    expect(suggestPromptFields('Require email, notes not required.', fields).fields)
+      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Notes' }, required: false }]);
+    // A stated requirement settles its list, so the next list is read on its own.
+    expect(suggestPromptFields('Name and email are optional, notes and phone are required.', fields).fields)
+      .toEqual([{ field: { name: 'Name' }, required: false }, { field: { name: 'Email' }, required: false },
+        { field: { name: 'Notes' }, required: true }, { field: { name: 'Phone' }, required: true }]);
+    // A requirement for one item leaves the others of its list alone.
+    expect(suggestPromptFields('Include email and phone, only email required.', fields).fields)
+      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: undefined }]);
+    // A requirement in another sentence does not reach back into the first one.
+    expect(suggestPromptFields('Include email and phone. Phone required.', fields).fields)
+      .toEqual([{ field: { name: 'Email' }, required: undefined }, { field: { name: 'Phone' }, required: true }]);
+  });
+
   it('reads an emphatic inclusion as an inclusion', () => {
     const fields = [{ name: 'Email' }, { name: 'Phone' }];
     expect(suggestPromptFields('Include not only email but also phone.', fields).fields
```

## Commits on the branch (origin/main..HEAD)

33c995b80290c4ce4a9925a367a02b601573c02a fix: apply a requirement stated at the end of a list to the whole list
