/**
 * How the server will read and write dates, in words.
 *
 * The setting `filemaker.dateFormats` chooses between the server's own default, the locale of the
 * file the dates came from, and ISO 8601. The extension sends the option only when the developer
 * asked for something other than the server's default, so a server that does not know it is never
 * asked about it.
 */
export function dateFormatLabel(value: number): string {
  if (value === 1) return "the file's locale";
  if (value === 2) return 'ISO 8601';
  return "the server's own default (US order)";
}
