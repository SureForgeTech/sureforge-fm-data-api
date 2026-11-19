#!/usr/bin/env python3
"""Give the command palette a FileMaker home.

Every contributed command moves into one of five submenus. Command ids, titles,
keybindings, the view menus and every `when` clause stay exactly as they are;
only the command palette gains a `submenu` property, and a `submenus`
contribution declares the five new menus.

The edit is textual so the manifest keeps its existing formatting.
"""
import json
import pathlib
import re

MANIFEST = pathlib.Path('/workspace/sureforge-fm-data-api-wt-home/extension/package.json')
BEFORE = pathlib.Path('/workspace/.fm-artifacts/package-before.json')
text = MANIFEST.read_text()
if not BEFORE.exists() or json.loads(BEFORE.read_text()) != json.loads(text):
    BEFORE.write_text(text)
before_json = json.loads(BEFORE.read_text())
d = json.loads(text)
contributes = d['contributes']
commands = [c['command'] for c in contributes['commands']]
palette = {e['command']: e.get('when') for e in contributes['menus']['commandPalette']}

SUBMENUS = [
    ('filemaker.buildWebApp', 'FileMaker: Build a Web App'),
    ('filemaker.connectAndTest', 'FileMaker: Connect and Test'),
    ('filemaker.browseData', 'FileMaker: Browse Data'),
    ('filemaker.help', 'FileMaker: Help'),
    ('filemaker.advancedTools', 'FileMaker: Advanced Tools'),
]

MAPPING = {
    'filemaker.buildWebApp': [
        'filemakerDataApiTools.createFmWebApp',
        'filemakerDataApiTools.buildPortal',
        'filemakerDataApiTools.openLayoutMode',
        'filemakerDataApiTools.generateFmWebLayoutPage',
        'filemakerDataApiTools.startFmWebPreviewServer',
    ],
    'filemaker.connectAndTest': [
        'filemakerDataApiTools.addConnectionProfile',
        'filemakerDataApiTools.editConnectionProfile',
        'filemakerDataApiTools.removeConnectionProfile',
        'filemakerDataApiTools.connect',
        'filemakerDataApiTools.disconnect',
        'filemakerDataApiTools.openConnectionMenu',
        'filemakerDataApiTools.selectActiveProfile',
        'filemakerDataApiTools.testMyServer',
        'filemakerDataApiTools.diagnoseConnection',
        'filemakerDataApiTools.copyConnectionDiagnosis',
        'filemakerDataApiTools.refreshExplorer',
    ],
    'filemaker.browseData': [
        'filemakerDataApiTools.listLayouts',
        'filemakerDataApiTools.openQueryBuilder',
        'filemakerDataApiTools.openRecordViewer',
        'filemakerDataApiTools.openRecordEditor',
        'filemakerDataApiTools.runFindJson',
        'filemakerDataApiTools.getRecordById',
        'filemakerDataApiTools.editRecordById',
        'filemakerDataApiTools.createRecord',
        'filemakerDataApiTools.deleteRecord',
        'filemakerDataApiTools.uploadContainer',
        'filemakerDataApiTools.openLayoutMetadata',
        'filemakerDataApiTools.selectLayoutForInspector',
        'filemakerDataApiTools.refreshLayoutInspector',
        'filemakerDataApiTools.refreshSchemaCache',
        'filemakerDataApiTools.openScriptRunner',
        'filemakerDataApiTools.copyRequestAsCode',
        'filemakerDataApiTools.saveCurrentQuery',
        'filemakerDataApiTools.runSavedQuery',
        'filemakerDataApiTools.openSavedQuery',
        'filemakerDataApiTools.manageSavedQueries',
        'filemakerDataApiTools.exportSavedQueries',
        'filemakerDataApiTools.importSavedQueries',
        'filemakerDataApiTools.deleteSavedQuery',
        'filemakerDataApiTools.showRequestHistory',
        'filemakerDataApiTools.captureSchemaSnapshot',
        'filemakerDataApiTools.diffSchemaSnapshots',
        'filemakerDataApiTools.diffAgainstLatestSnapshot',
        'filemakerDataApiTools.openSchemaSnapshotJson',
        'filemakerDataApiTools.batchExportFind',
        'filemakerDataApiTools.batchUpdateFromFile',
        'filemakerDataApiTools.cancelJob',
        'filemakerDataApiTools.showJobs',
    ],
    'filemaker.help': [
        'filemakerDataApiTools.openWelcomeWalkthrough',
        'filemakerDataApiTools.openUserGuide',
        'filemakerDataApiTools.about',
    ],
    'filemaker.advancedTools': [
        'filemakerDataApiTools.showDiagnostics',
        'filemakerDataApiTools.showEffectiveSettings',
        'filemakerDataApiTools.writeAiContext',
        'filemakerDataApiTools.generateTypesForLayout',
        'filemakerDataApiTools.generateTypesForAllLayouts',
        'filemakerDataApiTools.generateSnippetsForLayout',
        'filemakerDataApiTools.generateTypeScriptClient',
        'filemakerDataApiTools.openGeneratedTypesFolder',
        'filemakerDataApiTools.initializeFmWebProject',
        'filemakerDataApiTools.syncFmWebMetadata',
        'filemakerDataApiTools.generateFmWebNextApp',
        'filemakerDataApiTools.openDiagnosticsDashboard',
        'filemakerDataApiTools.showCircuitBreakerStatus',
        'filemakerDataApiTools.reloadPlugins',
        'filemakerDataApiTools.listActivePlugins',
        'filemakerDataApiTools.toggleOfflineMode',
        'filemakerDataApiTools.refreshOfflineCache',
        'filemakerDataApiTools.createEnvironmentSet',
        'filemakerDataApiTools.compareEnvironments',
        'filemakerDataApiTools.diffLayoutAcrossEnvironments',
        'filemakerDataApiTools.exportEnvironmentComparisonReport',
        'filemakerDataApiTools.openEnvironmentSetJson',
        'filemakerDataApiTools.setAiAccess',
        'filemakerDataApiTools.toggleAiKillSwitch',
        'filemakerDataApiTools.showAiActivity',
        'filemakerDataApiTools.newAiSession',
        'filemakerDataApiTools.toggleAiServer',
        'filemakerDataApiTools.copyAiMcpConfig',
    ],
}

