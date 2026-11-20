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
        description: 'Create or resume an editable starter app, with mapping, layout and preview actions.',
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

/** Every command the home can run. */
export const FILEMAKER_HOME_COMMANDS: string[] = [
  ...FILEMAKER_HOME_SECTIONS.flatMap((section) => section.entries.map((entry) => entry.command)),
  ...FILEMAKER_ADVANCED_SECTIONS.flatMap((section) => section.entries.map((entry) => entry.command))
];
