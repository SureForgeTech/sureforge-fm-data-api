# Independent review packet — PR #581 (head scope5)

- Repository: SureForgeTech/sureforge-fm-data-api
- Working checkout: /workspace/sureforge-fm-data-api-wt-scope
- Branch: fix/prompt-trailing-requirement-scope
- Exact head SHA under review: 0058afa422c596c626dbd018a6b672eb544de7c7
- Head tree SHA: 30414fc44a9cc8ff205c6d0d571ba8db1ea2dc3c
- Base ref: origin/main (ba05e7e03189559e9909af9a1a7b9207c11203dd)
- Merge base: ba05e7e03189559e9909af9a1a7b9207c11203dd
- Commit under review:
    0058afa422c596c626dbd018a6b672eb544de7c7
    author: Alan Deffenderfer (macbookprom5) <4432479+macbookprom5@users.noreply.github.com>
    date: Wed Nov 18 17:41:49 2026 -0700
    subject: test: drop the duplicated requirement-scope test block
    body:
  An independent review of the scope fix noticed that two test blocks carried the
  same name and that the first was fully covered by the second. The first was a
  leftover from an earlier version of the fix; the second keeps every assertion
  it made and adds more, so the duplicate is removed.
  
  Signed-off-by: Alan Deffenderfer <4432479+macbookprom5@users.noreply.github.com>
  

## Validation the author ran, and the actual exit status of each step

Gate script: /tmp/opencode/fm-2026-11-18/fm-gate.sh. It runs the repository's declared
validation in the same order as .github/workflows/ci.yml job build-test. Exit statuses:

```
01-scripts-test =>	--- exit=0 duration=1s log=/tmp/opencode/fm-2026-11-18/gate/scope4/01-scripts-test.log
02-audit =>	--- exit=0 duration=0s log=/tmp/opencode/fm-2026-11-18/gate/scope4/02-audit.log
03-lint =>	--- exit=0 duration=8s log=/tmp/opencode/fm-2026-11-18/gate/scope4/03-lint.log
04-ci-test =>	--- exit=0 duration=0s log=/tmp/opencode/fm-2026-11-18/gate/scope4/04-ci-test.log
05-build-shared =>	--- exit=0 duration=0s log=/tmp/opencode/fm-2026-11-18/gate/scope4/05-build-shared.log
06-mock-check =>	--- exit=0 duration=1s log=/tmp/opencode/fm-2026-11-18/gate/scope4/06-mock-check.log
07-typecheck =>	--- exit=0 duration=1s log=/tmp/opencode/fm-2026-11-18/gate/scope4/07-typecheck.log
08-test-coverage =>	--- exit=0 duration=46s log=/tmp/opencode/fm-2026-11-18/gate/scope4/08-test-coverage.log
09-build =>	--- exit=0 duration=1s log=/tmp/opencode/fm-2026-11-18/gate/scope4/09-build.log
10-designer-runtime-test =>	--- exit=0 duration=3s log=/tmp/opencode/fm-2026-11-18/gate/scope4/10-designer-runtime-test.log
11-package-check =>	--- exit=0 duration=2s log=/tmp/opencode/fm-2026-11-18/gate/scope4/11-package-check.log
12-vsix-size-budget =>	--- exit=0 duration=0s log=/tmp/opencode/fm-2026-11-18/gate/scope4/12-vsix-size-budget.log
```

Per-step logs are under /tmp/opencode/fm-2026-11-18/gate/scope5.

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
index 194dfa3..6b957f2 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -42,6 +42,8 @@ PR title prefix matches the highest-tier label added:
 
 ### [FIX]
 
+- A prompt that states the requirement at the end of a list of fields now marks every field of that list, so "Name and email are required" no longer leaves the first field optional.
+
 - The private preview's form talks about the submission you are making rather than about a registration, so a feedback or request form does not read as an event registration.
 
 - Record editing and intake validation preserve long decimal values that would otherwise be rounded when converted to JavaScript numbers.
diff --git a/extension/CHANGELOG.md b/extension/CHANGELOG.md
index 35ee706..0c97e51 100644
--- a/extension/CHANGELOG.md
+++ b/extension/CHANGELOG.md
@@ -11,6 +11,8 @@
 
 **FM Web app creation**
 
+- A prompt that states the requirement at the end of a list of fields now marks every field of that list, so "Name and email are required" no longer leaves the first field optional.
+
 - Create FM Web App now starts with a starter: **Event Registration** or **Feedback or Request Form**. The starter names the saved app, so choosing the same one again reopens it. Sample fields come first, so a first sample receipt needs no connection, no code and no JSON editing. The wizard resumes by itself after you open a folder or add a first connection.
 
 - Save to FileMaker opens a private registration form after confirming the connection, database and layout. Submitting creates a real record with the mapped fields; credentials stay in the extension. Persistent submission tracking prevents the same submission from being dispatched again after a restart or uncertain result. Sample preview remains available.
