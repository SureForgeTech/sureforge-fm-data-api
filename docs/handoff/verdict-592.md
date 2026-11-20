## Independent review verdict

Reviewed in a fresh context over three rounds with Kimi K2.8, each round re-deriving the answer rather than inheriting the previous one's conclusions, on the exact head `6f2f992`.

**Verdict: MERGEABLE — no P0, no P1.** One P2 and three P3s remain, and they are stated below rather than hidden. The P2 is a judgement call I did not take, and the reason is given.

What the rounds found, and what this branch answers:

- **P2 (round 1)** — the exclusion words that come *before* their object ("without", "no", "omit", "skip", a bare "leave") were also read from the text *after* a field. In "include email without phone" that dropped email as well as phone. Only the forms that come after their object are read there now: "excluded", "omitted", "skipped", "left out".
- **P2 (round 1)** — the universal word was looked for anywhere earlier in the clause, so "for all attendees but make phone optional" was read as an exclusion and dropped the optional field. The quantifier has to sit right before the "but" again, and a requirement word after the field keeps the items wanted.
- **P2 (round 2)** — that anchoring broke "all of them but phone" and "all fields but phone", and the test for the first had been deleted rather than the rule fixed. The quantifier covers those two shapes, and the deleted assertion is restored with both of them.
- **P3** — the trailing "skipped" was not read after a field; it is now. **P3** — "leaving phone out" is not read; the vocabulary keeps the multiword forms only, because a bare "leaving" also catches "leave the form with email", which cost a field. **P3** — "all of the fields" is not in the quantifier vocabulary.

Against the parser before this change, 38 prompts read the same way except for the ten this change is about: an exclusion that follows a field, "everything but X" and "all of them but X", and the four ways of saying "leave out" that the vocabulary did not have.

## The P2 I did not take

The last round rated as P2 that the quantifier rule fires under a "keep", "save" or "with" head, so "Keep everything but phone" now leaves the draft empty where it used to suggest phone. The proposed fix was to apply the rule only under an include- or require-style head.

I did not apply it, because the fix would reintroduce the bug this change exists to fix: "Keep everything but phone" would suggest phone again, which is the same mistake the issue reports for "Include everything but phone". The draft is empty for all four of those prompts now — "Include everything but phone", "Keep everything but phone", "Form with everything but phone" and "Save everything but email" — and in none of them is the excluded field suggested. What is missing is "everything" itself, because the parser does not read "everything" as a request for every field; that limitation is stated in the pull request body and is the same one "everything except X" already had.

## Required checks

`build-test`, both cross-platform jobs (`ubuntu-latest` and `windows-latest`), `e2e-ui-smoke`, `sign-off` and CodeQL are green on this head. The repository's full twelve-step gate — `npm ci`, `npm audit --omit=dev --audit-level=high`, lint, the workflow regression tests, the shared build, the mock contract check, typecheck, `npm run test:coverage`, the build, the designer and runtime tests, the packaging check and the VSIX size budget — exits 0 at every step.
