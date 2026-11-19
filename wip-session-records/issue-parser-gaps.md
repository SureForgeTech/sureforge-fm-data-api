The prompt drafting parser that ships with "Create FM Web App" reads a bounded set of instructions. Three gaps were found in an independent review of the prompt drafting pull request and are recorded here rather than fixed in it, because each needs a decision about the intended meaning rather than a one-line change.

## 1. An exclusion that follows the field is not read

The directive scan only reads the text before a field mention, so an exclusion that follows the field is ignored:

- "Include email, phone excluded." suggests phone, although the prompt excludes it.
- "Form with phone excluded." suggests phone.

The same applies to "leave out" / "leaves out" / "left out": only "leaving out" is in the exclusion vocabulary.

A fix reads the text after the mention as well as the text before it, which changes what a directive may scope over and needs its own review.

## 2. "everything but X" reads as an inclusion

"Include everything but phone." suggests phone, because "but" without a following instruction verb is read as a reversal. "Include everything except phone." excludes phone, because "except" is in the vocabulary.

"Everything" and "all" are not part of the concept vocabulary, so the parser cannot fulfil "everything" either way; the result is the one recognised field, which is the opposite of the request.

A fix has to tell "everything but X" (an exclusion) from "don't include phone, but include email" (a reversal). The two differ only in what follows "but", so the decision belongs to the parser's author.

## 3. "Do not require X." drops the field without reporting it

"Do not require phone." neither suggests phone nor lists it as unmatched, so the request disappears. The adjective form of the same intent, "Include email but not required phone.", suggests phone and marks it optional.

The two phrasings of the same intent disagree. Changing this also changes an existing documented behaviour: the parser currently treats "do not require X" as "X is not part of the form", which is the same reading as "exclude", but is applied without reporting.

A fix has to choose between "not required means optional" (suggest the field, not required) and "not required means not collected" (leave it out, but say so), and apply it to both phrasings.

## Acceptance criteria

- Each of the three cases above behaves as decided, with a test that pins the decision.
- The parser still never suggests a read-only, global, calculation, summary or container field.
- The parser still returns the original FileMaker field metadata and the exact field name.
- The full repository gate passes.

## Notes

Found while reviewing the prompt drafting work (PR #567). The parser is `extension/src/services/fmWebPromptDraft.ts`.
