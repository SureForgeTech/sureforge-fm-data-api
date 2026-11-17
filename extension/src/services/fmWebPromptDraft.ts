import type { DesignerFieldMetadata } from '../fmweb/fieldMetadata';
import { writableAppFields } from './fmWebAppModel';

export const MAX_FORM_PROMPT_LENGTH = 2000;

interface FieldConcept {
  label: string;
  phrases: string[];
  names: string[];
}

const CONCEPTS: FieldConcept[] = [
  { label: 'Attendee name', phrases: ['name', 'attendee name', 'full name', 'registrant name'],
    names: ['name', 'attendee name', 'full name', 'registrant name', 'contact name'] },
  { label: 'First name', phrases: ['first name', 'given name'], names: ['first name', 'given name', 'forename'] },
  { label: 'Last name', phrases: ['last name', 'family name', 'surname'], names: ['last name', 'family name', 'surname'] },
  { label: 'Email', phrases: ['email', 'email address', 'e mail', 'e mail address'], names: ['email', 'email address', 'e mail', 'e mail address', 'contact email', 'attendee email', 'registrant email'] },
  { label: 'Phone', phrases: ['phone', 'phone number', 'contact number', 'mobile number'], names: ['phone', 'phone number', 'contact number', 'mobile', 'mobile number', 'telephone', 'telephone number'] },
  { label: 'Session', phrases: ['session', 'session choice', 'session preference'], names: ['session', 'session choice', 'session preference', 'workshop session', 'preferred session'] },
  { label: 'Organization', phrases: ['organization', 'organisation', 'company'], names: ['organization', 'organisation', 'company', 'company name', 'organization name', 'organisation name'] },
  { label: 'Dietary requirements', phrases: ['dietary requirements', 'dietary restrictions', 'dietary needs'], names: ['dietary requirements', 'dietary restrictions', 'dietary needs', 'dietary notes'] },
  { label: 'Accessibility notes', phrases: ['accessibility notes', 'accessibility needs', 'accommodations'], names: ['accessibility notes', 'accessibility needs', 'accessibility requirements', 'accommodations'] },
  { label: 'Notes', phrases: ['notes', 'comments', 'additional notes'], names: ['notes', 'comments', 'additional notes', 'registration notes'] }
];

export interface PromptFormDraft {
  title?: string;
  fields: Array<{ field: DesignerFieldMetadata; required?: boolean }>;
  unmatched: string[];
}

