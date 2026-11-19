#!/usr/bin/env python3
"""Build the FileMaker command palette submenu mapping for extension/package.json.

Every contributed command is placed in exactly one submenu. Command ids, titles,
keybindings and the view menus are untouched; only the command palette gains a
submenu property.
"""
import json
import pathlib

MANIFEST = pathlib.Path('/workspace/sureforge-fm-data-api-wt-home/extension/package.json')
d = json.loads(MANIFEST.read_text())
contributes = d['contributes']
commands = [c['command'] for c in contributes['commands']]
palette = {e['command']: e.get('when') for e in contributes['menus']['commandPalette']}

SUBMENUS = {
    'filemaker.buildWebApp': 'FileMaker: Build a Web App',
    'filemaker.connectAndTest': 'FileMaker: Connect and Test',
    'filemaker.browseData': 'FileMaker: Browse Data',
    'filemaker.help': 'FileMaker: Help',
    'filemaker.advancedTools': 'FileMaker: Advanced Tools'
}

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
extra = [c for c in assigned if c not in commands]
dupes = sorted({c for c in assigned if assigned.count(c) > 1})
print('commands:', len(commands), 'assigned:', len(assigned))
print('missing:', missing)
print('unknown:', extra)
print('duplicates:', dupes)
if missing or extra or dupes:
    raise SystemExit('mapping is not a partition of the contributed commands')

new_palette = []
for command in commands:
    entry = {'command': command}
    when = palette.get(command)
    if when is not None:
        entry['when'] = when
    for submenu, members in MAPPING.items():
        if command in members:
            entry['submenu'] = submenu
            break
    new_palette.append(entry)

contributes['submenus'] = [{'id': sid, 'label': label} for sid, label in SUBMENUS.items()]
contributes['menus']['commandPalette'] = new_palette

MANIFEST.write_text(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
print('written', MANIFEST)
for sid, label in SUBMENUS.items():
    print(f'  {label}: {len(MAPPING[sid])} commands')
