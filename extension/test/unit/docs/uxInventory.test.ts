import { readFileSync } from 'node:fs';
import path from 'node:path';

import { intakeStarters } from '@fmweb/shared';
import { describe, expect, it } from 'vitest';

import { FILEMAKER_HOME_COMMANDS, FILEMAKER_HOME_SECTIONS } from '../../../src/webviews/home/catalogue';

const root = path.resolve(__dirname, '../../../..');
const manifest = JSON.parse(readFileSync(path.join(root, 'extension/package.json'), 'utf8')) as {
  contributes: {
    commands: Array<{ command: string; title: string; category: string }>;
    menus: { commandPalette: Array<{ command: string; when?: string }> };
    configuration: Array<{ properties: Record<string, unknown> }>;
    keybindings: Array<{ command: string; key: string }>;
    walkthroughs: Array<{ steps: Array<{ description: string }> }>;
  };
};
const inventory = readFileSync(path.join(root, 'docs/UX_INVENTORY.md'), 'utf8');
const readme = readFileSync(path.join(root, 'extension/README.md'), 'utf8');

const palette = new Map(
  manifest.contributes.menus.commandPalette.map((entry) => [entry.command, entry.when ?? 'true'])
);

/**
 * Every context key the manifest's `when` clauses use. A clause that names a key this list does
 * not hold, or that uses an operator this model does not evaluate, makes the test fail rather
 * than leave the document quietly wrong.
 */
const CONTEXT_KEYS = [
  'filemaker.hasProfiles',
  'filemaker.powerUserMode',
  'filemaker.hasSchemaSnapshots',
  'filemaker.enterpriseMode',
  'filemaker.ai.active',
  'filemaker.fmWebProjectInitialized',
  'filemaker.fmWebPreviewAvailable'
];

/**
 * The terms of a `when` clause: the context keys it asks for, joined by `&&`. VS Code's grammar
 * allows more than that, and this model evaluates only this much.
 */
function whenTerms(when: string): string[] {
  expect(when, 'a when clause uses ||, which this model does not evaluate').not.toContain('||');
  expect(when, 'a when clause uses an operator, which this model does not evaluate').not.toMatch(/[!<>=]/);
  const terms = when.split('&&').map((term) => term.trim());
  for (const term of terms) {
    expect(CONTEXT_KEYS.includes(term), `a when clause uses an unknown context key: ${term}`).toBe(true);
  }
  return terms;
}

/** How many commands the palette shows with the given context. */
function visibleCount(profile: boolean, power: boolean, snapshots: boolean): number {
  const context: Record<string, boolean> = {
    'filemaker.hasProfiles': profile,
    'filemaker.powerUserMode': power,
    'filemaker.hasSchemaSnapshots': snapshots,
    // Off in every counted state: an enterprise server, the AI tools, an initialised FM Web
    // project and its preview.
    'filemaker.enterpriseMode': false,
    'filemaker.ai.active': false,
    'filemaker.fmWebProjectInitialized': false,
    'filemaker.fmWebPreviewAvailable': false
  };
  let visible = 0;
  for (const { command } of manifest.contributes.commands) {
    const when = palette.get(command) ?? 'true';
    if (when === 'false') continue;
    if (when === 'true') {
      visible += 1;
      continue;
    }
    const terms = whenTerms(when);
    if (terms.every((term) => context[term] === true)) visible += 1;
  }
  return visible;
}

/** The commands the palette shows without the power-user setting. */
function everydayCommands(): string[] {
  return manifest.contributes.commands
    .filter(({ command }) => {
      const when = palette.get(command) ?? 'true';
      if (when === 'true') return true;
      if (when === 'false') return false;
      return !whenTerms(when).includes('filemaker.powerUserMode');
    })
    .map(({ command }) => command);
}

/** The commands the palette keeps behind the power-user setting. */
function commandsBehindPowerUser(): string[] {
  return manifest.contributes.commands
    .filter(({ command }) => {
      const when = palette.get(command) ?? 'true';
      if (when === 'true' || when === 'false') return false;
      return whenTerms(when).includes('filemaker.powerUserMode');
    })
    .map(({ command }) => command);
}

/** The commands the palette hides on purpose. */
function commandsOutOfPalette(): string[] {
  return manifest.contributes.commands
    .filter(({ command }) => palette.get(command) === 'false')
    .map(({ command }) => command);
}

/**
 * The three documents the everyday set is written down in: the home's four journeys, the
 * extension README's "Common commands" table and the walkthrough's steps.
 */
