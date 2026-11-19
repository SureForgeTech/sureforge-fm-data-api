## Summary

The prompt parser states a requirement in two places: before the fields it covers ("Require email and phone.") and after them ("Name and email are required."). Only the first form reached back over a list. A trailing requirement was applied to the last mention of a clause alone, so **"Name and email are required." marked only Email required and left Name optional**, and "Make email and phone required." and "Name, email, and phone are required." behaved the same way.

The field was still preselected and the user reviews the picker and the editor before saving, but the editor's **Required** box was unticked for a field the prompt had explicitly called required — which the prompt drafting pull request promised would not happen.

## Linked issue

Part of #573 (gap 4, "A requirement after a coordinated list marks only the last item").

## Changes

- A trailing requirement now reaches back over the list it concludes, when the qualifier carried a copula ("are required", "are optional") or when it is positive.
- A bare "not required" still overrides only the item it follows, so "Require email, notes not required." keeps Email required and Notes optional.
- A stated requirement settles the list it was stated for, so "Name and email are optional, notes and phone are required." reads the second list on its own.
- A requirement in another sentence does not reach back into the first one: "Include email and phone. Phone required." leaves Email optional.

## Acceptance criteria mirror

- [x] "Name and email are required." marks both fields required.
- [x] "Name, email, and phone are required." marks all three.
- [x] "Make email and phone required." marks both.
- [x] A bare "not required" still applies only to the item it follows.
- [x] A settled list does not bleed into the next list, and a requirement in another sentence does not reach back.
- [x] The forward-scoped prefix requirement, the exclusion handling, the list-anchor polarity, the title extraction, the quoted-name matching and the 2,000-character bound are untouched, and their existing tests are unchanged and still pass.
- [x] The repository's full gate passes.

## Test plan

The full repository gate passed on the reviewed head `33c995b80290c4ce4a9925a367a02b601573c02a`, in the order of the `build-test` job: `npm ci`, `npm audit --omit=dev --audit-level=high` (0 vulnerabilities), `npm run lint`, the workflow regression tests, the shared build, `npm run mock:check -w extension` (67/67), `npm run typecheck`, `npm run test:coverage` (301 files, 5,928 passed, 21 skipped), `npm run build`, `npm test -w designer-ui -w runtime-next` (230 passed) and `npm run package:check`; the VSIX was 2,896,793 bytes against the 3 MiB budget.

The sandbox exports `HTTP_PROXY`/`HTTPS_PROXY`, which the extension's TLS code reads as "a proxy is configured on this computer" and fails closed on. That changes the outcome of 26 proxy-sensitive TLS unit tests, so the gate unsets the proxy variables for the test steps, as the hosted runners have no proxy. The same 26 failures were reproduced on unmodified `main` in this sandbox before any change was made.

The parser's own suite is green: 27 tests, the 25 that existed plus two new ones that pin the scope rule in both directions — the requirement reaching back over the list, and the requirement staying off the items it does not cover.

The defect was found by an independent post-merge audit of `main` and rated a P1 there; an earlier review of the same code, before it merged, found the same behaviour and rated it P2. Both agreed the behaviour was wrong, and the pull request's stated behaviour settles that it is.

## Changelog entry

- [FIX] A prompt that states the requirement at the end of a list of fields now marks every field of that list, so "Name and email are required" no longer leaves the first field optional.
