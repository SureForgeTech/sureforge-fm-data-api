_Release notes prepared 2026-11-13._

Version 1.9.0 is mainly a security and safety release. Batch updates now follow the same write rules as every other change, saved passwords are protected while old saved addresses are cleaned up, the FM Web preview is locked down so only you can use it, and the extension handles hostile or oversized answers from a server safely. It also adds related portal rows to Create Record. Read [UPGRADE.md](https://github.com/SureForgeTech/filemaker-data-api-for-vs-code/blob/main/extension/UPGRADE.md), “Upgrading from 1.8.0 to 1.9.0”.

**New**

- Create Record can add new portal rows alongside a parent record on direct connections. Existing related rows are not edited, and proxy connections say that portal-row creation is unavailable. This was tested against the mock server; compatibility with a real server is not yet confirmed.

**Changes you may notice**

- Batch update follows the same write rules as other changes. It is refused when record editing is switched off by your settings or your administrator, it checks those rules and offline mode again before every row and stops with a plain reason if they change, and it refuses files with more rows than `filemaker.batch.maxRecords`. Dry runs still work because they write nothing. Dry runs still require `filemaker.features.batch.enabled` and a trusted folder. The confirmation names the layout, the profile and the server, with hidden characters shown.
- Trust Server Certificate and Set AI Access now respect locked profiles and the write rules, so like other changes they are unavailable in offline mode.
- Saved server addresses that still contain a user name or password are cleaned up. The password moves to secure storage first, and the address changes only after that worked; if secure storage is unavailable the old entry is kept and nothing is lost. Test Connection keeps its temporary password in memory only, and removing a profile attempts to close its server session first.
- Connect warns once per profile in each session when a remote server is reached over plain `http://`. Log files mask more kinds of tokens.
- In a folder you have not trusted, a project can no longer set enterprise rules with `.vscode/filemaker.config.json`, an offline schema cache is not used, and environment and layout comparison are unavailable until you trust the folder. A cache is also checked against its stored checksum before it is used.
- Three settings that a downloaded project could otherwise set can now only be set in your User settings: the snippet authorization default, the schema hash algorithm and the bridge request limits.
- Write AI Context works without turning on the AI tools setting. It still respects `filemaker.features.ai.enabled`, the enterprise AI policy and offline mode.
- Every response from a server is limited to 64 MiB. Only record GET and find reads (including proxy `getRecord`/`findRecords`) renew their deadline after each 64 KiB; stalled or trickling reads stop. Other requests (scripts, writes, layout metadata, sign-in, sign-out and discovery) have the fixed base deadline from `filemaker.requestTimeoutMs` (default 15000 ms, maximum 120000 ms (2 minutes)). An upload gets a deadline that grows with the size of the file (at least the request timeout, at most 30 minutes). The 30 minute transfer ceiling cannot be raised from settings. Stalled transfers stop.
- Error messages are shown on one line, shortened, with injected links broken, while bracketed codes and file paths stay readable. Copied error reports keep server text inside code blocks.
- Record Editor and Record Viewer open container links only when they point at the connection's own server.
- Suggested file names in save dialogs keep their case and extension with unsafe characters removed; exported data keeps the exact layout and query names.
- Offline metadata cache folders now ignore their own contents in Git. The `.gitignore` itself stays visible and can be committed. Schema snapshots are not ignored, so they can still be committed.
- Environment comparison reports and generated client README files show layout and profile names safely, so a hostile name cannot add links, images or table rows.
- AI approval dialogs, Layout Mode and preview script confirmations, and plugin consent show hidden characters as visible escapes, and refuse values too long to show in full.

**FM Web preview**

- Only one script prompt can be open at a time, with a cooldown of 5 seconds after it closes.
- On Windows, stopping uses `taskkill` with a 5 second limit; restarting shows a warning if stopping the previous preview fails.

- Only you can use the preview. It listens on `127.0.0.1:3000` only, the connection to FileMaker stays on the preview server behind a single-use launch link, and requests without the matching private cookie are refused. Next.js development endpoints, such as live reload, are outside that check.
- VS Code asks before the preview installs or starts, and before any script runs from a layout or a preview button, showing the exact script, its escaped parameter and the connection host. Cancelling stops the preview and removes its saved address and token.
- The preview runs from a clean private copy with install scripts turned off. Your npm configuration and any edited or added runtime files are left alone and listed as ignored. Only the explicit generation command deletes files, and only after you confirm them by name.
- On Windows the preview finds Node.js and npm, stops everything it started when you cancel, removes its private files, and no longer flashes a console window. Proxy and extra certificate settings pass through, so installs work on company networks.
- Old marked temporary preview folders are removed only when older than one day and their owning extension-host process no longer exists (checked by process id). A layout with an edited or linked generated file is skipped with a warning instead of stopping the preview.
- Layout link actions open only `http` and `https` addresses, and script names and parameters reach the preview connection exactly as written.

**Fixes**

- Batch exports keep the configured record cap even when the server returns too many rows, and batch CSV export keeps Unicode line and paragraph separators without failing on newer VS Code versions.
- Crafted portal notes, numbers, certificate names and AI error text can no longer freeze the extension.
- Generated app updates recognize the current dependency lists while keeping your edits.
- Offline schema caches keep working after the hash algorithm setting changes, and altered content is still rejected.

**Behind the scenes**

- The mock Data API answers the calls that Test Connection makes, so Test Connection passes all three steps against the mock, and a new first-run test (test the connection, save the profile, connect, run the first query) runs against it.
- Publishing and development tools are patched for a glob matcher advisory, and release packaging installs without running install scripts.
