## Independent review verdict

Reviewed in a fresh context over three rounds with Kimi K2.8, each round re-deriving the answer rather than inheriting the previous one's conclusions, on the exact head `2da6e48`.

**Verdict: MERGEABLE — no P0, no P1, no P2, no P3.** The last round found nothing further.

What the rounds found, and what this document now says:

- **P1 (round 1)** — the document claimed 48 commands were "reachable only from the Command Palette". That overstated its own evidence: 26 of the 48 are reachable from the sidebar's context menus, the sidebar's title buttons or a keybinding, and 3 are hidden from the palette on purpose (`Copy Layout Name`, `Copy Field Name` and `Refresh Connections` carry `when: false`). The figure that is true is **22**, and the reproduction recipe now says how to arrive at it.
- **P3 (round 1)** — the document said the wizard "tests the server before saving it", which overstates the default: `filemaker.connectionWizard.requireTestBeforeSave` defaults to `warn`, so a successful test is not mandatory unless a workspace sets it to `block`. It now says what is offered, what the default does and which setting makes the test mandatory.
- **P3 (round 1)** — the "Common commands" table is in `extension/README.md`, not the root README, and the document now says so.
- **P3 (round 1)** — the share of commands that only mean something once a connection exists had no reproduction recipe, unlike every other number. It is now an exact count — 39 of the 82, gated on `filemaker.hasProfiles` — with the recipe to check it.
- **P3 (round 2)** — the document still said the starter set was two entries, which stopped being true when the same day's pull request #590 added three more. It now says what it was measured against (`ab3077a`), what changed, and that the change answers proposal 4.

The reviewer also confirmed, by recomputation rather than by reading: the command and settings counts, the four palette-visibility states, the 34 and 48 split, the everyday set of 25, the VS Code `supportsSubmenus: false` citation against the VS Code source, that a webview message cannot widen the home's command allowlist, and that all fifteen code paths named in the journey table exist and do what the table says. The packaged-extension paragraph was checked against the hash bookkeeping and the template test.

Required checks on this head: `build-test`, both cross-platform jobs (`ubuntu-latest` and `windows-latest`), `e2e-ui-smoke`, `sign-off` and CodeQL are green. The repository's own gate — lint, typecheck and `npm run test:coverage` (5,980 passed, 21 skipped) — exits 0.
