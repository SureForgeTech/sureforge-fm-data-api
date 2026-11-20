/** The FileMaker home: the journeys a first-time user needs, and the tools for everything else. */

export interface HomeEntry {
  /** Stable id, unique across the catalogue. */
  id: string;
  label: string;
  description: string;
  /** The contributed command this entry runs. */
  command: string;
}

export interface HomeSection {
  id: string;
  title: string;
  description: string;
  entries: HomeEntry[];
}

/** The four journeys the home leads to. */
export const FILEMAKER_HOME_SECTIONS: HomeSection[] = [
  {
    id: 'build',
    title: 'Build a Web App',
    description: 'Make a web form that writes to FileMaker, without editing code or JSON.',
    entries: [
      {
        id: 'create-fm-web-app',
        label: 'Create FM Web App',
        description: 'Choose a starter, pick sample data or your own layout, then preview the form.',
        command: 'filemakerDataApiTools.createFmWebApp'
      },
      {
        id: 'build-portal',
        label: 'Build a Portal',
        description: 'Create or resume an editable registration form for an existing portal.',
        command: 'filemakerDataApiTools.buildPortal'
      }
    ]
  },
  {
    id: 'connect',
    title: 'Connect and Test',
    description: 'Reach your FileMaker server and find out why a connection does not work.',
    entries: [
      {
        id: 'add-connection-profile',
        label: 'Add Connection Profile',
        description: 'Save a server address and let the extension test it before you commit.',
        command: 'filemakerDataApiTools.addConnectionProfile'
      },
      {
        id: 'connect',
        label: 'Connect',
        description: 'Open a session against the Data API and verify it.',
        command: 'filemakerDataApiTools.connect'
      },
      {
        id: 'diagnose-connection',
        label: 'Diagnose Connection',
        description: 'Check a server, a certificate and the network path, and read what to fix.',
        command: 'filemakerDataApiTools.diagnoseConnection'
      },
      {
        id: 'test-my-server',
        label: 'Test My Server',
        description: 'Read a record and open a report you can share.',
        command: 'filemakerDataApiTools.testMyServer'
      }
    ]
  },
  {
    id: 'browse',
    title: 'Browse Data',
    description: 'Find, read and change records in the database you connected to.',
    entries: [
      {
        id: 'open-query-builder',
        label: 'Open Query Builder',
        description: 'Build a find with a form and open the result in a table.',
        command: 'filemakerDataApiTools.openQueryBuilder'
      },
      {
        id: 'open-record-viewer',
        label: 'Open Record Viewer',
        description: 'Read the records of a layout.',
        command: 'filemakerDataApiTools.openRecordViewer'
      },
      {
        id: 'open-record-editor',
        label: 'Open Record Editor',
        description: 'Edit, create and delete records.',
        command: 'filemakerDataApiTools.openRecordEditor'
      },
      {
        id: 'open-script-runner',
        label: 'Open Script Runner',
        description: 'Run a FileMaker script and read its result.',
        command: 'filemakerDataApiTools.openScriptRunner'
      }
    ]
  },
  {
    id: 'help',
    title: 'Help',
    description: 'Guided setup, the manual, and what the extension is doing.',
    entries: [
      {
        id: 'open-welcome-walkthrough',
        label: 'Open Getting Started Walkthrough',
        description: 'The guided steps from a fresh install to your first query.',
        command: 'filemakerDataApiTools.openWelcomeWalkthrough'
      },
      {
        id: 'open-user-guide',
        label: 'Open User Guide',
        description: 'The full manual for every command and setting.',
        command: 'filemakerDataApiTools.openUserGuide'
      },
      {
        id: 'about',
        label: 'About / Show Version',
        description: 'The installed extension, its build and your editor.',
        command: 'filemakerDataApiTools.about'
      }
    ]
  }
];

