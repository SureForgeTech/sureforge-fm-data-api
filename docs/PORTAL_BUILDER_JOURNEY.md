# First portal journey: reuse assessment

Observed at 54fe80ed050466d9998cff5dc4b53d675a3119c0 on 2026-11-16 (America/Phoenix).

The existing entry points are Initialize FM Web Project, Select Active Profile, Sync FM Web Project Metadata, Open FM Web Layout Mode, Generate FM Web Next.js App, Generate FM Web Layout Page and Start FM Web Preview Server. The manifest gates initialization on a saved profile; layout authoring and generation require an initialized project; app generation and preview additionally require the runtime template. Thus a synthetic first portal currently cannot start without a profile, and the packaged VSIX now carries the runtime template, so those commands are offered in a Marketplace installation too.

Reuse FmWebProjectService for .fmweb ownership and trust checks, the shared LayoutDefinition and LayoutContainer for field rendering, generatedFileWriter for safe regeneration, and the private preview Host/session/Origin checks. Keep command identifiers and older project/layout formats. The localhost bridge is a developer preview service, not a public backend.

Proposed journey: open a workspace -> choose Build a Portal -> choose Event registration with sample data -> review exact field mappings -> preview the responsive form -> submit one synthetic registration -> see success or an accurate uncertain/failure state -> inspect contract-test results. Resume existing projects instead of overwriting them. Use contextual actions that call existing generation/preview commands, with an explicit installation-availability explanation. No real credentials or public deployment are needed for this local slice.

First implementation scope: shared versioned intake definition referencing an existing layout id; explicit exact-name mappings; reusable validation; derivation of an intake view through LayoutDefinition rather than a second renderer. Unknown fields, malformed values and read-only/global source fields must refuse. Numeric text must retain precision. Synthetic runtime and guided extension setup follow as separate reviewable slices.

Acceptance evidence for the assessment: the paths and gates above were read from extension/package.json, extension/src/commands/fmWebProject.ts, extension/src/services/fmWebProjectService.ts, shared/src/layout-schema.ts, shared/src/ui-renderer.tsx and runtime-next/app/api/bridge/[route]/route.ts. This is a source assessment; no representative-developer usability study or production FileMaker compatibility is claimed.

Intake date fields explicitly use YYYY-MM-DD in both the renderer instruction and shared validation. A real FileMaker submission adapter must explicitly configure or convert this date format before writing; this foundation does not claim live-server date compatibility.

Intake views opt into visible accessible labels, help text, required-state announcements and field-associated validation errors. Existing record views retain their current accessible names unless they explicitly opt in.


Implementation follow-through (2026-11-20): the Build a Portal entry asks which starter the app is for, the same starters Create FM Web App offers, and its create, edit, preview, export and layout actions work on that app. It was fixed to the event registration starter before that.

Implementation follow-through (2026-11-16): the additive Build a Portal entry reuses the project service, existing Layout Mode command, existing private preview command, shared starter and renderer. It resumes user-owned intake/layout files, snapshots validated definitions into the isolated preview, and supports title/label/help/required settings and constrained branding. This is an editor-assisted JSON workflow rather than a new visual form designer; no developer usability study or live FileMaker submission is claimed.

## Where publishing lives

There is no publish command, and the extension does not host a generated app. What a user has today
is a private preview and the app's source.

- **The private preview is a developer service, not a public backend.** The generated runtime answers
  only `127.0.0.1:3000` or `localhost:3000`, and both write paths need the extension's loopback
  bridge, that is, a running VS Code window.
- **"Export app scaffold" hands the user the app's source.** It is one of the entries in the Build a
  Portal picker, and it generates the Next.js runtime from the shipped template into
  `.fmweb/generated/runtime-next`, with the saved forms and layouts alongside it in
  `.fmweb/generated`. Hosting that is the user's next step, with their own account and their own
  runtime.
- **Public hosting is separate work.** The roadmap places a guided deployment path for one supported
  server runtime in Phase 1. The extension's own marketplace publishing is a different thing
  entirely: that is the CI publishing the VSIX, not the extension publishing a user's app.

So the answer to "where do I publish my app?" today is: export the app scaffold and host it
yourself. When the guided deployment path lands, it will be offered from the same place — the Build
a Portal picker — and this section will say so.

Evidence: `extension/package.json` declares no publish, deploy or host command; the Build a Portal
picker and the export handler are in `extension/src/commands/fmWebProject.ts`; the preview's host
check is `runtime-next/preview-server.mjs` and `runtime-next/lib/preview-gate.mjs` (the same two
hosts are allowed by `runtime-next/lib/preview-security.ts`), and its bridge routes are
`runtime-next/app/api/bridge/[route]/route.ts`;
the roadmap's Phase 1 lists the guided deployment path as its fourth capability.
