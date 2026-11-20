## Summary

Adds three starters to **Create FM Web App** — **Service Inquiry**, **Appointment Request** and
**Application** — beside the existing Event Registration and Feedback or Request Form.

## Changes

- `shared/src/intake-starters.ts` gains the three starters. Each is entirely synthetic: it names its
  own fields, its own layout name and its own copy, and it opens in the visual editor and previews
  with invented data, so it needs no connection, no credentials and no JSON.
  - **Service Inquiry** — name, email, what is needed, and a message.
  - **Appointment Request** — name, email, a preferred date, a time of day and an optional reason. The
    date field takes `YYYY-MM-DD` and refuses an impossible date or free text.
  - **Application** — name, email, what you are applying for and a short statement.
- `extension/src/services/fmWebRuntimeGenerator.ts` records the new shared-source hashes. The runtime
  template ships a copy of the shared sources and only replaces a copy it shipped byte for byte, so a
  changed shared source changes its hash and the template test refuses the change until the new hash
  is recorded and the older ones are kept.
- The User Guide, the FM Web guide, the shipped Getting Started walkthrough, both READMEs and both
  changelogs name the five starters.

## Why

`docs/ROADMAP.md` names the expansion in its first phase: "Expand to service inquiries, applications
and appointment requests." They are the web activities a FileMaker solution is asked for most often,
and a user who wanted one had no template: they had to build the form from scratch, or from a prompt.

The existing starters keep their identifiers, their order in the wizard's quick pick, their copy and
their file names, so a saved app still opens on the starter it was built from.

## How it was tested

- The catalogue test pins the exact list of identifiers and labels, so a wrong or reordered starter
  fails it.
- The new cases pin the exact FileMaker field names, the layout names with their leading and trailing
  spaces, and the validation: a valid date is accepted while `2026-11-31` and "next Tuesday" are
  refused.
- Against `origin/main`'s sources the new tests fail (5 failed, 15 passed); at this head all 20 pass.
- The runtime-template test (70 tests) passes with the new hashes recorded.
- The repository's own gate passes on this head: `npm ci`, `npm audit --omit=dev --audit-level=high`,
  lint, the workflow regression tests, the shared build, the mock contract check, typecheck,
  `npm run test:coverage` (5,980 passed, 21 skipped), the build, the designer and runtime tests, the
  packaging check and the VSIX size budget — all twelve steps exit 0.

## Review

Two independent fresh-context review rounds with Kimi K2.8, each round re-deriving the answer rather
than inheriting the previous one's conclusions.

- Round 1: **MERGEABLE** — no P0, no P1, one P2 (the shipped walkthrough and the FM Web guide still
  offered only the first two starters) and one P3 (the Application starter's copy was "Apply.").
- Round 2: verifies those two are fixed, that the recorded hash is the one the current file hashes to,
  and that the older hashes are still kept.

The review also confirmed that the date field is genuinely usable end to end: the shared validation
refuses an impossible date, the layout marks the field as a date, and the editor tells the user which
format to use.

## Notes

The copy of a starter is what a form built from the user's own FileMaker fields carries, so each
starter owns its title, description and button text, and each success message says a sample was
accepted and that no FileMaker record was created.