/** Setup, diagnostics, generation and legacy work, kept out of the everyday palette. */
export const FILEMAKER_ADVANCED_SECTIONS: HomeSection[] = [
  {
    id: 'advanced-setup',
    title: 'Setup',
    description: 'Project setup and the settings that shape what the extension may do.',
    entries: [
      {
        id: 'initialize-fm-web-project',
        label: 'Initialize FM Web Project',
        description: 'Create the .fmweb folder in the workspace.',
        command: 'filemakerDataApiTools.initializeFmWebProject'
      },
      {
        id: 'sync-fm-web-metadata',
        label: 'Sync FM Web Project Metadata',
        description: 'Refresh the saved layout metadata of the project.',
        command: 'filemakerDataApiTools.syncFmWebMetadata'
      },
      {
        id: 'show-effective-settings',
        label: 'Show Effective Settings',
        description: 'The settings in effect and where each value comes from.',
        command: 'filemakerDataApiTools.showEffectiveSettings'
      },
      {
        id: 'show-diagnostics',
        label: 'Show Diagnostics',
        description: 'A redacted report of the extension, its settings and its connections.',
        command: 'filemakerDataApiTools.showDiagnostics'
      }
    ]
  },
  {
    id: 'advanced-generation',
    title: 'Code generation',
    description: 'Turn layout metadata into code for your own project.',
    entries: [
      {
        id: 'generate-types-for-layout',
        label: 'Generate Types for Layout',
        description: 'TypeScript types for one layout.',
        command: 'filemakerDataApiTools.generateTypesForLayout'
      },
      {
        id: 'generate-types-for-all-layouts',
        label: 'Generate Types for All Layouts',
        description: 'TypeScript types for every layout.',
        command: 'filemakerDataApiTools.generateTypesForAllLayouts'
      },
      {
        id: 'generate-snippets-for-layout',
        label: 'Generate Snippets for Layout',
        description: 'Editor snippets for one layout.',
        command: 'filemakerDataApiTools.generateSnippetsForLayout'
      },
      {
        id: 'generate-typescript-client',
        label: 'Generate TypeScript Client',
        description: 'A typed Data API client for your project.',
        command: 'filemakerDataApiTools.generateTypeScriptClient'
      },
      {
        id: 'open-generated-types-folder',
        label: 'Open Generated Types Folder',
        description: 'Reveal the folder the generated files are written to.',
        command: 'filemakerDataApiTools.openGeneratedTypesFolder'
      },
      {
        id: 'write-ai-context',
        label: 'Write AI Context',
        description: 'Write the context file an AI assistant reads.',
        command: 'filemakerDataApiTools.writeAiContext'
      }
    ]
  },
  {
    id: 'advanced-data',
    title: 'Data and schema',
    description: 'Schema snapshots, saved queries, batch work and the request history.',
    entries: [
      {
        id: 'capture-schema-snapshot',
        label: 'Capture Schema Snapshot',
        description: 'Record the schema of the database as it is now.',
        command: 'filemakerDataApiTools.captureSchemaSnapshot'
      },
      {
        id: 'diff-schema-snapshots',
        label: 'Diff Schema Snapshots',
        description: 'Compare two recorded schemas.',
        command: 'filemakerDataApiTools.diffSchemaSnapshots'
      },
      {
        id: 'manage-saved-queries',
        label: 'Manage Saved Queries',
        description: 'Rename, copy and delete saved queries.',
        command: 'filemakerDataApiTools.manageSavedQueries'
      },
      {
        id: 'batch-export-find',
        label: 'Batch Export (Find)',
        description: 'Export the result of a find.',
        command: 'filemakerDataApiTools.batchExportFind'
      },
      {
        id: 'batch-update-from-file',
        label: 'Batch Update from CSV/JSON',
        description: 'Apply many changes from a file.',
        command: 'filemakerDataApiTools.batchUpdateFromFile'
      },
      {
        id: 'show-request-history',
        label: 'Show Request History',
        description: 'The requests the extension made, with their answers.',
        command: 'filemakerDataApiTools.showRequestHistory'
      }
    ]
  },
  {
    id: 'advanced-platform',
    title: 'Platform and enterprise',
    description: 'Plugins, offline mode, environment sets and the AI host tools.',
    entries: [
      {
        id: 'toggle-offline-mode',
        label: 'Toggle Offline Mode',
        description: 'Turn the offline policy on or off.',
        command: 'filemakerDataApiTools.toggleOfflineMode'
      },
      {
        id: 'list-active-plugins',
        label: 'List Active Plugins',
        description: 'The plugins this extension loaded.',
        command: 'filemakerDataApiTools.listActivePlugins'
      },
      {
        id: 'compare-environments',
        label: 'Compare Environments',
        description: 'Compare the schemas of two environments.',
        command: 'filemakerDataApiTools.compareEnvironments'
      },
      {
        id: 'copy-ai-mcp-config',
        label: 'Copy MCP Config for Claude Code / Cursor',
        description: 'The configuration an external AI host needs to reach this extension.',
        command: 'filemakerDataApiTools.copyAiMcpConfig'
      },
      {
        id: 'show-ai-activity',
        label: 'Show AI Activity',
        description: 'The AI tool calls this session made.',
        command: 'filemakerDataApiTools.showAiActivity'
      }
    ]
  }
];


