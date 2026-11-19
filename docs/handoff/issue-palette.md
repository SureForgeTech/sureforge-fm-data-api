The Command Palette lists every FileMaker command side by side. Someone who installed the extension for the first time sees seventy-nine commands with no indication of where to start, and the everyday workflows are mixed with setup, diagnostics, code generation and legacy commands.

## What to build

Give the extension a home that leads to the four journeys a first-time user needs:

- **Build a Web App**
- **Connect and Test**
- **Browse Data**
- **Help**

and group setup, diagnostics, code generation and legacy commands under **Advanced Tools**.

## Constraint that shapes the work

The Command Palette cannot nest menus. VS Code registers the command palette menu with `supportsSubmenus: false` (`src/vs/workbench/services/actions/common/menusExtensionPoint.ts`, at tag `1.96.0`, the extension's minimum engine, and on `main`), so a `submenu` property on a `menus.commandPalette` entry is dropped and the commands stay flat. A first attempt that used palette submenus was replaced after an independent review found this.

The home is therefore a panel, reachable from the palette, from a button in the Connections view and from the sidebar welcome page.

## Constraints

- Every command keeps its id, its title, its keyboard shortcut and its place in the sidebar.
- Every visibility condition stays exactly as it is.
- A command must stay reachable: the home runs the commands it lists, and nothing else.
- The user guide and both changelogs describe the home.

## Acceptance criteria

- One place leads to the four journeys, and each entry runs the matching command.
- Setup, diagnostics, generation and legacy commands are grouped under Advanced Tools.
- Command ids, titles, shortcuts, contextual actions and palette entries are unchanged.
- The home cannot run a command it does not list.
- The repository's full Node 22 gate passes, and a test pins the behaviour.

## Notes

This is the "command regrouping" that the sandbox handoff (#574) named as separate work. It is independent of the first-run wizard (#576): the wizard decides what a new user does, this decides where they look first.
