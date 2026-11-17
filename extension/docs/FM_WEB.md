# FM Web reference

Reference for the FM Web workflow (Layout Mode, generated Next.js runtime and the local bridge). For the steps a user follows, see [FM Web and Layout Mode](./USER_GUIDE.md#fm-web-and-layout-mode) in the user guide. FM Web is experimental.

## Architecture

Four layers:

1. VS Code extension services (`fmWebProjectService`, `fmWebRuntimeGenerator`, `fmBridgeServer`).
2. The Layout Mode webview (the designer, from `designer-ui/`).
3. The generated Next.js runtime (`.fmweb/generated/runtime-next`, from `runtime-next/`).
4. The shared renderer and schema package (`@fmweb/shared`, from `shared/`).

Flows:

- **Layout authoring:** the webview edits `LayoutDefinition` JSON in `.fmweb/layouts`.
- **Metadata sync:** the extension pulls layouts, fields and script names into `.fmweb/metadata`.
- **Runtime generation:** the extension copies the template app and the generated layout artifacts into `.fmweb/generated`. Recognized untouched files refresh; edited files are kept. Only the explicit generation command offers deletion after a named confirmation.
- **Live data:** the Next.js app calls the extension's localhost bridge (`/fm/*`) for record and script operations. It keeps the found set and current record in session state and carries the record context between web layouts.

Design constraints: webviews never reach FileMaker directly; FileMaker credentials stay in the extension host; the bridge binds to loopback only. The browser calls a route on the private preview server, which adds the bridge token server-side.

## Project paths

| Path | Contents |
| --- | --- |
| `.fmweb/layouts` | Authored layout definitions |
| `.fmweb/metadata` | Synced FileMaker metadata cache |
| `.fmweb/generated/runtime-next` | Generated runtime app; `.env.local` contains only a non-secret notice, not live preview credentials |
| `.fmweb/generated/layouts` | Generated runtime layout artifacts |
| System temporary folder: `fmweb-preview-*` | Private running copy, dependencies, npm cache, empty npm config files, `.fmweb-preview-owner` ownership marker and `launch-used` single-use launch state |

## Layout schema

`LayoutDefinition` is versioned and validated with Zod (`extension/src/fmweb/layoutSchema.ts`).

Top level: `schemaVersion`, `id`, `name`, `fmLayoutName`, `canvas { width, height, gridSize }`, `objects[]`, `styles`.

Object types: `field`, `text`, `button`, `portal`, `rectangle`, `image`, `tabPanel`.

Every object may carry a `behavior`: `runScript`, `goToWebLayout`, `goToFmLayout`, `openUrl` or `showDialog`, with the extra fields `scriptName`, `targetLayoutId`, `targetFmLayoutName`, `url`, `dialogId` and `parameter`.

`migrateLayoutDefinition` migrates older schema versions to the current one. A newer, unknown schema version is rejected rather than parsed down-level.

## Bridge security

The bridge (`fmBridgeServer`) is started by **FileMaker: Start FM Web Preview Server**. It:

- binds to `127.0.0.1` on a random port and rejects non-loopback peers;
- requires a trusted workspace;
- requires a 256-bit per-session token in the `X-FM-Bridge-Token` header, generated when the bridge starts and discarded when it stops, and compares it in constant time;
- accepts only `http://localhost:3000` and `http://127.0.0.1:3000` origins and JSON `POST` requests to `/fm/*` with validated payloads;
- caps the request body at 1 MB and applies a token-bucket rate limit and a per-session request budget (User-only settings `filemaker.fmWeb.bridge.rateLimitPerSecond`, `filemaker.fmWeb.bridge.rateLimitBurst` and `filemaker.fmWeb.bridge.requestBudget`; workspace values are ignored; throttled requests get HTTP 429 with `Retry-After`);
- serves only the active connection and rejects a request that names another profile;
- applies the user's own limits to changes: record changes (edit, create, delete) are refused in offline mode, when `filemaker.features.recordEdit.enabled` is off, and when the enterprise role or `disabledFeatures` disallow `writeOperations` or `recordEdit`; script runs are refused in offline mode, when `filemaker.features.scriptRunner.enabled` is off, and when they disallow `scriptRunner`.

The bridge never returns secrets. Its token stays in extension-host memory and the private server's `FMWEB_BRIDGE_TOKEN` environment variable. It is never a `NEXT_PUBLIC_` value or sent to browser JavaScript. The browser calls `/api/bridge/<route>`; that route checks the private session cookie, Host and exact Origin before adding the token. It does not forward browser credentials or upstream headers. Record context and found-set IDs stay in session storage, without credentials.

The preview app binds only to `127.0.0.1:3000`. VS Code opens a private launch link valid for two minutes. Redeeming it once sets an HttpOnly, SameSite=Strict session cookie and redirects to `/` without the code. A private `launch-used` file prevents reuse across workers. Pages and assets need the cookie; the bridge route checks it independently. Only `127.0.0.1:3000` and `localhost:3000` Host values are accepted. Restarting invalidates the old launch and session. A busy port is an error; it does not open the service already using that port. The private preview server checks the cookie before Next.js development endpoints, including live reload. Keep launch links private; software running as you, administrators and downloaded packages remain outside this protection.

Before installing or starting, a VS Code dialog describes the commands and lists edited or added runtime files that will be ignored. The preview runs a clean private temporary copy of the shipped template and generated layouts. Your `.npmrc`, `.env*` overrides, custom runtime files, lockfiles, `node_modules` and build output are left alone and not used. A layout with an edited or linked generated file is skipped with a warning. Starting does not delete your files.

Installation uses `npm install --ignore-scripts --no-audit --no-fund` against `registry.npmjs.org`, with separate empty user/global configuration, an explicit prefix, a private npm cache and a limited environment. The template dev script runs with npm pre/post scripts disabled. Your npm configuration is left unchanged; proxy variables and `NODE_EXTRA_CA_CERTS` pass through for company networks. **Known limit:** `npm install` resolves package versions at each start; the private preview does not reuse a workspace lockfile. No install scripts run; a failed install stops startup.

Only **FileMaker: Generate FM Web Next.js App** offers **Regenerate from template**, with a modal naming exactly which files or folders (including their contents) will be deleted. Confirm to delete those names; cancel to keep them. Otherwise generation refreshes recognized untouched files and warns about edited or linked files it keeps.

Before every script run from Layout Mode or a preview button, VS Code shows the script, layout, escaped parameter, its length and connection host. Hidden characters are visible escapes; a value too long to display in full is refused. Only one preview script prompt can be open, with a five-second cooldown after closing. Cancelling a script prompt runs no script. Cancelling preview startup clears its saved bridge address and token while preserving unrelated `.env` lines. Script names and parameters are sent exactly as supplied. Link actions accept only HTTP and HTTPS.

Private temporary folders contain a `.fmweb-preview-owner` marker naming the owning extension-host process. Cancellation or shutdown stops the process tree and removes private files. Stale marked folders older than a day are removed only if their owning process no longer exists; an open window's folder is left alone. On Windows, the preview searches absolute PATH entries for `node.exe` and `node_modules\npm\bin\npm-cli.js` (the standard Node.js installer layout); these can be in separate entries. A version manager such as nvm-windows works only if its PATH entries expose both files in those locations; a non-standard npm location may produce **Could not find Node.js and npm on PATH**. On macOS and Linux, the preview runs `npm` from PATH. No command shell or console window opens. If startup says **Could not find Node.js and npm on PATH**, install Node.js with npm and restart VS Code. Cancellation also stops the Windows process tree.

These changes add no new network destinations: the preview still reaches the public npm registry for dependencies, the local bridge, and through it the configured FileMaker server or proxy. It does not send data to the extension authors.

## What the Marketplace build contains

Packaged VSIX builds now include the `runtime-next` and `shared` source templates under `dist/fmweb-template`, so **Start FM Web Preview Server** and **Generate FM Web Next.js App** do not require this repository checkout. Earlier builds may lack that kit; commands remain hidden when the installation has no complete template. Source development hosts prefer the repository source; installed extensions prefer their bundled kit. Existing edited files and symbolic links are still preserved and reported by generation. This is a local preview and editable app scaffold, not a production deployment service.

## Develop and test

```bash
npm ci                # repository root
npm run build
npm run typecheck
npm test
npm run lint
```

Press `F5` to open an Extension Development Host and run the FM Web commands from the Command Palette: **Initialize FM Web Project**, **Select Active Profile**, **Sync FM Web Project Metadata**, **Open FM Web Layout Mode**, **Generate FM Web Next.js App**, **Generate FM Web Layout Page**, **Start FM Web Preview Server**.

## Event registration sample

In an installation with the bundled template, start the private FM Web preview and choose **Try the event registration sample** on its home page. The form reuses the shared field renderer and validates its input before sending and on the server. Use invented information: this sample acknowledges a synthetic submission and does not contact FileMaker or save a real registration.

The server accepts only the known sample form and its mapped fields, checks the preview session and exact Origin, and bounds the request to 32 KiB. A submission identifier prevents a repeated click from creating a second attempt in the same preview process. Accepted attempts replay their original receipt; an identifier reused with different values is refused. An uncertain result locks further submission and is never retried automatically. This is process-local preview behavior, not persistent or distributed duplicate protection; restarting the preview clears it.

The sample intake files are editable scaffolding in a generated app. Generation preserves existing copies; it does not overwrite your custom intake pages or handlers. Private preview startup continues to use a fresh copy of the shipped template. This sample is not a public deployment or an independent FileMaker backend.


### Build a Portal with sample data

Run **FileMaker: Build a Portal** from an open trusted workspace, or use the connection view's sample-data link. No saved FileMaker connection is required. Choose **Create or resume event registration**. The command adds only missing files under `.fmweb/intakes/` and `.fmweb/layouts/`; existing edits are never replaced. Repeating it repairs a setup interrupted between those two files. **Edit form and exact field mappings** opens even invalid JSON for repair; resuming an invalid existing starter also opens that preserved definition. Validation is still required before preview.

The saved `.intake.json` is a version 1 data contract. Edit `title`, `description`, `submitLabel`, `successMessage`, field `label`, `helpText`, `required`, `maxLength` and select `options`. Optional `branding` supports an `organizationName` and a six-digit `accentColor` such as `#215EA6`; it accepts no URL, HTML or CSS. `fmFieldName` must exactly name a writable nonglobal field in the referenced source layout, including spaces and case. Use **Open source layout** to continue in Layout Mode even if a field mapping is invalid. If source layout JSON is malformed or uses the legacy schema, that action opens the preserved source file for repair or migration instead. Keep the referenced layout ID when converting to the current schema; the legacy designer migration creates a new ID. Private portal preview can migrate legacy sources in memory without changing their referenced identity. A malformed form JSON must first be repaired through **Edit form and exact field mappings** so its source reference can be read. Keep the stable input IDs when changing labels.

Save your edits, then choose **Preview saved portal**. The existing preview confirmation explains its dependency download and private browser launch. The preview takes a validated snapshot of at most 50 saved forms and their migrated, metadata-prepared source layouts, and uses that snapshot for both rendering and submission validation. Restart the preview after editing. Portal source layouts live in a separate `intake-layouts/` folder inside the private preview, so normal record-view generation, field metadata and edited-file skip behavior are preserved. Invalid, oversized or linked definitions fail closed. A saved invalid form is not replaced by the built-in example. Open `/intake/event-registration` from the preview home page and submit invented details.

Only `environmentId: "sample"` is supported by this first journey. This is a synthetic create/preview/submit example: it does not contact a FileMaker server, create a record or persist a registration. Environment identifiers contain references, never credentials. Generated runtime source remains editable; the private preview executes the shipped template and validated data rather than workspace code. The generated app command scaffolds source; it does not publish this portal or configure a live backend.
