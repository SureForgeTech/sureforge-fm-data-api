# FileMaker Data API Tools for VS Code

[![Marketplace version](https://vsmarketplacebadges.dev/version/SureForgeTech.filemaker-data-api-tools.svg)](https://marketplace.visualstudio.com/items?itemName=SureForgeTech.filemaker-data-api-tools) [![Marketplace installs](https://vsmarketplacebadges.dev/installs/SureForgeTech.filemaker-data-api-tools.svg)](https://marketplace.visualstudio.com/items?itemName=SureForgeTech.filemaker-data-api-tools) [![License: Apache-2.0](https://img.shields.io/github/license/SureForgeTech/sureforge-fm-data-api)](LICENSE)

Create and preview FM Web apps in VS Code with a free, open-source FileMaker extension. Choose FileMaker fields or sample fields, customize an event-registration form without editing JSON, and preview it privately. The extension also provides Data API queries, record editing, schema comparison, batch tools, TypeScript generation and optional AI tools. MIT licensed, no telemetry.

Install it from the Marketplace: search for **FileMaker Data API Tools** (publisher SureForgeTech), or run `code --install-extension SureForgeTech.filemaker-data-api-tools`.

Version **1.9.0** adds new related portal rows to Create Record on direct connections. It mostly improves safety: batch updates follow write rules, old saved addresses lose embedded credentials safely, and server responses and the source-checkout FM Web preview have tighter limits. Read the [upgrade notes](extension/UPGRADE.md) for the new prompts and settings rules.

We have used it against one of our own FileMaker Servers and a built-in mock of the Data API. We would love more people to try it on other server versions and setups and tell us what they find: see [Compatibility](extension/docs/COMPATIBILITY.md) and [open an issue](https://github.com/SureForgeTech/sureforge-fm-data-api/issues) with anything you notice. FileMaker Cloud sign-in with a Claris ID is not supported yet, and Cloud has not been tried.

## Create an FM Web app

1. Open a trusted workspace folder and run **FileMaker: Create FM Web App**, or use the new-file button above Connections.
2. Choose a saved FileMaker connection and layout, then select the registration fields. **Try sample fields** starts without a connection.
3. Customize labels, required rules, input types, choices, field order and branding in the form editor. Choose **Save and preview** for sample data, or **Save to FileMaker** and confirm the connection, database and layout to accept real registrations.

Run the same command again to continue editing the saved app. Sample preview creates no FileMaker records. The confirmed FileMaker mode saves real registrations through the extension, with credentials kept out of the browser and persistent tracking for repeated or uncertain submissions. Advanced source-layout and export controls remain available; exporting creates an editable app folder, not a public deployment. See the [FM Web guide](extension/docs/FM_WEB.md#create-fm-web-app).

## Documentation

| I want to... | Read |
| --- | --- |
| Browse the website | [Documentation home](https://sureforgetech.github.io/sureforge-fm-data-api/), [User Guide](https://sureforgetech.github.io/sureforge-fm-data-api/guide/) and [Changelog by version](https://sureforgetech.github.io/sureforge-fm-data-api/changelog/) |
| Use the extension | [User Guide](extension/docs/USER_GUIDE.md) |
| Common questions | [FAQ](extension/docs/FAQ.md) |
| Fix a connection problem | [Troubleshooting](extension/docs/TROUBLESHOOTING.md) |
| Get help or report a bug | [Support](SUPPORT.md) |
| Check which FileMaker versions work | [Compatibility](extension/docs/COMPATIBILITY.md) |
| Upgrade between versions | [Upgrade notes](extension/UPGRADE.md) and the [Changelog](extension/CHANGELOG.md) |
| Understand security and data handling | [Security overview](docs/security.md), [Data handling](docs/DATA_HANDLING.md), [Privacy policy](PRIVACY.md) |
| Report a vulnerability | [Security policy](SECURITY.md) |
| Contribute code or docs | [Contributing](extension/CONTRIBUTING.md), [Architecture](extension/ARCHITECTURE.md), [API reference](https://sureforgetech.github.io/sureforge-fm-data-api/api/) |
| Cut a release | [Release process](docs/RELEASE.md), [cadence](docs/RELEASE_CADENCE.md), [rollback](docs/ROLLBACK.md) |
| Understand a design decision | [Architecture decision records](docs/ADR/README.md) |

The Marketplace page is [extension/README.md](extension/README.md).

## For contributors

### Repository layout

| Folder | Contents | How the extension uses it |
| --- | --- | --- |
| `extension/` | The VS Code extension (published as `SureForgeTech.filemaker-data-api-tools`) | The extension itself. |
| `shared/` | Shared schema, types and renderer utilities | Imported by the extension and by both workspaces below. |
| `designer-ui/` | React webview app for FM Web Layout Mode | The Layout Mode bundle. `extension/scripts/build-designer-ui-if-available.mjs` builds it and copies it into the extension; the extension build fails when the bundle cannot be produced. |
| `runtime-next/` | Next.js runtime template for generated FM Web apps | The FM Web preview template. `fmWebRuntimeGenerator` (`extension/src/services/fmWebRuntimeGenerator.ts`) copies it into `.fmweb/generated/runtime-next` in your workspace. The VSIX bundles this template and shared sources under `dist/fmweb-template`. Installed extensions prefer that kit; development hosts prefer repository sources. Older or incomplete installations report a missing template. |
| `docs/` | Maintainer, security and release documentation | — |
| `tools/` | Release helpers (`release-notes.sh`, the pinned `vsce` install) | — |

### Develop

Node.js 22 or newer is required.

```bash
npm ci
npm run build
npm test
```

Press `F5` in VS Code to open an Extension Development Host, then run **FileMaker: Add Connection Profile**. No FileMaker server? Run `npm run mock:server -w extension` and point a profile at the mock Data API described in [CONTRIBUTING.md](extension/CONTRIBUTING.md).

Useful root scripts: `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run docs:api` (TypeDoc into `docs/api`), `npm run docs:site` (website into `pages`; open `pages/index.html` to preview it), `npm run package:check` (run `npm run build` first; builds a VSIX into `artifacts/` and validates it). See [Contributing](extension/CONTRIBUTING.md) for the full checklist.

`npm run lint` covers every workspace: each one has its own ESLint setup (`shared/eslint.config.mjs`, `designer-ui/eslint.config.mjs`, `runtime-next/eslint.config.mjs` and the extension's own), so a change that breaks the lint of any of them fails the root gate. `npm run test:coverage` covers every workspace that has tests; `designer-ui/` and `runtime-next/` keep their coverage floors in their own Vitest configs and the floors may only go up, so a change that drops either below its floor fails the root gate, the same as a failing extension test. `shared/` has no tests of its own and takes part in the lint gate only.

The generated FM Web app in `.fmweb/generated/runtime-next` receives the app sources, not this repository's lint and coverage setup: it runs its own tests and does not lint itself.

## License

Apache-2.0. See [LICENSE](LICENSE).
