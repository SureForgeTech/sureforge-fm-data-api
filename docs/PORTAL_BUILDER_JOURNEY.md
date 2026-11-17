# First portal journey: reuse assessment

Observed at 54fe80ed050466d9998cff5dc4b53d675a3119c0 on 2026-11-16 (America/Phoenix).

The existing entry points are Initialize FM Web Project, Select Active Profile, Sync FM Web Project Metadata, Open FM Web Layout Mode, Generate FM Web Next.js App, Generate FM Web Layout Page and Start FM Web Preview Server. The manifest gates initialization on a saved profile; layout authoring and generation require an initialized project; app generation and preview additionally require the runtime template. Thus a synthetic first portal currently cannot start without a profile, and runtime template commands are hidden in a Marketplace installation.

Reuse FmWebProjectService for .fmweb ownership and trust checks, the shared LayoutDefinition and LayoutContainer for field rendering, generatedFileWriter for safe regeneration, and the private preview Host/session/Origin checks. Keep command identifiers and older project/layout formats. The localhost bridge is a developer preview service, not a public backend.

Proposed journey: open a workspace -> choose Build a Portal -> choose Event registration with sample data -> review exact field mappings -> preview the responsive form -> submit one synthetic registration -> see success or an accurate uncertain/failure state -> inspect contract-test results. Resume existing projects instead of overwriting them. Use contextual actions that call existing generation/preview commands, with an explicit installation-availability explanation. No real credentials or public deployment are needed for this local slice.

First implementation scope: shared versioned intake definition referencing an existing layout id; explicit exact-name mappings; reusable validation; derivation of an intake view through LayoutDefinition rather than a second renderer. Unknown fields, malformed values and read-only/global source fields must refuse. Numeric text must retain precision. Synthetic runtime and guided extension setup follow as separate reviewable slices.

Acceptance evidence for the assessment: the paths and gates above were read from extension/package.json, extension/src/commands/fmWebProject.ts, extension/src/services/fmWebProjectService.ts, shared/src/layout-schema.ts, shared/src/ui-renderer.tsx and runtime-next/app/api/bridge/[route]/route.ts. This is a source assessment; no representative-developer usability study or production FileMaker compatibility is claimed.

Intake date fields explicitly use YYYY-MM-DD in both the renderer instruction and shared validation. A real FileMaker submission adapter must explicitly configure or convert this date format before writing; this foundation does not claim live-server date compatibility.
