Gap 4 of this issue is now fixed and merged.

## Gap 4 is closed

A requirement stated after a list now reaches back over the fields it names. "Name and email are required." marks both fields, "Make email and phone required." marks both, and "Name, email, and phone are required." marks all three. Before, only the last field of the list was marked, so the editor left the first field's "Required" box unticked for a field the prompt had explicitly called required.

The merged change is PR #581, "Apply a requirement stated at the end of a list to the whole list", merged as `c0c90b1`. Its scope rule: the subject of a trailing requirement is the coordinated chain the field belongs to — the fields joined by "and" or "as well as", and the fields of a plain comma-separated list. An explicit coordinator completes a phrase, so a comma after one starts a new group; a negation ("notes not required") or a singular copula ("phone is required") names one field; an excluded field ends its chain. The chain is tracked by reference, so removing an excluded field cannot shift the others.

It took six independent review rounds, each of which found something real in the previous version, and the final verdict was CLEAN: no P0, no P1 and no P2. The full repository gate passed on the merged head, and the reviewer confirmed that every pre-existing behaviour of the parser is byte-identical to before the change — only trailing-requirement cases differ.

## What is still open here

Gaps 1, 2, 3 and 5 of this issue are unchanged, and one gap was added by the review of the fix:

- Gap 1, an exclusion that follows the field, is still not read.
- Gap 2, "everything but X", still reads as an inclusion.
- Gap 3, "Do not require X." still drops the field without reporting it. It now shares one decision with gap 5: both are about whether "not required" means optional or not collected.
- Gap 5, "Do not make X optional", is the same defect as gap 3 with a different verb.
- One pre-existing limitation, noted by the reviewer and out of scope of the merged change: "and also" and "plus" are not read as joiners, so "Email and also phone are required." still marks only Phone. The base implementation behaves the same way, and the forward scope has the same gap.

The merged change also gives a worked example of the decision this issue is waiting for: a trailing requirement applies to the phrase it names, and "not required" applies to the field it follows. That is the rule gap 3 and gap 5 need.
