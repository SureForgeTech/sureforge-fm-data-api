## Summary

The Command Palette listed seventy-nine FileMaker commands side by side, so someone opening the extension for the first time had no idea where to start. **Start Here** now opens a FileMaker home: one panel with the four journeys — **Build a Web App**, **Connect and Test**, **Browse Data** and **Help** — and an **Advanced Tools** section for setup, diagnostics, code generation and the rest.

## Linked issue

Closes #578

## Changes

- Add a **FileMaker: Start Here** command that opens the home panel. Each button runs the matching command, and the page can only ask for a command the home knows.
- Add the home as a button in the Connections panel and as a link in the sidebar welcome, so a first-time user reaches it without knowing the palette.
- The home leads to the four journeys and lists the advanced tools under **Advanced Tools**.
- Keep every command id, title, keyboard shortcut, contextual action and palette entry exactly as it was.

## Why a panel and not palette menus

The first attempt put the commands into five Command Palette submenus. That cannot work: VS Code registers the command palette menu with `supportsSubmenus: false` (`src/vs/workbench/services/actions/common/menusExtensionPoint.ts`, both at tag `1.96.0`, the extension's minimum engine, and on `main`), so a `submenu` property on a palette entry is dropped and the commands stay flat. An independent review of that attempt caught it; the attempt was replaced by this panel.

## Acceptance criteria mirror

- [x] One place leads to Build a Web App, Connect and Test, Browse Data and Help.
- [x] Setup, diagnostics, generation and legacy commands are grouped under Advanced Tools.
- [x] Every command keeps its id, its title, its keyboard shortcut, its contextual action and its palette entry.
- [x] The home cannot run anything but the commands it lists.

## Test plan

The repository's Node 22 validation gate passed on the head of this pull request: `npm ci`, `npm audit --omit=dev --audit-level=high`, lint, the workflow regression tests, the rotation parser tests, `npm run build -w shared`, `npm run mock:check -w extension`, typecheck, `npm run test:coverage`, `npm run build`, `npm test -w designer-ui -w runtime-next`, `npm run package:check` and the VSIX size budget.

A new unit test pins the behaviour: the panel offers the four journeys and the advanced tools, a button asks for the command it names, a message for any other command is refused, and every command the home names is one the extension contributes.

Live VS Code was not run by the author. The hosted Ubuntu and Windows jobs, the first-run smoke, CodeQL, the DCO sign-off and the required `build-test` and `e2e-ui-smoke` checks are green on the head.

## Changelog entry

- [FEATURE] Start Here opens a FileMaker home with the four journeys — Build a Web App, Connect and Test, Browse Data and Help — and an Advanced Tools section for the rest. Each button runs the matching command.
