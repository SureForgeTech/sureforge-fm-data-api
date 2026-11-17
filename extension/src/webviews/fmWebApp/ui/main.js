(() => {
  const vscode = acquireVsCodeApi();
  const model = JSON.parse(document.getElementById('app-model').textContent);
  const form = document.getElementById('app-form');
  const status = document.getElementById('status');
  let busy = false;
  function updateFields() {
    document.querySelectorAll('.app-field').forEach(row => {
      const included = row.querySelector('.include').checked;
      row.querySelectorAll('input:not(.include), select, textarea').forEach(control => { control.disabled = !included; });
    });
  }
  updateFields();
  form.addEventListener('change', updateFields);
  function markDirty() { if (!busy) { status.className = '';status.textContent = 'Unsaved changes'; } }
  form.addEventListener('input', markDirty);
  form.addEventListener('change', markDirty);
  function send(action) {
    if (busy) return;
    const rows = Array.from(document.querySelectorAll('.app-field'));
    const fields = rows.filter(row => row.querySelector('.include').checked).map(row => {
      const original = model.fields[Number(row.dataset.field)];
      const kind = row.querySelector('.kind').value;
      return { ...original, label: row.querySelector('.field-label').value,
        kind, helpText: row.querySelector('.help').value, required: row.querySelector('.required').checked,
        maxLength: Number(row.querySelector('.max-length').value),
        options: kind === 'select' ? row.querySelector('.choices').value.split(/\r?\n/).filter(value => value !== '') : undefined };
    });
    if (!form.reportValidity()) return;
    if (!fields.length || fields.length > 100) { status.textContent = 'Choose between 1 and 100 fields.';status.className = 'error';status.focus();return; }
    busy = true;form.querySelectorAll('input, select, textarea, button').forEach(control => { control.disabled = true; });
    status.className = '';status.textContent = 'Saving app…';
    vscode.postMessage({ action, definition: { ...model.definition, title: document.getElementById('title').value,
      description: document.getElementById('description').value, submitLabel: document.getElementById('submit-label').value,
      successMessage: document.getElementById('success-message').value,
      branding: { organizationName: document.getElementById('organization').value, accentColor: document.getElementById('accent').value }, fields } });
  }
  form.addEventListener('submit', event => { event.preventDefault();send('save'); });
  form.addEventListener('click', event => {
    const button = event.target.closest('button');if (!button || busy) return;
    if (button.dataset.action === 'source') { vscode.postMessage({ action: 'source' });return; }
    if (button.dataset.action) send(button.dataset.action);
    if (button.dataset.move) {
      const row = button.closest('.app-field');
      if (button.dataset.move === 'up' && row.previousElementSibling) { row.parentNode.insertBefore(row, row.previousElementSibling);markDirty(); }
      if (button.dataset.move === 'down' && row.nextElementSibling) { row.parentNode.insertBefore(row.nextElementSibling, row);markDirty(); }
    }
  });
  window.addEventListener('message', event => {
    if (!event.data || !['saved', 'error'].includes(event.data.type)) return;
    busy = false;form.querySelectorAll('input, select, textarea, button').forEach(control => { control.disabled = false; });updateFields();
    status.textContent = event.data.message;status.className = event.data.type === 'error' ? 'error' : '';
    if (event.data.type === 'error') status.focus();
  });
})();
