## Independent review verdict

Reviewed in a fresh context over two rounds with Kimi K2.8, each round re-deriving the answer rather than inheriting the previous one's conclusions, on the exact head `de11fe2`.

**Verdict: MERGEABLE — no P0, no P1, no P2.** One P3 remains and is noted rather than hidden: the Application starter's catalogue copy was "Apply.", thinner than the other starters' copy; it now says what the form is for.

What the rounds found, and what this branch answers:

- the shipped Getting Started walkthrough and the FM Web guide still offered only the first two starters, so a user following either one saw a list that contradicted the wizard. The User Guide's command table points at the FM Web guide for the complete flow, so the stale page was the one the guide sent people to. Both now list all five.
- the Application starter's copy. It now reads "Tell us why you are applying.", beside "Register for our event.", "Send us feedback or a request.", "Tell us what you need." and "Ask for an appointment.".

The review also confirmed, by construction and not by reading:

- each new starter parses through the shared intake schema, carries exactly its definition's fields and nothing else, and keeps the leading and trailing spaces FileMaker names are written with (`' Inquiries '`, `' Appointments '`, `' Applications '`).
- the Appointment Request starter's date field is usable end to end: `2026-11-24` is accepted, `2026-11-31` and "next Tuesday" are refused, the layout marks the field as a date, and the editor tells the user which format to use.
- nothing breaks for a user who already has a saved app: the existing starters keep their identifiers, their order in the quick pick, their copy and their file names, and nothing in the extension, the runtime or the tests keys off there being exactly two starters.
- the recorded shared-source hashes are the ones the current files hash to, and the older hashes are kept, so an app generated from an earlier release is still recognized and refreshed.

Required checks on this head: `build-test`, both cross-platform jobs (`ubuntu-latest` and `windows-latest`), `e2e-ui-smoke`, `sign-off` and CodeQL are green. The repository's full twelve-step gate — `npm ci`, `npm audit --omit=dev --audit-level=high`, lint, the workflow regression tests, the shared build, the mock contract check, typecheck, `npm run test:coverage` (5,980 passed, 21 skipped), the build, the designer and runtime tests, the packaging check and the VSIX size budget — exits 0 at every step.