/** Canonicalize for suggestions only. The returned field is always the original metadata. */
function words(value: string): string {
  return value.normalize('NFKC')
    .replace(/([\p{Lu}])([\p{Lu}][\p{Ll}])/gu, '$1 $2')
    .replace(/([\p{Ll}\d])([\p{Lu}])/gu, '$1 $2')
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

interface Mention {
  start: number;
  end: number;
  label: string;
  candidates: DesignerFieldMetadata[];
}

function qualifier(value: string): boolean | undefined {
  if (/^(?:require|required|must collect)$/.test(value)) return true;
  if (/^(?:optional|optionally)$/.test(value)) return false;
  return undefined;
}

/** Suggest existing fields from bounded registration language. Ambiguities are left for manual mapping. */
export function suggestPromptFields(prompt: string, fields: readonly DesignerFieldMetadata[]): PromptFormDraft {
  if (prompt.length > MAX_FORM_PROMPT_LENGTH) throw new Error('Describe your form in 2,000 characters or fewer.');
  const explicitTitle = /\b(?:titled|called)\s+["“]([^"”\r\n]{1,160})["”]/i.exec(prompt);
  const openingTitle = /^\s*(?:build|create|draft|make)\s+(?:(?:a|an|the)\s+)?([^.;!?\r\n]{1,160}?)\s+form\b/i.exec(prompt);
  const opening = openingTitle?.[1]?.trim();
  const title = explicitTitle?.[1]?.trim() || (opening ? opening.charAt(0).toUpperCase() + opening.slice(1) : undefined);
  const fieldPrompt = prompt.replace(explicitTitle?.[0] ?? '', '').replace(openingTitle?.[0] ?? '', '');
  const draft: PromptFormDraft = { title, fields: [], unmatched: [] };
  const writable = writableAppFields([...fields]);
  const byName = new Map<string, DesignerFieldMetadata[]>();
  for (const field of writable) {
    const name = words(field.name);
    if (!name) continue;
    const matches = byName.get(name) ?? [];
    matches.push(field);
    byName.set(name, matches);
  }
  const concepts = new Map(CONCEPTS.flatMap((concept) => [...concept.phrases, ...concept.names].map((phrase) => [phrase, concept] as const)));
  const append = (mention: Mention, required?: boolean): void => {
    const field = mention.candidates.length === 1 ? mention.candidates[0] : undefined;
    const existing = field && draft.fields.find((entry) => entry.field.name === field.name);
    if (existing) {
      if (required !== undefined) existing.required = required;
      return;
    }
    if (!field || draft.fields.length === 100) {
      if (!draft.unmatched.includes(mention.label)) draft.unmatched.push(mention.label);
      return;
    }
    draft.fields.push({ field, required });
  };

  // Keep punctuation inside explicitly quoted FileMaker names intact.
  const clauses = fieldPrompt.match(/(?:["“][^"”\r\n]*["”]|[^"“;.!?,\r\n])+|[;.!?,\r\n]/g) ?? [];
  let inherited: boolean | undefined;
  let negated: 'exclude' | 'skip' | undefined;
  let comma = false;
  for (const raw of clauses) {
    if (/^[;.!?\r\n]$/.test(raw)) {
      inherited = undefined;
      negated = undefined;
      comma = false;
      continue;
    }
    if (raw === ',') { comma = true;continue; }
    if (!raw.trim()) continue;
    const quotes: string[] = [];
    // The marker is outside the output alphabet of words(), so literal input cannot impersonate it.
    const clause = raw.split(/(["“][^"”]+["”])/g).map((part, index) => {
      if (index % 2 === 0) return words(part);
      quotes.push(part.slice(1, -1));
      return `\0${quotes.length}\0`;
    }).filter(Boolean).join(' ');
    const mentions: Mention[] = [];
    for (const [index, name] of quotes.entries()) {
      const marker = `\0${index + 1}\0`;
      const start = clause.indexOf(marker);
      const candidates = writable.filter((field) => field.name === name);
      mentions.push({ start, end: start + marker.length, label: name, candidates });
    }
    // Pick the longest phrase at each position. A narrower match such as "notes" cannot steal "accessibility notes".
    const tokens = clause.split(' ');
    let start = 0;
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index]!;
      if (mentions.some((mention) => mention.start === start)) { start += token.length + 1;continue; }
      let phrase = token;
      let match: Mention | undefined;
      for (let end = index; end < tokens.length && end < index + 12; end++) {
        if (end > index) phrase += ' ' + tokens[end]!;
        const concept = concepts.get(phrase);
        const exact = byName.get(phrase);
        if (concept || exact) {
          const candidates = concept
            ? [...new Set(concept.names.flatMap((name) => byName.get(name) ?? []))]
            : exact!;
          match = { start, end: start + phrase.length, label: concept?.label ?? exact![0]!.name, candidates };
        }
      }
      if (match) mentions.push(match);
      start += token.length + 1;
    }
    mentions.sort((left, right) => left.start - right.start || right.end - left.end);
    let previousEnd = 0;
    for (const [index, mention] of mentions.entries()) {
      if (mention.start < previousEnd) continue;
      const before = clause.slice(previousEnd, mention.start).trim();
      const after = clause.slice(mention.end, mentions.slice(index + 1).find((next) => next.start >= mention.end)?.start).trim();
      const isContinuation = /^and$/.test(before) || (comma && !before);
      // Negation continues through "or collect" and ends at an explicit positive instruction.
      const directives = /\b(?:(do not|don t|dont|never)(?:\s+(include|add|collect|require|ask for))?|(exclude|omit|without|skip|no(?: need for)?)|(or\s+)?(?:but|include|add|collect|require|ask for))\b/g;
      for (const directive of before.matchAll(directives)) {
        if (directive[1] || directive[3]) negated = directive[2] === 'require' ? 'skip' : 'exclude';
        else if (!directive[4]) negated = undefined;
      }
      const prefix = /\b(require|required|must collect|optional|optionally)\s*(?:(?:an?|the)\s*)?$/.exec(before)?.[1];
      const suffix = /^(?:is|are|as) (required|optional)\b/.exec(after)?.[1];
      const requirement = qualifier(prefix ?? suffix ?? '');
      if (!negated) {
        append(mention, requirement ?? (isContinuation ? inherited : undefined));
      } else if (negated === 'exclude') {
        if (mention.candidates.length === 1) {
          const name = mention.candidates[0]!.name;
          draft.fields = draft.fields.filter(({ field }) => field.name !== name);
        }
        draft.unmatched = draft.unmatched.filter((label) => label !== mention.label);
      }
      previousEnd = mention.end;
      comma = false;
      // Only a forward-scoped list requirement carries to the next coordinated item.
      if (negated || requirement === false || (!isContinuation && !prefix)) inherited = undefined;
      else if (prefix) inherited = requirement;
    }
  }
  return draft;
}
