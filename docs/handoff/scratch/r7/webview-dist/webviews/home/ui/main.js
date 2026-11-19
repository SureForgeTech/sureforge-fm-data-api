// The FileMaker home: a button runs the command it names.
(function () {
  const vscode = acquireVsCodeApi();
  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button[data-command]') : null;
    if (!button) return;
    const command = button.getAttribute('data-command');
    if (!command) return;
    vscode.postMessage({ type: 'run', command });
  });
})();