function threeDocuments(): { commands: Set<string>; sources: number } {
  const byTitle = new Map(manifest.contributes.commands.map((entry) => [entry.title, entry.command]));
  const table = readme.split('## Common commands')[1]?.split('\n## ')[0] ?? '';
  const fromReadme = [...table.matchAll(/`FileMaker: ([^`]+)`/g)]
    .map((match) => byTitle.get(match[1]!))
    .filter((command): command is string => command !== undefined);
  const fromWalkthrough = manifest.contributes.walkthroughs.flatMap((guide) =>
    guide.steps.flatMap((step) =>
      [...step.description.matchAll(/\(command:([A-Za-z0-9_.]+)\)/g)].map((match) => match[1]!)
    )
  );
  const fromJourneys = FILEMAKER_HOME_SECTIONS.flatMap((section) =>
    section.entries.map((entry) => entry.command)
  );
  const sources = [fromJourneys, fromReadme, fromWalkthrough].filter((list) => list.length > 0).length;
  return { commands: new Set([...fromJourneys, ...fromReadme, ...fromWalkthrough]), sources };
}

/**
 * The one place in the document that carries the given wording. A pattern that matched twice
 * would leave the checked sentence to chance, so the count is asserted.
 */
function statedMatch(pattern: RegExp, what: string): RegExpMatchArray {
  const global = pattern.flags.includes('g') ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  const matches = [...inventory.matchAll(global)];
  expect(matches, `the inventory should carry ${what} exactly once`).toHaveLength(1);
  return matches[0]!;
}

/** The number the inventory's own table states for a row, read from that row's cell. */
function stated(state: string): number {
  const rows = inventory.split('\n').filter((line) => line.startsWith(`| ${state} |`));
  expect(rows, `the inventory should have exactly one row for "${state}"`).toHaveLength(1);
  return Number(rows[0]!.split('|')[2]!.trim());
}

/** The number the inventory states in the sentence that carries the given wording. */
function statedNumber(pattern: RegExp, what: string): number {
  return Number(statedMatch(pattern, what)[1]);
}

/** The small numbers a document may spell out rather than write as digits. */
const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10
};

/** The number a sentence states, whether it is written as a digit or as a word. */
function numberIn(text: string): number {
  const trimmed = text.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  const word = trimmed.toLowerCase();
  expect(Object.hasOwn(NUMBER_WORDS, word), `the inventory should state a number, not "${text}"`).toBe(true);
  return NUMBER_WORDS[word]!;
}

describe('the UX inventory', () => {
  it('states the manifest sizes it measured', () => {
    expect(statedNumber(/declares \*\*(\d+) commands\*\*/, 'the command count')).toBe(
      manifest.contributes.commands.length
    );
    expect(statedNumber(/\*\*(\d+) configuration properties\*\*/, 'the configuration property count')).toBe(
      manifest.contributes.configuration.flatMap((section) => Object.keys(section.properties)).length
    );
  });

  it('states the commands visible in each state', () => {
    expect(stated('Fresh install, no connection')).toBe(visibleCount(false, false, false));
    expect(stated('One connection')).toBe(visibleCount(true, false, false));
    expect(stated('One connection and `filemaker.advanced.powerUserMode`')).toBe(visibleCount(true, true, false));
    expect(stated('One connection, power-user mode and saved schema snapshots')).toBe(visibleCount(true, true, true));
  });

  it('states the everyday commands the palette shows without the power-user setting', () => {
    const everyday = everydayCommands();
    expect(everyday.length).toBeGreaterThan(0);
    expect(statedNumber(/palette (?:now )?shows (\d+) everyday commands/, 'the everyday set size')).toBe(
      everyday.length
    );
  });

  it('states how many of the everyday commands need a connection', () => {
    const gated = manifest.contributes.commands.filter(
      ({ command }) => palette.get(command) === 'filemaker.hasProfiles'
    );
    const match = statedMatch(
      /(\d+) of (?:its|the) (\d+)[\w\s]{0,40}?are gated on\s+`filemaker\.hasProfiles`/,
      'the connection-gated count'
    );
    expect(Number(match[1])).toBe(gated.length);
    // The second number is the everyday set the sentence counts from.
    expect(Number(match[2])).toBe(everydayCommands().length);
  });

  it('states the everyday set the three documents already write down', () => {
    const { commands: documents, sources } = threeDocuments();
    expect(documents.size).toBeGreaterThan(0);
    // "written down in three places in the repository" and "the home's four journeys".
    const places = statedMatch(
      /written down in\s+([A-Za-z]+) places in the repository/,
      'the number of places the everyday set is written down'
    );
    expect(numberIn(places[1]!)).toBe(sources);
    // Both places that count the home's journeys say the same number.
    for (const pattern of [
      /the ([A-Za-z]+) journeys, the advanced sections/,
      /the home's ([A-Za-z]+)\s+journeys/
    ]) {
      expect(numberIn(statedMatch(pattern, 'the number of journeys the home has')[1]!)).toBe(
        FILEMAKER_HOME_SECTIONS.length
      );
    }
    expect(statedNumber(/and is (\d+)\s+commands/, 'the three-document count')).toBe(documents.size);
    // The same number, where the proposal names the three documents again.
    expect(statedNumber(/the (\d+)\s+from those three\s+documents/, 'the three-document count')).toBe(
      documents.size
    );
    const everyday = new Set(everydayCommands());
    for (const command of documents) {
      expect(everyday.has(command), command).toBe(true);
    }
  });

  it('states the same counts where the document repeats them', () => {
    const withConnection = stated('One connection');
    const freshInstall = stated('Fresh install, no connection');
    // "and 30 palette entries", in the journey section.
    expect(statedNumber(/and (\d+) palette entries/, 'the palette size with a connection')).toBe(withConnection);
    // "a fresh install shows 13 of them in the palette".
    expect(statedNumber(/a fresh install shows (\d+)\s+of them in the palette/, 'the fresh-install count')).toBe(
      freshInstall
    );
    // "Whether the 13 commands visible on a fresh install are the right 13".
    const closing = statedMatch(
      /Whether the (\d+) commands visible on a fresh install are the right (\d+)/,
      'the closing fresh-install count'
    );
    expect(Number(closing[1])).toBe(freshInstall);
    expect(Number(closing[2])).toBe(freshInstall);
    // "the palette listed 58 flat entries when this was measured, and now lists 30".
    expect(statedNumber(/entries when this was measured, and now lists (\d+)/, 'the palette size today')).toBe(
      withConnection
    );
  });

  it('names every command the palette shows without a connection in the FileMaker home', () => {
    // The criterion the inventory applies to the commands visible on a fresh install: a command
    // belongs there when the repository's own launcher offers it.
    const paletteCommands = new Set(
      (manifest.contributes.menus?.commandPalette ?? []).map((entry: { command: string }) => entry.command)
    );
    const alwaysVisible = manifest.contributes.commands
      .map((command: { command: string }) => command.command)
      .filter((command: string) => !paletteCommands.has(command));
    expect(alwaysVisible.length).toBeGreaterThan(0);
    const named = alwaysVisible.filter((command: string) => FILEMAKER_HOME_COMMANDS.includes(command));
    expect(named).toEqual(alwaysVisible);
  });

  it('states the keybindings the extension ships', () => {
    const keybindings = manifest.contributes.keybindings.length;
    expect(keybindings).toBeGreaterThan(0);
    const match = statedMatch(/\| ([A-Za-z]+) bindings:/, 'the number of keybindings');
    expect(numberIn(match[1]!)).toBe(keybindings);
  });

  it('states the starter set the extension ships', () => {
    const count = intakeStarters.length;
    expect(count).toBeGreaterThan(0);
    const inHeader = statedMatch(/the\s+starter set grew from two to ([A-Za-z]+)/, 'the starter count in the header');
    expect(numberIn(inHeader[1]!)).toBe(count);
    const inJourney = statedMatch(
      /the starter set was two entries\s+when this was measured, and is ([A-Za-z]+) now/,
      'the starter count in the journey section'
    );
    expect(numberIn(inJourney[1]!)).toBe(count);
  });

  it('states the command category the extension uses', () => {
    const categories = new Set(manifest.contributes.commands.map((entry) => entry.category));
    expect(categories.size).toBe(1);
    const match = statedMatch(/in ([A-Za-z]+) `FileMaker`\s+command category/, 'the number of command categories');
    expect(numberIn(match[1]!)).toBe(categories.size);
  });

  it('states the walkthrough the way the extension ships it', () => {
    const steps = manifest.contributes.walkthroughs.reduce((total, guide) => total + guide.steps.length, 0);
    expect(steps).toBeGreaterThan(0);
    const inTable = statedMatch(/\| ([A-Za-z]+) steps:/, 'the number of walkthrough steps');
    expect(numberIn(inTable[1]!)).toBe(steps);
    const inProposal = statedMatch(/the walkthrough's ([A-Za-z]+) steps/, 'the number of walkthrough steps');
    expect(numberIn(inProposal[1]!)).toBe(steps);
  });

  it('names the commands the palette hides on purpose', () => {
    const hidden = commandsOutOfPalette();
    const byCommand = new Map(manifest.contributes.commands.map((entry) => [entry.command, entry.title]));
    // The sentence that lists them, not the whole document.
    const sentence = statedMatch(
      /apart from [A-Za-z]+ that are hidden from the palette\s+on purpose \([^)]*\)/,
      'the sentence that names the hidden commands'
    );
    for (const command of hidden) {
      expect(sentence[0], byCommand.get(command)).toContain(byCommand.get(command)!);
    }
  });

  it('states the palette as a plain list of entries', () => {
    expect(statedNumber(/plain list of (\d+)\s+entries/, 'the number of palette entries')).toBe(
      manifest.contributes.menus.commandPalette.length
    );
  });

  it('states where the other commands went', () => {
    const behindPowerUser = commandsBehindPowerUser();
    const outOfPalette = commandsOutOfPalette();
    expect(outOfPalette.length).toBeGreaterThan(0);
    const match = statedMatch(
      /The other (\d+) sit behind `filemaker\.advanced\.powerUserMode`, and\s+(\w+) more stay out of the palette/,
      'where the other commands went'
    );
    expect(Number(match[1])).toBe(behindPowerUser.length);
    expect(numberIn(match[2]!)).toBe(outOfPalette.length);
  });

  it('states the other commands of the everyday palette in the journey section', () => {
    const everyday = everydayCommands();
    const match = statedMatch(
      /The other (\d+)\s+commands are off the everyday palette: (\d+) of them sit behind/,
      'how the other commands are split'
    );
    expect(Number(match[1])).toBe(manifest.contributes.commands.length - everyday.length);
    expect(Number(match[2])).toBe(commandsBehindPowerUser().length);
  });

  it('states how many commands are hidden from the palette on purpose', () => {
    const hidden = commandsOutOfPalette();
    const match = statedMatch(
      /apart from (\w+) that are hidden from the palette/,
      'the number of commands hidden from the palette'
    );
    expect(numberIn(match[1]!)).toBe(hidden.length);
    // The surface table says the same, and proposal 2 counts what the home has to hold.
    const inTable = statedMatch(
      /the rest sit behind `filemaker\.advanced\.powerUserMode`, and\s+(\w+) stay out of the palette/,
      'the number of commands that stay out of the palette'
    );
    expect(numberIn(inTable[1]!)).toBe(hidden.length);
    const inProposal = statedMatch(
      /could not hold\s+every one of the (\d+) commands/,
      'the number of commands the home has to hold'
    );
    expect(Number(inProposal[1])).toBe(manifest.contributes.commands.length);
  });

  it('states how many everyday commands need a saved schema snapshot', () => {
    const gated = manifest.contributes.commands.filter(
      ({ command }) => palette.get(command) === 'filemaker.hasSchemaSnapshots'
    );
    const match = statedMatch(
      /([A-Za-z]+) more needs? a saved schema snapshot/,
      'the number of everyday commands that need a saved snapshot'
    );
    expect(numberIn(match[1]!)).toBe(gated.length);
  });

  it('names the everyday commands the three documents do not cover', () => {
    const { commands: documents } = threeDocuments();
    const everyday = everydayCommands();
    const extra = everyday.filter(
      (command) => !documents.has(command) && command !== 'filemakerDataApiTools.startHere'
    );
    expect(extra.length).toBeGreaterThan(0);
    const byCommand = new Map(manifest.contributes.commands.map((entry) => [entry.command, entry.title]));
    // The proposal names them in one sentence; check that sentence, not the whole document.
    const sentence = statedMatch(
      /plus the ([A-Za-z]+) the User Guide's command table\s+already marks[\s\S]*?\.\n/,
      'the sentence that names the everyday commands the three documents do not cover'
    );
    expect(numberIn(sentence[1]!)).toBe(extra.length);
    for (const command of extra) {
      expect(sentence[0], byCommand.get(command)).toContain(byCommand.get(command)!);
    }
  });

  it('states that the home names every command, and the home does', () => {
    expect(statedNumber(/names \*\*all (\d+) commands\*\*/, 'the number of commands the home names')).toBe(
      manifest.contributes.commands.length
    );
    const named = new Set(FILEMAKER_HOME_COMMANDS);
    for (const { command } of manifest.contributes.commands) {
      expect(named.has(command), command).toBe(true);
    }
  });
});
