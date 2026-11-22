// The facts the desktop journeys assert about the product, in one place.
//
// The desktop suite needs a packaged extension and a display, so it cannot run in a pull request.
// A journey's expectation therefore has to be held here, where a unit test can hold it against
// the code: when the product moves a fact, the unit test fails here rather than the journey
// failing on a machine nobody looks at.

/**
 * The walkthrough's steps, in the order the walkthrough offers them.
 *
 * The first-run journey checks that each of these is on the walkthrough page. The list is held
 * here so a unit test can compare it with the manifest, which is where the walkthrough is
 * declared.
 */
export const WALKTHROUGH_STEPS = [
  'Create an FM Web app',
  'Add a connection profile',
  'Connect and verify',
  'Run your first query',
  'Inspect a layout',
  'Generate typed code'
];

/**
 * The FileMaker field types a field row can show.
 *
 * The Explorer shows a field row as its name and then the field's type, the kind when the kind is
 * not the type's own name, and the repetition count: "text • calculation • x1". A row is a field
 * row when the type follows the name.
 */
const FIELD_TYPES = ['text', 'number', 'date', 'timeStamp', 'time', 'container'];

/** Is this tree row a field row, with the type the Explorer shows? */
export function isFieldRow(row) {
  return new RegExp(`(?:${FIELD_TYPES.join('|')})\\s*[·•]`, 'i').test(String(row));
}

/** The Explorer names the list it could not load. */
export const EXPLORER_FAILURE_LABEL = 'Failed to load layouts';

/**
 * The reason an Explorer failure row carries.
 *
 * The row names what went wrong in one line and keeps the full cause in its tooltip, so the
 * reason is what is left of the row once the label is taken off it.
 */
export function explorerFailureReason(row) {
  return String(row).replace(new RegExp(EXPLORER_FAILURE_LABEL, 'i'), '').trim();
}

/**
 * What a reason has to look like to name the failure.
 *
 * The Explorer's short reason names the kind of failure and, when the server answered, its
 * status: "Server problem (HTTP 200)". A reason that names none of that is the generic advice,
 * which says nothing about what went wrong.
 */
export const EXPLORER_FAILURE_REASON = /problem|timed out|cancelled|code \d+|HTTP \d+/i;

/**
 * Read the tooltip of a tree row, which is where the Explorer keeps the full cause of a failure.
 *
 * The row is hovered and the hover widget is read. When no tooltip appears, the empty string is
 * returned and the caller decides what that means: a missing tooltip is not a failure of the
 * product.
 */
export async function readTreeTooltip(s, rowText) {
  const row = s.page.locator('.pane-body .monaco-list-row').filter({ hasText: rowText }).first();
  if (!(await row.count())) return '';
  await row.hover().catch(() => {});
  const widget = s.page.locator('.monaco-hover-content, .monaco-hover, .hover-widget').first();
  await widget.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  const text = (await widget.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  return text;
}

/**
 * The Script Runner asks the server for the script list when it opens. That request belongs to
 * the panel, not to a script run, so a check of "what did the run send" leaves it out.
 */
export const SCRIPT_LIST_REQUEST = /\/scripts(\?|$|\s)/;

/** Is this logged request one the script run itself sent? */
export function isScriptRunRequest(line) {
  return !/\/sessions/.test(line) && !SCRIPT_LIST_REQUEST.test(line);
}
