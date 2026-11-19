## Summary

Create FM Web App can turn a short description into suggested registration fields on an existing FileMaker layout. It preselects matches for review and opens the visual editor, where the developer can adjust the draft and preview it.

## Linked issue

Closes #566

## Changes

- Add a prompt option to the creation wizard and existing editor, including continuation after first connection setup.
- Match registration terms and quoted custom field names locally using writable layout metadata. Preserve exact names and flag recognized or quoted requests that could not be mapped uniquely.
- Keep drafts transient until Save and use the existing sample and real preview actions.

## Acceptance criteria mirror

- [x] Review suggestions for the connected layout before opening the editor.
- [x] Preserve exact field names and omit read-only or ambiguous suggestions.
- [x] Continue after adding a first connection and preserve cancellation.
- [x] Preview through the existing app workflow after saving.

## Test plan

The repository's Node 22 validation gate passed on `a6f5f87db6a4ee9f0f1e1c8b3b0e2a5c9d8f4e71` (every step's real exit status is in the operator run record; the gate script runs `npm ci`, `npm audit --omit=dev --audit-level=high`, lint, the workflow regression tests, the rotation parser tests, `npm run build -w shared`, `npm run mock:check -w extension`, typecheck, `npm run test:coverage`, `npm run build`, `npm test -w designer-ui -w runtime-next`, `npm run package:check` and the VSIX size budget).

Focused tests cover mapping, ambiguity, cancellation, connection continuation, and the draft-to-editor-to-preview path. Live FileMaker and interactive desktop QA were not run. Hosted Ubuntu and Windows, the first-run smoke, CodeQL, DCO and the required `build-test` and `e2e-ui-smoke` checks pass.

Four independent fresh-context reviews of this branch, each on the exact head it judged, drove the parser fixes: bare "not" is now an exclusion without swallowing "not required" or "not only"; a coordinated item inherits the polarity of the list's anchor; an unterminated quote no longer drops the instruction before it; the title is no longer the article; the fields named in a title are still suggested; and a requirement negation that follows the field is read.

The three remaining parser gaps (an exclusion that follows the field, "everything but X", and "do not require X" dropping the field silently) need a decision about intended meaning and are recorded in #573.

## Changelog entry

- [FEATURE] Draft a form from a prompt using your existing FileMaker connection, then review suggested fields and preview in the visual editor.
