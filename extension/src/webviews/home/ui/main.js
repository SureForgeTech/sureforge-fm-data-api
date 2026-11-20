// The FileMaker home: a button runs the command it names, and the filter narrows the entries.
(function () {
  const vscode = acquireVsCodeApi();
  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button[data-command]') : null;
    if (!button) return;
    const command = button.getAttribute('data-command');
    if (!command) return;
    vscode.postMessage({ type: 'run', command });
  });

  // The filter narrows the entries to the ones that mention what was typed. It only hides entries
  // on the page: it never runs a command and it never asks the extension for anything.
  const filter = document.getElementById('fm-home-filter-input');
  if (!(filter instanceof HTMLInputElement)) return;
  const noMatches = document.getElementById('fm-home-no-matches');
  const advanced = document.querySelector('.fm-home details');
  const groups = Array.from(document.querySelectorAll('.fm-home section')).map((section) => ({
    section,
    entries: Array.from(section.querySelectorAll('.entry')),
    inAdvanced: advanced ? advanced.contains(section) : false
  }));

  // The state Advanced Tools was in before the reader started filtering.
  let advancedWasOpen = advanced ? advanced.open : false;
  let filtering = false;

  const apply = () => {
    const wanted = filter.value.trim().toLowerCase();
    let shown = 0;
    let shownInAdvanced = 0;
    for (const group of groups) {
      let inSection = 0;
      for (const entry of group.entries) {
        // The label and the description are searched as separate words, so a query cannot match
        // across the boundary between them.
        const text = Array.from(entry.children)
          .map((child) => child.textContent || '')
          .join(' ')
          .toLowerCase();
        const matches = wanted === '' || text.includes(wanted);
        entry.classList.toggle('fm-hidden', !matches);
        if (!matches) continue;
        inSection += 1;
        shown += 1;
        if (group.inAdvanced) shownInAdvanced += 1;
      }
      group.section.classList.toggle('fm-hidden', inSection === 0);
    }
    if (noMatches) noMatches.classList.toggle('fm-hidden', shown > 0);
    // A match inside Advanced Tools is only reachable when that part of the page is open. When the
    // query is cleared the page goes back the way the reader had it.
    if (advanced) {
      if (wanted === '') {
        if (filtering) advanced.open = advancedWasOpen;
        filtering = false;
      } else {
        if (!filtering) advancedWasOpen = advanced.open;
        advanced.open = shownInAdvanced > 0;
        filtering = true;
      }
    }
  };

  filter.addEventListener('input', apply);
})();