assigned = [c for group in MAPPING.values() for c in group]
missing = [c for c in commands if c not in assigned]
unknown = [c for c in assigned if c not in commands]
dupes = sorted({c for c in assigned if assigned.count(c) > 1})
if missing or unknown or dupes:
    raise SystemExit(f'mapping is not a partition: missing={missing} unknown={unknown} dupes={dupes}')

submenu_of = {command: submenu for submenu, members in MAPPING.items() for command in members}

# --- the command palette array -------------------------------------------------
lines = ['      "commandPalette": [']
entries = []
for command in commands:
    entry = ['        {', f'          "command": "{command}",']
    # Every palette entry carries an explicit when clause. A command that is always
    # available says so, which is what moving it into a submenu needs.
    when = palette.get(command, 'true')
    entry.append(f'          "when": {json.dumps(when)},')
    entry.append(f'          "submenu": "{submenu_of[command]}"')
    entry.append('        }')
    entries.append('\n'.join(entry))
lines.append(',\n'.join(entries))
lines.append('      ]')
new_palette = '\n'.join(lines)

start = text.index('      "commandPalette": [')
end = text.index('\n      ]', start) + len('\n      ]')
text = text[:start] + new_palette + text[end:]

# --- the submenus contribution --------------------------------------------------
submenu_block = ['    "submenus": [']
blocks = []
for sid, label in SUBMENUS:
    blocks.append('      {\n'
                  f'        "id": "{sid}",\n'
                  f'        "label": "{label}"\n'
                  '      }')
submenu_block.append(',\n'.join(blocks))
submenu_block.append('    ],')
anchor = '    "configuration": ['
text = text.replace(anchor, '\n'.join(submenu_block) + '\n' + anchor, 1)

MANIFEST.write_text(text)

# --- verify ---------------------------------------------------------------------
after = json.loads(MANIFEST.read_text())
assert after['contributes']['menus']['commandPalette'], 'palette lost'
assert len(after['contributes']['menus']['commandPalette']) == len(commands)
assert after['contributes']['submenus'] == [{'id': s, 'label': l} for s, l in SUBMENUS]
for entry in after['contributes']['menus']['commandPalette']:
    assert entry['submenu'] in SUBMENUS_IDS if (SUBMENUS_IDS := {s for s, _ in SUBMENUS}) else True

assert before_json['contributes']['commands'] == after['contributes']['commands'], 'commands changed'
assert before_json['contributes']['keybindings'] == after['contributes']['keybindings'], 'keybindings changed'
assert before_json['contributes']['menus']['view/title'] == after['contributes']['menus']['view/title'], 'view/title changed'
assert before_json['contributes']['menus']['view/item/context'] == after['contributes']['menus']['view/item/context'], 'view/item/context changed'
for entry in after['contributes']['menus']['commandPalette']:
    old = next((e for e in before_json['contributes']['menus']['commandPalette'] if e['command'] == entry['command']), None)
    # A command that had no palette rule was always visible; it now says so explicitly.
    expected = (old or {}).get('when', 'true')
    assert expected == entry.get('when'), f"when changed for {entry['command']}: {expected} -> {entry.get('when')}"
old_palette = {e['command'] for e in before_json['contributes']['menus']['commandPalette']}
new_palette_ids = {e['command'] for e in after['contributes']['menus']['commandPalette']}
assert old_palette <= new_palette_ids, 'a command that had a palette rule lost it'
print('palette rewritten;', len(commands), 'commands,', len(SUBMENUS), 'submenus')
