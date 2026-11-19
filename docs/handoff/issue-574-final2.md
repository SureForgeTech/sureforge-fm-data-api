All three stages are now delivered and merged. This issue stays open for one item only: the packaged-VSIX browser verification that stage 3 asks for.

## Delivered

| Stage | Pull request | Merge commit | Verification |
| --- | --- | --- | --- |
| 1. Prompt-based form drafting | #567 | `882d288` | tree byte-identical to the reviewed head; `main` green on `build-test`, `e2e-ui-smoke` and both cross-platform jobs |
| 2. The mock FileMaker lost-receipt regression | #569 | `162e35a` | tree byte-identical to the reviewed head; `main` green on the same four checks |
| 3. The first-run wizard | #576 | `85c025f` | tree byte-identical to the reviewed head; `main` green on the same four checks |

Two further changes that stage 3's review turned up are merged as well: **#580** (`ba05e7e`), the private preview's wording, which closes #577; and **#581** (`c0c90b1`), the prompt requirement scope, which closes gap 4 of #573.

## The one item still open

Stage 3 asks for the packaged VSIX, a fresh profile, and invented data submitted **in the browser** to a receipt, with the elapsed time, the deliberate choices and the cold dependency setup recorded. That was **not run**, and it cannot be run in this sandbox: the e2e-ui harness downloads VS Code from `update.code.visualstudio.com`, and the sandbox proxy refuses that host with `403` on CONNECT, so the harness cannot start at all. The same sandbox cannot install the preview's npm dependencies inside VS Code, because the harness's environment allowlist does not pass the proxy variables to the processes it starts. Both were re-tested and refuse the same way.

What was verified instead, against the **real** runtime: a running `next dev` server with the preview session cookie. `POST /api/intake/feedback-request` with invented values answered `201` with a `sample-…` receipt, the same submission identifier returned the same receipt, `GET /intake/feedback-request` rendered the form with all four fields, the original `event-registration` starter still answered `201` with a receipt, and a submission missing required fields was answered `422` with field-level errors.

So the elapsed time, the number of deliberate choices and the cold dependency setup are **not measured**. #575 records this, and this issue stays open for it.

## How each change was reviewed

Every change got an independent review of its exact head by a fresh-context reviewer, and every merged tree is byte-identical to the head that was reviewed. Two rounds are worth recording:

- The post-merge audit of `main` by a **second model family** found a P1 in the prompt parser that the earlier review had rated a P2: "Name and email are required." marked only Email required. It was fixed in #581 rather than left filed as a deferred scope decision, and fixing it took six review rounds, each finding something real in the previous version. The final verdict was CLEAN.
- The first-run wizard's review found the private preview's wording still said "registration" for a feedback form; that was fixed in #580 rather than left in #577.

## Not started

New Cursor/VS Code AI host integration, command regrouping and public hosting were not started in this session, and no issue was opened for them here, so they are named in this comment rather than invented as tickets. The command palette grouping is, however, already in flight on the branch `feature/filemaker-home` from another session.
