import { describe, expect, it } from 'vitest';

import {
  BatchUpdateFormatRefusal,
  parseBatchUpdateInput
} from '../../src/services/batchService';
import { dateFormatLabel } from '../../src/utils/dateFormat';

describe('the shapes a batch update file can be in', () => {
  it('reads a JSONL file, one record per line, when the developer says so', () => {
    const jsonl = [
      JSON.stringify({ recordId: '1', modId: '0', fieldData: { Name: 'Ada', Created: '02/10/2026' } }),
      JSON.stringify({ recordId: '2', fieldData: { Name: 'Grace', Created: '03/10/2026' } })
    ].join('\n');

    const entries = parseBatchUpdateInput(jsonl, 'jsonl');

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      recordId: '1',
      modId: '0',
      fieldData: { Name: 'Ada', Created: '02/10/2026' }
    });
    expect(entries[1]!.recordId).toBe('2');
  });

  it('reads a semicolon-delimited CSV when the developer says so', () => {
    const csv = 'recordId;Name;Created\n1;Ada;"02/10/2026"\n';

    const entries = parseBatchUpdateInput(csv, 'semicolon-csv');

    expect(entries).toHaveLength(1);
    expect(entries[0]!.recordId).toBe('1');
    expect(entries[0]!.fieldData).toEqual({ Name: 'Ada', Created: '02/10/2026' });
  });

  it('refuses a JSONL file by default and says which shape it looks like', () => {
    const jsonl = '{"recordId":"1","fieldData":{"Name":"Ada"}}\n{"recordId":"2","fieldData":{"Name":"Grace"}}\n';

    let refusal: unknown;
    try {
      parseBatchUpdateInput(jsonl, 'json');
    } catch (error) {
      refusal = error;
    }

    expect(refusal).toBeInstanceOf(BatchUpdateFormatRefusal);
    expect((refusal as BatchUpdateFormatRefusal).alternative).toBe('jsonl');
    expect((refusal as Error).message).toMatch(/looks like a JSONL file/i);
  });

  it('refuses a semicolon-delimited file by default and says which shape it looks like', () => {
    let refusal: unknown;
    try {
      parseBatchUpdateInput('recordId;Name\n1;Ada\n', 'csv');
    } catch (error) {
      refusal = error;
    }

    expect(refusal).toBeInstanceOf(BatchUpdateFormatRefusal);
    expect((refusal as BatchUpdateFormatRefusal).alternative).toBe('semicolon-csv');
    expect((refusal as Error).message).toMatch(/semicolon-delimited/i);
  });

  it('offers the semicolon shape for a file named .json that holds semicolons', () => {
    // The file's name says JSON and its contents say otherwise; the developer is asked.
    let refusal: unknown;
    try {
      parseBatchUpdateInput('recordId;Name\n1;Ada\n', 'json');
    } catch (error) {
      refusal = error;
    }

    expect(refusal).toBeInstanceOf(BatchUpdateFormatRefusal);
    expect((refusal as BatchUpdateFormatRefusal).alternative).toBe('semicolon-csv');
  });

  it('keeps a semicolon inside a comma-delimited file as the value it is', () => {
    const csv = 'recordId,Notes\n1,"one; two"\n';

    const entries = parseBatchUpdateInput(csv, 'csv');

    expect(entries[0]!.fieldData).toEqual({ Notes: 'one; two' });
  });

  it('reads a comma-delimited file when its first line names a recordId either way', () => {
    // The first line names a recordId when it is split on commas and when it is split on
    // semicolons, so the comma reading wins and the file is not offered as a semicolon file.
    const csv = 'recordId;Notes,recordId\n1,x\n';

    const entries = parseBatchUpdateInput(csv, 'csv');

    expect(entries).toHaveLength(1);
    expect(entries[0]!.fieldData['recordId;Notes']).toBe('1');
  });

  it('reads a JSONL file that ends with a newline', () => {
    // Every JSONL file ends with a newline, so the empty last line is not an entry.
    const jsonl = [
      JSON.stringify({ recordId: '1', fieldData: { Name: 'Ada' } }),
      JSON.stringify({ recordId: '2', fieldData: { Name: 'Grace' } })
    ].join('\n');

    const entries = parseBatchUpdateInput(`${jsonl}\n`, 'jsonl');

    expect(entries).toHaveLength(2);
    expect(entries[1]!.recordId).toBe('2');
  });

  it('offers the JSONL shape for a file that holds one record', () => {
    // One record is a JSONL file with a single line, and the developer is asked.
    let refusal: unknown;
    try {
      parseBatchUpdateInput('{"recordId":"1","fieldData":{"Name":"Ada"}}', 'json');
    } catch (error) {
      refusal = error;
    }

    expect(refusal).toBeInstanceOf(BatchUpdateFormatRefusal);
    expect((refusal as BatchUpdateFormatRefusal).alternative).toBe('jsonl');
    expect((refusal as Error).message).toMatch(/JSONL file with one record/i);
  });

  it('does not offer the JSONL shape for a record spread over several lines', () => {
    // A pretty-printed JSON file is a JSON file: the JSONL remedy could not succeed.
    expect(() =>
      parseBatchUpdateInput('{\n  "recordId": "1",\n  "fieldData": {}\n}', 'json')
    ).toThrow(/must be an array/);
  });

  it('reads a JSONL file that holds one record', () => {
    const entries = parseBatchUpdateInput(
      '{"recordId":"1","fieldData":{"Name":"Ada"}}\n',
      'jsonl'
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]!.fieldData).toEqual({ Name: 'Ada' });
  });

  it('names the line of a JSONL file that is not JSON', () => {
    const jsonl = [
      JSON.stringify({ recordId: '1', fieldData: { Name: 'Ada' } }),
      '{ this is not json',
      JSON.stringify({ recordId: '3', fieldData: { Name: 'Grace' } })
    ].join('\n');

    expect(() => parseBatchUpdateInput(jsonl, 'jsonl')).toThrow(/Line 2 of the JSONL file/);
  });

  it('names the line of a JSONL entry that is not a record', () => {
    const jsonl = [
      JSON.stringify({ recordId: '1', fieldData: { Name: 'Ada' } }),
      JSON.stringify({ fieldData: { Name: 'Grace' } })
    ].join('\n');

    expect(() => parseBatchUpdateInput(jsonl, 'jsonl')).toThrow(/Line 2 of the JSONL file/);
  });
});

describe('the date format the import says it uses', () => {
  it('names the order the server will read the dates in', () => {
    expect(dateFormatLabel(0)).toMatch(/server's own default/i);
    expect(dateFormatLabel(1)).toMatch(/locale/i);
    expect(dateFormatLabel(2)).toBe('ISO 8601');
  });

  it('carries a date that is not in the US order through unchanged', () => {
    // The extension does not rewrite a date: the server reads it in the order the developer
    // chose, and the preview says which order that is.
    const jsonl = JSON.stringify({
      recordId: '1',
      fieldData: { Created: '02/10/2026' }
    });

    const entries = parseBatchUpdateInput(jsonl, 'jsonl');

    expect(entries[0]!.fieldData).toEqual({ Created: '02/10/2026' });
    expect(dateFormatLabel(1)).toMatch(/locale/i);
  });
});
