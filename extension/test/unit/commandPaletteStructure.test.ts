import { readFileSync } from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

const extensionDir = path.resolve(__dirname, '../..');
const manifest = JSON.parse(readFileSync(path.join(extensionDir, 'package.json'), 'utf8')) as {
  contributes: {
    commands: Array<{ command: string; title: string }>;
    keybindings: Array<{ command: string }>;
    submenus: Array<{ id: string; label: string }>;
    menus: {
      commandPalette: Array<{ command: string; when?: string; submenu?: string }>;
      'view/title': Array<{ command: string }>;
      'view/item/context': Array<{ command: string }>;
    };
  };
};

const commands = manifest.contributes.commands.map(({ command }) => command);
const palette = manifest.contributes.menus.commandPalette;
const submenus = manifest.contributes.submenus;

describe('command palette structure', () => {
  it('groups every command under one of the five FileMaker menus', () => {
    const grouped = palette.filter((entry) => entry.submenu).map((entry) => entry.command);
    expect(grouped.sort()).toEqual([...commands].sort());
    for (const entry of palette) expect(entry.submenu).toBeTruthy();
    expect(palette).toHaveLength(commands.length);
  });

  it('declares the five menus the palette groups into', () => {
    expect(submenus.map(({ label }) => label)).toEqual([
      'FileMaker: Build a Web App',
      'FileMaker: Connect and Test',
      'FileMaker: Browse Data',
      'FileMaker: Help',
      'FileMaker: Advanced Tools'
    ]);
    const declared = new Set(submenus.map(({ id }) => id));
    for (const entry of palette) expect(declared.has(entry.submenu!)).toBe(true);
  });

  it('keeps the everyday commands out of Advanced Tools', () => {
    const home = new Set(['filemaker.buildWebApp', 'filemaker.connectAndTest', 'filemaker.browseData', 'filemaker.help']);
    for (const entry of palette) {
      if (!home.has(entry.submenu!)) continue;
      expect(entry.submenu).not.toBe('filemaker.advancedTools');
    }
    const advanced = palette.filter((entry) => entry.submenu === 'filemaker.advancedTools').map((entry) => entry.command);
    for (const setup of ['filemakerDataApiTools.showDiagnostics', 'filemakerDataApiTools.generateTypeScriptClient',
      'filemakerDataApiTools.initializeFmWebProject', 'filemakerDataApiTools.reloadPlugins']) {
      expect(advanced).toContain(setup);
    }
  });

  it('keeps every shortcut and contextual action pointing at a command that still exists', () => {
    const known = new Set(commands);
    for (const { command } of manifest.contributes.keybindings) expect(known.has(command)).toBe(true);
    for (const { command } of manifest.contributes.menus['view/title']) expect(known.has(command)).toBe(true);
    for (const { command } of manifest.contributes.menus['view/item/context']) expect(known.has(command)).toBe(true);
  });

  it('still hides a command that no longer has a place in the palette', () => {
    const hidden = palette.find((entry) => entry.command === 'filemakerDataApiTools.refreshExplorer');
    expect(hidden?.when).toBe('false');
  });
});
