## Summary

Drafting a form from a prompt now reads an exclusion that follows the field it is about, and reads
"everything but X" as the exclusion it is. This closes the first two gaps of issue #573; the third,
"Do not require X", already read correctly.

## Linked issue

Closes #573

## Changes

`extension/src/services/fmWebPromptDraft.ts`:

- **An exclusion that follows the field now applies to that field.** The parser read a directive
  only from the text *before* a field, so `Include email, phone excluded` suggested phone — and so
  did `Form with phone excluded`. The exclusion now applies to the field it sits next to. It has to
  sit next to it, because an exclusion further along belongs to the next field: in
  `Include name but exclude phone` the exclusion is about phone, not about name.
- **"Everything but X" and "all but X" are exclusions**, the way "everything except X" already was.
  A plain "but" still reverses the polarity, so `Don't include phone, but include email` is
  unchanged. The universal word has to sit right before the "but": "all" also begins a partitive
  phrase, and "for all attendees but make phone optional" says who the form is for, not what to
  leave out.
- **The exclusion vocabulary covers "leave out", "leaves out" and "left out"**, not only
  "leaving out".

`extension/test/unit/fmWebPromptDraft.test.ts` gains two cases. `extension/CHANGELOG.md` and
`CHANGELOG.md` describe the change in plain words.

## Why

Issue #573. The prompt drafting parser reads a bounded set of instructions, and a user who wrote
"include email, phone excluded" got phone suggested to them — the opposite of what they asked for.
The issue recorded that each of these gaps needs a decision about the intended meaning rather than a
one-line change, and that the decision belongs to the parser's author. The decisions taken here are:

- an exclusion that follows a field is about that field, unless another field follows the exclusion,
  in which case it is about that field;
- "everything but X" is an exclusion, because "everything except X" already was;
- "leave out", "leaves out" and "left out" are the same instruction as "leaving out";
- "do not require X" means X is in the form and is not required — which is what the parser already
  did, and what "not required X" does.

## How it was tested

- The new cases fail against the previous parser and pass against this one: with the old
  `fmWebPromptDraft.ts`, `reads an exclusion that follows the field it is about` and
  `reads "everything but X" as an exclusion` both fail; all 37 cases pass at this head.
- The 33 existing cases still pass, including the ones that pin the behaviour this change must not
  disturb: `Include name but exclude phone` keeps name, `Don't include phone, but include email`
  keeps email, `Include everything except phone and email` keeps nothing, and
  `Include email but not required phone` keeps phone as a field that is not required.
- Two cases the review found are now tests, so the parser cannot go back to dropping a field:
  `Include email without phone` keeps email, and
  `Require name and email for all attendees but make phone optional` keeps phone as an optional field.
- The repository's own gate passes on this head: `npm ci`, `npm audit --omit=dev --audit-level=high`,
  lint, the workflow regression tests, the shared build, the mock contract check, typecheck,
  `npm run test:coverage`, the build, the designer and runtime tests, the packaging check and the VSIX
  size budget — all twelve steps exit 0.

## Review

Three independent fresh-context review rounds with Kimi K2.8, each round re-deriving the answer rather
than inheriting the previous one's conclusions. The rounds found, and this branch answers:

- the exclusion words that come before their object were being read as if they came after the field, so
  "include email without phone" dropped email as well as phone;
- the universal word was being looked for anywhere in the clause, so "for all attendees but make phone
  optional" dropped the optional field;
- anchoring it right before the "but" then broke "all of them but phone", and the test for it had been
  deleted rather than the rule fixed. The rule covers those shapes again and the deleted assertion is
  restored.

One P2 remains and is not taken: the quantifier rule also fires under a "keep", "save" or "with" head,
so "Keep everything but phone" leaves the draft empty where it used to suggest phone. The suggested fix
would apply the rule only under an include- or require-style head, which would make "Keep everything but
phone" suggest phone again — the same mistake this change exists to fix. What is missing for those
prompts is "everything" itself, which is the limitation stated above.

## Notes

The parser is deliberately conservative: it suggests fields it recognises and reports the rest as
unmatched, so that a mapping is never guessed. These changes make it read more of what a user
writes; they do not make it guess.

"Include everything" is still not fulfilled — the parser does not read "everything" as a request for
every field — so "everything but phone" leaves the form with nothing in it, the same outcome
"everything except phone" already had. The gap this change closes is the distinction between the two
readings of "but", which is what issue #573 asked for.

One reading is left out on purpose: "all of the fields but phone" is not read as an exclusion, because
the rule that would read it cannot tell it from "all the fields but keep email optional". The trade is
between suggesting a field the user excluded and dropping a field the user asked for, and dropping one
is the worse mistake.
