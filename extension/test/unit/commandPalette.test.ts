import { readFileSync } from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { FILEMAKER_HOME_SECTIONS } from '../../src/webviews/home/catalogue';

const extensionDir = path.resolve(__dirname, '../..');
const manifest = JSON.parse(readFileSync(path.join(extensionDir, 'package.json'), 'utf8')) as {
  contributes: {
    commands: Array<{ command: string; title: string }>;
    menus: { commandPalette: Array<{ command: string; when?: string }> };
    walkthroughs: Array<{ steps: Array<{ description: string }> }>;
  };
};
const POWER = 'filemaker.powerUserMode';

const palette = new Map(
  manifest.contributes.menus.commandPalette.map((entry) => [entry.command, entry.when ?? 'true'])
);

/**
 * The everyday commands: the home's four journeys, the README's "Common commands" table and the
 * walkthrough's six steps, plus Start Here, which opens the home.
 *
 * The manifest contract also calls a few commands always available or primary; they stay in the
 * palette too.
 */
const ALWAYS_AVAILABLE = [
  'filemakerDataApiTools.cancelJob',
  'filemakerDataApiTools.showJobs',
  'filemakerDataApiTools.copyConnectionDiagnosis',
  'filemakerDataApiTools.disconnect',
  'filemakerDataApiTools.listLayouts'
];
function everydayCommands(): string[] {
  const byTitle = new Map(manifest.contributes.commands.map((entry) => [entry.title, entry.command]));
  const readme = readFileSync(path.join(extensionDir, 'README.md'), 'utf8');
  const table = readme.split('## Common commands')[1]?.split('\n## ')[0] ?? '';
  const fromReadme = [...table.matchAll(/`FileMaker: ([^`]+)`/g)].map((match) => byTitle.get(match[1]!)!);
  const fromWalkthrough = manifest.contributes.walkthroughs.flatMap((guide) =>
    guide.steps.flatMap((step) =>
      [...step.description.matchAll(/\(command:([A-Za-z0-9_.]+)\)/g)].map((match) => match[1]!)
    )
  );
  const journeys = FILEMAKER_HOME_SECTIONS.flatMap((section) => section.entries.map((entry) => entry.command));
  return [
    ...new Set([
      ...journeys,
      ...fromReadme,
      ...fromWalkthrough,
      'filemakerDataApiTools.startHere',
      ...ALWAYS_AVAILABLE
    ])
  ];
}

describe('the Command Palette', () => {
  const everyday = everydayCommands();

  it('shows the everyday commands without the power-user setting', () => {
    expect(everyday.length).toBeGreaterThan(0);
    for (const command of everyday) {
      expect(palette.get(command) ?? 'true', command).not.toContain(POWER);
      expect(palette.get(command) ?? 'true', command).not.toBe('false');
    }
  });

  it('keeps every other command behind the power-user setting', () => {
    for (const { command } of manifest.contributes.commands) {
      if (everyday.includes(command)) continue;
      const when = palette.get(command);
      expect(when, command).toBeDefined();
      if (when === 'false') continue;
      expect(when, command).toContain(POWER);
    }
  });

  it('names every command the extension contributes', () => {
    for (const { command } of manifest.contributes.commands) {
      expect(palette.has(command) || everyday.includes(command), command).toBe(true);
    }
  });
});
