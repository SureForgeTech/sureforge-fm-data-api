## Summary

The prompt parser states a requirement in two places: before the fields it covers ("Require email and phone.") and after them ("Name and email are required."). Only the first form reached back over a list. A trailing requirement was applied to the last mention of a clause alone, so **"Name and email are required." marked only Email required and left Name optional**, and "Make email and phone required." and "Name, email, and phone are required." behaved the same way.

The field was still preselected and the user reviews the picker and the editor before saving, but the editor's **Required** box was unticked for a field the prompt had explicitly called required — which the prompt drafting pull request promised would not happen.

## Linked issue

Part of #573 (gap 4, "A requirement after a coordinated list marks only the last item").

## Changes

A trailing requirement now reaches back over the fields its **subject** covers:

- A **plural copula** ("Name and email **are** required.") names the whole list, so every field of it is marked. The reach stops at the list if an earlier field of that list already stated a requirement of its own.
- A **bare word** ("Make email and phone required.") names the coordinated phrase before it, so the fields it is joined to by "and" are marked.
- A **negation** ("notes not required") or a **singular copula** ("phone is required") names one field, so nothing else is marked.

The list is tracked by reference rather than by position, so removing an excluded field from the draft cannot shift the other items around it.

## Acceptance criteria mirror

- [x] "Name and email are required." marks both fields required.
- [x] "Name, email, and phone are required." marks all three.
- [x] "Make email and phone required." / "Make email and phone optional." / "Make email, phone and notes required." mark the list.
- [x] A bare "not required" applies only to the field it follows.
- [x] A singular copula names one field: "Include email and phone, email is required." marks Email only.
- [x] A list that already stated a requirement is not reached into by a later requirement.
- [x] A requirement in another sentence does not reach back into the first one.
- [x] Removing an excluded field does not stop the requirement from reaching the fields that remain.
- [x] The forward-scoped prefix requirement, the exclusion handling, the list-anchor polarity, the title extraction, the quoted-name matching and the 2,000-character bound are untouched, and their existing tests are unchanged and still pass.
- [x] The repository's full gate passes.

## Test plan

The full repository gate passed on the reviewed head `0058afa422c596c626dbd018a6b672eb544de7c7`, in the order of the `build-test` job: `npm ci`, `npm audit --omit=dev --audit-level=high` (0 vulnerabilities), `npm run lint`, the workflow regression tests, the shared build, `npm run mock:check -w extension` (67/67), `npm run typecheck`, `npm run test:coverage` (301 files, 5,931 passed, 21 skipped), `npm run build`, `npm test -w designer-ui -w runtime-next` (230 passed) and `npm run package:check`; the VSIX was 2,897,105 bytes against the 3 MiB budget.

The sandbox exports `HTTP_PROXY`/`HTTPS_PROXY`, which the extension's TLS code reads as "a proxy is configured on this computer" and fails closed on. That changes the outcome of 26 proxy-sensitive TLS unit tests, so the gate unsets the proxy variables for the test steps, as the hosted runners have no proxy. The same 26 failures were reproduced on unmodified `main` in this sandbox before any change was made.

The parser's own suite is green: 29 tests. The existing 25 are unchanged and still pass; four are new, and they pin the scope rule in both directions — the requirement reaching back over the list, and the requirement staying off the fields it does not cover. Every test block has a distinct name, and no assertion was weakened.

The defect was found by an independent post-merge audit of `main` and rated a P1 there; an earlier review of the same code, before it merged, found the same behaviour and rated it P2. Both agreed the behaviour was wrong, and the pull request's stated behaviour settles that it is.

The fix itself went through three review rounds. Earlier versions were each found to over-reach: a later requirement reaching into an earlier list, a stale index after an excluded field was removed, a bare "optional" reaching only the last field, and a singular copula being read as a plural one. Each was reproduced and corrected, and each is now pinned by a test.

## Changelog entry

- [FIX] A prompt that states the requirement at the end of a list of fields now marks every field of that list, so "Name and email are required" no longer leaves the first field optional.