diff --git a/extension/src/services/fmWebPromptDraft.ts b/extension/src/services/fmWebPromptDraft.ts
index 5bf1682..a9a5986 100644
--- a/extension/src/services/fmWebPromptDraft.ts
+++ b/extension/src/services/fmWebPromptDraft.ts
@@ -73,18 +73,20 @@ export function suggestPromptFields(prompt: string, fields: readonly DesignerFie
     byName.set(name, matches);
   }
   const concepts = new Map(CONCEPTS.flatMap((concept) => [...concept.phrases, ...concept.names].map((phrase) => [phrase, concept] as const)));
-  const append = (mention: Mention, required?: boolean): void => {
+  const append = (mention: Mention, required?: boolean): PromptFormDraft['fields'][number] | undefined => {
     const field = mention.candidates.length === 1 ? mention.candidates[0] : undefined;
     const existing = field && draft.fields.find((entry) => entry.field.name === field.name);
     if (existing) {
       if (required !== undefined) existing.required = required;
-      return;
+      return existing;
     }
     if (!field || draft.fields.length === 100) {
       if (!draft.unmatched.includes(mention.label)) draft.unmatched.push(mention.label);
-      return;
+      return undefined;
     }
-    draft.fields.push({ field, required });
+    const entry = { field, required };
+    draft.fields.push(entry);
+    return entry;
   };
 
   // Keep punctuation inside explicitly quoted FileMaker names intact. The closing quote is optional so an
@@ -96,14 +98,21 @@ export function suggestPromptFields(prompt: string, fields: readonly DesignerFie
   // as the list head and moves to a clause that ends positive, so a negation inside the list does not swallow
   // a later coordinated request, while an explicit reversal ("but include ...") carries the items after it.
   let anchorNegated: 'exclude' | 'optional' | undefined;
+  // The items of the coordinated list being read, so that a requirement stated at the end of the list
+  // can reach the items before it. The items are held by reference, so removing one of them from the
+  // draft cannot shift the others.
+  let listMembers: { entry: PromptFormDraft['fields'][number]; clause: number; settled: boolean }[] = [];
+  let clauseIndex = 0;
   let headPending = true;
   let comma = false;
   for (const raw of clauses) {
+    clauseIndex += 1;
     if (/^[;.!?\r\n]$/.test(raw)) {
       inherited = undefined;
       negated = undefined;
       comma = false;
       anchorNegated = undefined;
+      listMembers = [];
       headPending = true;
       continue;
     }
@@ -170,10 +179,38 @@ export function suggestPromptFields(prompt: string, fields: readonly DesignerFie
       // The head clause's own polarity starts the list's anchor.
       if (headPending) { anchorNegated = negated; headPending = false; }
       const prefix = /\b(not\s+(?:\w+\s+)?)?(require|required|must collect|optional|optionally)\s*(?:(?:an?|the)\s*)?$/.exec(before);
-      const suffix = /^(?:(?:is|are|as)\s+)?(not\s+(?:\w+\s+)?)?(required|optional)\b/.exec(after);
-      const requirement = qualifier((prefix ?? suffix)?.[2] ?? '', Boolean((prefix ?? suffix)?.[1]));
+      const suffix = /^((?:is|are|as)\s+)?(not\s+(?:\w+\s+)?)?(required|optional)\b/.exec(after);
+      const requirement = prefix ? qualifier(prefix[2] ?? '', Boolean(prefix[1]))
+        : suffix ? qualifier(suffix[3] ?? '', Boolean(suffix[2])) : undefined;
+      // A requirement stated after the list states the rule for its subject. The subject decides how far the
+      // requirement reaches: a plural copula ("Name and email are required.") names the whole list, a bare
+      // word ("email and phone required") names the coordinated phrase before it, and a negation ("notes not
+      // required") or a singular copula ("phone is required") names one field.
+      const copula = !prefix && suffix !== null ? suffix[1] : undefined;
+      const plural = copula !== undefined && /^are\s/.test(copula);
+      const singular = copula !== undefined && /^(?:is|as)\s/.test(copula);
+      const negatedQualifier = !prefix && suffix !== null && Boolean(suffix[2]);
+      const trailing = !prefix && suffix !== null && requirement !== undefined && !negatedQualifier && !singular;
       if (!negated) {
-        append(mention, requirement ?? (isContinuation ? inherited : undefined));
+        const entry = append(mention, requirement ?? (isContinuation ? inherited : undefined));
+        if (entry) {
+          // The coordinated list being read: its items since the list's head.
+          if (!isContinuation || listMembers.length === 0) listMembers = [];
+          listMembers.push({ entry, clause: clauseIndex, settled: requirement !== undefined });
+          if (trailing) {
+            // A plural copula names the whole list, so the requirement reaches the items of the earlier
+            // clauses too, unless one of them already stated a requirement of its own. A bare word names
+            // the coordinated phrase it is joined to, so it reaches the earlier clauses only when the
+            // mention is joined to the list by "and".
+            const reachesEarlierClauses = plural
+              ? !listMembers.slice(0, -1).some((member) => member.settled)
+              : /^and$/.test(before);
+            for (const member of listMembers) {
+              if (member.clause !== clauseIndex && !reachesEarlierClauses) continue;
+              if (member.entry.required === undefined) member.entry.required = requirement;
+            }
+          }
+        }
       } else if (negated === 'exclude') {
         if (mention.candidates.length === 1) {
           const name = mention.candidates[0]!.name;
diff --git a/extension/test/unit/fmWebPromptDraft.test.ts b/extension/test/unit/fmWebPromptDraft.test.ts
index 1df5c63..8a31147 100644
--- a/extension/test/unit/fmWebPromptDraft.test.ts
+++ b/extension/test/unit/fmWebPromptDraft.test.ts
@@ -164,6 +164,73 @@ describe('prompt form suggestions', () => {
       .map(({ field }) => field.name)).toEqual(['Email', 'Notes']);
   });
 
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
+    // A later requirement does not reach into an earlier list that already stated its own.
+    expect(suggestPromptFields('Optional name and email, phone required.', fields).fields)
+      .toEqual([{ field: { name: 'Name' }, required: false }, { field: { name: 'Email' }, required: undefined },
+        { field: { name: 'Phone' }, required: true }]);
+    expect(suggestPromptFields('Optional name and email, phone are required.', fields).fields)
+      .toEqual([{ field: { name: 'Name' }, required: false }, { field: { name: 'Email' }, required: undefined },
+        { field: { name: 'Phone' }, required: true }]);
+    expect(suggestPromptFields('Require email, phone and notes are required.', fields).fields)
+      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: true },
+        { field: { name: 'Notes' }, required: true }]);
+  });
+
+  it('keeps a requirement that names one field off the rest of the list', () => {
+    const fields = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];
+    // A singular copula names the field it follows, even inside a coordinated list.
+    expect(suggestPromptFields('Include email and phone, email is required.', fields).fields)
+      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: undefined }]);
+    expect(suggestPromptFields('Include name and email, phone is required.', fields).fields)
+      .toEqual([{ field: { name: 'Name' }, required: undefined }, { field: { name: 'Email' }, required: undefined },
+        { field: { name: 'Phone' }, required: true }]);
+    expect(suggestPromptFields('Collect name, email, phone is required.', fields).fields)
+      .toEqual([{ field: { name: 'Name' }, required: undefined }, { field: { name: 'Email' }, required: undefined },
+        { field: { name: 'Phone' }, required: true }]);
+    expect(suggestPromptFields('Include email and phone, email is optional.', fields).fields)
+      .toEqual([{ field: { name: 'Email' }, required: false }, { field: { name: 'Phone' }, required: undefined }]);
+  });
+
+  it('marks every field of a list when the requirement is stated at the end of the list', () => {
+    const fields = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];
+    expect(suggestPromptFields('Name and email are required.', fields).fields)
+      .toEqual([{ field: { name: 'Name' }, required: true }, { field: { name: 'Email' }, required: true }]);
+    expect(suggestPromptFields('Name, email, and phone are required.', fields).fields)
+      .toEqual([{ field: { name: 'Name' }, required: true }, { field: { name: 'Email' }, required: true },
+        { field: { name: 'Phone' }, required: true }]);
+    expect(suggestPromptFields('Make email and phone required.', fields).fields)
+      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: true }]);
+    expect(suggestPromptFields('Make email and phone optional.', fields).fields)
+      .toEqual([{ field: { name: 'Email' }, required: false }, { field: { name: 'Phone' }, required: false }]);
+    expect(suggestPromptFields('Name and email are optional.', fields).fields)
+      .toEqual([{ field: { name: 'Name' }, required: false }, { field: { name: 'Email' }, required: false }]);
+    expect(suggestPromptFields('Make email, phone and notes required.', fields).fields)
+      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: true },
+        { field: { name: 'Notes' }, required: true }]);
+  });
+
+  it('still reaches every item of a list after an excluded item was removed from the draft', () => {
+    const fields = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];
+    expect(suggestPromptFields('Include name. Add email and phone, exclude name, and notes are required.', fields).fields)
+      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: true },
+        { field: { name: 'Notes' }, required: true }]);
+  });
+
   it('reads an emphatic inclusion as an inclusion', () => {
     const fields = [{ name: 'Email' }, { name: 'Phone' }];
     expect(suggestPromptFields('Include not only email but also phone.', fields).fields
```

## Commits on the branch (origin/main..HEAD)

0058afa422c596c626dbd018a6b672eb544de7c7 test: drop the duplicated requirement-scope test block
47f24327d800f0d852ef34780055fbd3bc1bdaa5 fix: scope a trailing requirement by the subject it names
8ffe8b7b966770fa254291554cb7269d6cc2f917 fix: apply a requirement stated at the end of a list to the whole list
0d96ffe68761c4877676236b0af0d429c35c571a Merge origin/main into fix/prompt-trailing-requirement-scope
33c995b80290c4ce4a9925a367a02b601573c02a fix: apply a requirement stated at the end of a list to the whole list
