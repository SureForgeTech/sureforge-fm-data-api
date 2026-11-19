All three stages of this handoff are delivered and verified, and the command regrouping that stage 3 named as separate work has landed as well.

| Stage | Pull request | Merge commit | Verified |
| --- | --- | --- | --- |
| 1. Prompt-based form drafting | #567 | `882d2884f617ca58a2d07755df4db550f9e6dd37` | tree byte-identical to the reviewed head `a6f5f87` |
| 2. The mock FileMaker lost-receipt regression | #569 | `162e35a4ed788c6994a353978c9c1d1f3474d554` | tree byte-identical to the reviewed head `76b738d` |
| 3. The first-run wizard | #576 | `85c025f1f45746e9d1561b5ff86d59ca44d274a5` | tree byte-identical to the reviewed head `e7740ea` |
| 4. The FileMaker home (command regrouping) | #579 | `9b2b845511c1509af036277e3df87986f65537e3` | tree byte-identical to the reviewed head `69588ab` |

`main` is `9b2b845` and its tree is byte-identical to the reviewed head of every change above. `build-test`, `e2e-ui-smoke`, both cross-platform jobs, `build`, CodeQL, the documentation build and the deploy are green on it.

## The FileMaker home (#579)

The Command Palette cannot group commands: VS Code registers that menu with `supportsSubmenus: false` (`menusExtensionPoint.ts`, at tag `1.96.0` and on `main`), so a `submenu` property on a palette entry is dropped. A first attempt that used palette submenus was rejected by an independent review and replaced.

The home is a panel instead. **FileMaker: Start Here** opens Build a Web App, Connect and Test, Browse Data and Help, with an Advanced Tools section for the rest. Each button runs the matching command, and the page can only ask for a command the catalogue names. The home is also a button in the Connections panel and a link in the sidebar. No command id, title, keyboard shortcut, contextual action or palette entry changed.

## Still outstanding

- **#575**: the packaged-VSIX browser journey cannot run in this sandbox — `update.code.visualstudio.com` has no DNS here and the proxy refuses it, so the e2e-ui harness cannot start VS Code. The elapsed time, the deliberate choices and the cold dependency setup are therefore still unmeasured.
- **#573**: the parser gaps an earlier review round found (an exclusion that follows the field, "everything but X", and "do not require X" dropping the field silently). Each needs a decision about the intended meaning rather than a one-line change.
- **#574's remaining items**: the Cursor/VS Code AI host integration, the responses grid, the searchable directory, the dashboard and the work tracker are not started.