/** The commands the everyday journeys do not cover, so the home is a complete launcher. */
export const FILEMAKER_TOOL_SECTIONS: HomeSection[] = [
  {
    id: 'connections',
    title: 'Connections',
    description: 'The tools for this part of the work.',
    entries: [
      {
        id: 'copy-connection-diagnosis',
        label: 'Copy Connection Diagnosis for Bug Report',
        description: 'Copies the latest connection diagnosis, with a choice to hide the server address.',
        command: 'filemakerDataApiTools.copyConnectionDiagnosis'
      },
      {
        id: 'disconnect',
        label: 'Disconnect',
        description: 'Ends a profile\'s session and clears it as active if selected.',
        command: 'filemakerDataApiTools.disconnect'
      },
      {
        id: 'edit-connection-profile',
        label: 'Edit Connection Profile',
        description: 'Opens a saved profile in the connection wizard, where you can trust or forget a certificate without changing a VS Code setting.',
        command: 'filemakerDataApiTools.editConnectionProfile'
      },
      {
        id: 'remove-connection-profile',
        label: 'Remove Connection Profile',
        description: 'Removes a profile, its saved queries and secrets after confirmation.',
        command: 'filemakerDataApiTools.removeConnectionProfile'
      },
      {
        id: 'select-active-profile',
        label: 'Select Active Profile',
        description: 'Selects the active profile and, in a trusted folder, saves it to the FM Web project (creating the project if needed).',
        command: 'filemakerDataApiTools.selectActiveProfile'
      },
      {
        id: 'open-connection-menu',
        label: 'Show Connection Menu',
        description: 'Offers connection actions from the status bar menu.',
        command: 'filemakerDataApiTools.openConnectionMenu'
      }
    ]
  },
  {
    id: 'records-and-queries',
    title: 'Records and queries',
    description: 'The tools for this part of the work.',
    entries: [
      {
        id: 'cancel-job',
        label: 'Cancel Job',
        description: 'Stops sending new work for a running job, waits for pending requests and keeps partial results.',
        command: 'filemakerDataApiTools.cancelJob'
      },
      {
        id: 'copy-request-as-code',
        label: 'Copy Request as Code…',
        description: 'Copies a chosen request as curl, fetch, HTTP, Postman or TypeScript.',
        command: 'filemakerDataApiTools.copyRequestAsCode'
      },
      {
        id: 'create-record',
        label: 'Create Record',
        description: 'Opens the editor in create mode, loads the layout field list, and can add new rows to portals on direct connections.',
        command: 'filemakerDataApiTools.createRecord'
      },
      {
        id: 'delete-record',
        label: 'Delete Record',
        description: 'Deletes a chosen record after confirmation.',
        command: 'filemakerDataApiTools.deleteRecord'
      },
      {
        id: 'delete-saved-query',
        label: 'Delete Saved Query',
        description: 'Removes a selected saved query after confirmation.',
        command: 'filemakerDataApiTools.deleteSavedQuery'
      },
      {
        id: 'edit-record-by-id',
        label: 'Edit Record by ID',
        description: 'Prompts for a record ID and opens the record editor.',
        command: 'filemakerDataApiTools.editRecordById'
      },
      {
        id: 'export-saved-queries',
        label: 'Export Saved Queries (JSON)',
        description: 'Saves the saved-query collection to a JSON file.',
        command: 'filemakerDataApiTools.exportSavedQueries'
      },
      {
        id: 'get-record-by-id',
        label: 'Get Record by ID',
        description: 'Reads one record and opens it as JSON.',
        command: 'filemakerDataApiTools.getRecordById'
      },
      {
        id: 'import-saved-queries',
        label: 'Import Saved Queries (JSON)',
        description: 'Imports saved queries from a chosen JSON file.',
        command: 'filemakerDataApiTools.importSavedQueries'
      },
      {
        id: 'list-layouts',
        label: 'List Layouts',
        description: 'Opens a JSON list of the profile\'s layouts.',
        command: 'filemakerDataApiTools.listLayouts'
      },
      {
        id: 'open-saved-query',
        label: 'Open Saved Query',
        description: 'Loads a saved query into Query Builder.',
        command: 'filemakerDataApiTools.openSavedQuery'
      },
      {
        id: 'run-find-json',
        label: 'Run Find (JSON)',
        description: 'Prompts for find, sort and paging options and opens the result as JSON.',
        command: 'filemakerDataApiTools.runFindJson'
      },
      {
        id: 'run-saved-query',
        label: 'Run Saved Query',
        description: 'Runs a saved find and opens its result as JSON.',
        command: 'filemakerDataApiTools.runSavedQuery'
      },
      {
        id: 'save-current-query',
        label: 'Save Current Query',
        description: 'Asks the open Query Builder to save its current query.',
        command: 'filemakerDataApiTools.saveCurrentQuery'
      },
      {
        id: 'show-jobs',
        label: 'Show Jobs',
        description: 'Lists active and recent jobs once, shows counts and record details, and offers cancellation or Copy failures. After a restart, each saved list keeps at most 1,000 entries and marks any shortened list.',
        command: 'filemakerDataApiTools.showJobs'
      },
      {
        id: 'upload-container',
        label: 'Upload to Container',
        description: 'Uploads a chosen file to a record\'s container field.',
        command: 'filemakerDataApiTools.uploadContainer'
      }
    ]
  },
  {
    id: 'schema-and-layouts',
    title: 'Schema and layouts',
    description: 'The tools for this part of the work.',
    entries: [
      {
        id: 'diff-against-latest-snapshot',
        label: 'Diff Against Latest Snapshot',
        description: 'Compares current layout fields with its latest saved snapshot.',
        command: 'filemakerDataApiTools.diffAgainstLatestSnapshot'
      },
      {
        id: 'open-layout-metadata',
        label: 'Open Layout Metadata',
        description: 'Opens layout metadata, field count and cache status as JSON.',
        command: 'filemakerDataApiTools.openLayoutMetadata'
      },
      {
        id: 'open-schema-snapshot-json',
        label: 'Open Schema Snapshot JSON',
        description: 'Opens a saved schema snapshot as JSON.',
        command: 'filemakerDataApiTools.openSchemaSnapshotJson'
      },
      {
        id: 'refresh-explorer',
        label: 'Refresh Connections',
        description: 'Refreshes the FileMaker Connections tree.',
        command: 'filemakerDataApiTools.refreshExplorer'
      },
      {
        id: 'refresh-layout-inspector',
        label: 'Refresh Layout Inspector',
        description: 'Reloads the currently inspected layout.',
        command: 'filemakerDataApiTools.refreshLayoutInspector'
      },
      {
        id: 'refresh-schema-cache',
        label: 'Refresh Schema Cache',
        description: 'Clears schema and client layout caches and refreshes Connections.',
        command: 'filemakerDataApiTools.refreshSchemaCache'
      },
      {
        id: 'select-layout-for-inspector',
        label: 'Select Layout for Inspector',
        description: 'Selects a layout and focuses the Layout Inspector.',
        command: 'filemakerDataApiTools.selectLayoutForInspector'
      }
    ]
  },
  {
    id: 'fm-web-projects',
    title: 'FM Web projects',
    description: 'The tools for this part of the work.',
    entries: [
      {
        id: 'generate-fm-web-layout-page',
        label: 'Generate FM Web Layout Page',
        description: 'Writes a saved layout for the preview, including which fields can be edited.',
        command: 'filemakerDataApiTools.generateFmWebLayoutPage'
      },
      {
        id: 'generate-fm-web-next-app',
        label: 'Generate FM Web Next.js App',
        description: 'Generates or updates the local preview app and its shared field controls.',
        command: 'filemakerDataApiTools.generateFmWebNextApp'
      },
      {
        id: 'open-layout-mode',
        label: 'Open FM Web Layout Mode',
        description: 'Opens the visual editor for saved FM Web layouts.',
        command: 'filemakerDataApiTools.openLayoutMode'
      },
      {
        id: 'start-fm-web-preview-server',
        label: 'Start FM Web Preview Server',
        description: 'Asks before installing and starting a clean private preview, then opens a one-time browser link.',
        command: 'filemakerDataApiTools.startFmWebPreviewServer'
      }
    ]
  },
  {
    id: 'environments',
    title: 'Environments',
    description: 'The tools for this part of the work.',
    entries: [
      {
        id: 'create-environment-set',
        label: 'Create Environment Set',
        description: 'Groups at least two profiles for comparison.',
        command: 'filemakerDataApiTools.createEnvironmentSet'
      },
      {
        id: 'diff-layout-across-environments',
        label: 'Diff Layout Across Environments',
        description: 'Shows field differences for one layout across an environment set.',
        command: 'filemakerDataApiTools.diffLayoutAcrossEnvironments'
      },
      {
        id: 'export-environment-comparison-report',
        label: 'Export Environment Comparison Report',
        description: 'Saves an environment comparison as JSON or Markdown.',
        command: 'filemakerDataApiTools.exportEnvironmentComparisonReport'
      },
      {
        id: 'open-environment-set-json',
        label: 'Open Environment Set JSON',
        description: 'Opens a selected environment set\'s definition as JSON.',
        command: 'filemakerDataApiTools.openEnvironmentSetJson'
      }
    ]
  },
  {
    id: 'ai-and-external-tools',
    title: 'AI and external tools',
    description: 'The tools for this part of the work.',
    entries: [
      {
        id: 'set-ai-access',
        label: 'Set AI Access for Connection',
        description: 'Chooses no AI access, read access or write access for a profile.',
        command: 'filemakerDataApiTools.setAiAccess'
      },
      {
        id: 'new-ai-session',
        label: 'Start New AI Session',
        description: 'Resets AI quotas, write counters and layout approvals after confirmation.',
        command: 'filemakerDataApiTools.newAiSession'
      },
      {
        id: 'toggle-ai-server',
        label: 'Start/Stop AI Server for External Tools',
        description: 'Starts or stops this window\'s local MCP server and remembers that choice.',
        command: 'filemakerDataApiTools.toggleAiServer'
      },
      {
        id: 'toggle-ai-kill-switch',
        label: 'Switch AI Tools Off or On',
        description: 'Stops AI tools immediately or restores them after confirmation.',
        command: 'filemakerDataApiTools.toggleAiKillSwitch'
      }
    ]
  },
  {
    id: 'platform-and-diagnostics',
    title: 'Platform and diagnostics',
    description: 'The tools for this part of the work.',
    entries: [
      {
        id: 'copy-field-name',
        label: 'Copy Field Name',
        description: 'Copies the exact FileMaker name of a field in the sidebar to the clipboard.',
        command: 'filemakerDataApiTools.copyFieldName'
      },
      {
        id: 'copy-layout-name',
        label: 'Copy Layout Name',
        description: 'Copies the exact FileMaker name of a layout in the sidebar to the clipboard.',
        command: 'filemakerDataApiTools.copyLayoutName'
      },
      {
        id: 'open-diagnostics-dashboard',
        label: 'Open Diagnostics Dashboard',
        description: 'Opens request metrics and recent request history in a dashboard.',
        command: 'filemakerDataApiTools.openDiagnosticsDashboard'
      },
      {
        id: 'refresh-offline-cache',
        label: 'Refresh Offline Metadata Cache',
        description: 'Reads layouts and metadata into the offline cache.',
        command: 'filemakerDataApiTools.refreshOfflineCache'
      },
      {
        id: 'reload-plugins',
        label: 'Reload Plugins',
        description: 'Reloads configured workspace plugins.',
        command: 'filemakerDataApiTools.reloadPlugins'
      },
      {
        id: 'show-circuit-breaker-status',
        label: 'Show Circuit Breaker Status',
        description: 'Opens a Markdown report of connection circuit breakers.',
        command: 'filemakerDataApiTools.showCircuitBreakerStatus'
      },
      {
        id: 'start-here',
        label: 'Start Here',
        description: 'Opens the FileMaker home: Build a Web App, Connect and Test, Browse Data, Help, and the advanced tools.',
        command: 'filemakerDataApiTools.startHere'
      }
    ]
  }
];

/** Every command the home can run. */
export const FILEMAKER_HOME_COMMANDS: string[] = [
  ...FILEMAKER_HOME_SECTIONS.flatMap((section) => section.entries.map((entry) => entry.command)),
  ...FILEMAKER_ADVANCED_SECTIONS.flatMap((section) => section.entries.map((entry) => entry.command)),
  ...FILEMAKER_TOOL_SECTIONS.flatMap((section) => section.entries.map((entry) => entry.command))
];
