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

/** A requirement word, and whether the prompt negated it. "not required" means optional. */
function qualifier(value: string, negated = false): boolean | undefined {
  if (/^(?:require|required|must collect)$/.test(value)) return !negated;
  if (/^(?:optional|optionally)$/.test(value)) return negated;
  return undefined;
}

/** Suggest existing fields from bounded registration language. Ambiguities are left for manual mapping. */
export function suggestPromptFields(prompt: string, fields: readonly DesignerFieldMetadata[]): PromptFormDraft {
  if (prompt.length > MAX_FORM_PROMPT_LENGTH) throw new Error('Describe your form in 2,000 characters or fewer.');
  const explicitTitle = /\b(?:titled|called)\s+["“]([^"”\r\n]{1,160})["”]/i.exec(prompt);
  // The captured descriptor must not be the article itself, so "Make a form." has no title rather than "A".
  const openingTitle = /^\s*(?:build|create|draft|make)\s+(?:(?:a|an|the)\s+)?((?!(?:a|an|the)\s+form\b)[^.;!?\r\n]{1,160}?)\s+form\b/i.exec(prompt);
  const opening = openingTitle?.[1]?.trim();
  const title = explicitTitle?.[1]?.trim() || (opening ? opening.charAt(0).toUpperCase() + opening.slice(1) : undefined);
  // The opening title stays in the field prompt: "Make a name and email form." names two fields as well as a
  // title, and dropping it would lose them. An explicitly quoted title is a title, so it is removed.
  const fieldPrompt = prompt.replace(explicitTitle?.[0] ?? '', '');
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
  const append = (mention: Mention, required?: boolean): PromptFormDraft['fields'][number] | undefined => {
    const field = mention.candidates.length === 1 ? mention.candidates[0] : undefined;
    const existing = field && draft.fields.find((entry) => entry.field.name === field.name);
    if (existing) {
      if (required !== undefined) existing.required = required;
      return existing;
    }
    if (!field || draft.fields.length === 100) {
      if (!draft.unmatched.includes(mention.label)) draft.unmatched.push(mention.label);
      return undefined;
    }
    const entry = { field, required };
    draft.fields.push(entry);
    return entry;
  };

  // Keep punctuation inside explicitly quoted FileMaker names intact. The closing quote is optional so an
  // unterminated quote stays in its clause instead of splitting it and losing the instruction before it.
  const clauses = fieldPrompt.match(/(?:["“][^"”\r\n]*["”]?|[^"“;.!?,\r\n])+|[;.!?,\r\n]/g) ?? [];
  let inherited: boolean | undefined;
  let negated: 'exclude' | 'optional' | undefined;
  // A coordinated item ("and notes", ", notes") inherits the polarity of the list's anchor. The anchor starts
  // as the list head and moves to a clause that ends positive, so a negation inside the list does not swallow
  // a later coordinated request, while an explicit reversal ("but include ...") carries the items after it.
  let anchorNegated: 'exclude' | 'optional' | undefined;
  // The coordinated chain being read, so that a requirement stated at the end of the chain can reach
  // the fields before it. The fields are held by reference, so removing one of them from the draft
  // cannot shift the others.
  let chain: { members: PromptFormDraft['fields'][number][]; coordinated: boolean } = { members: [], coordinated: false };
  let headPending = true;
  let comma = false;
  for (const raw of clauses) {
    if (/^[;.!?\r\n]$/.test(raw)) {
      inherited = undefined;
      negated = undefined;
      comma = false;
      anchorNegated = undefined;
      chain = { members: [], coordinated: false };
      headPending = true;
      continue;
    }
    if (raw === ',') { comma = true;continue; }
    if (!raw.trim()) continue;
    // A clause after the head starts from the anchor's polarity; its own directives then adjust it.
    if (!headPending) negated = anchorNegated;
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
      // A bare "not" negates a field ("include email but not phone"). It does not negate a requirement
      // ("not required", "not strictly required") and it is not an emphatic inclusion ("not only", "not just").
      const directives = /\b(?:(do not|don t|dont|never|not(?!\s+(?:only|just|merely|simply)\b)(?!\s+(?:\w+\s+)?(?:required|optional)\b))(?:\s+(includ(?:e|es|ed|ing)|add(?:s|ed|ing)?|collect(?:s|ed|ing)?|requir(?:e|es|ing)|ask(?:s|ed|ing)? for))?|(exclud(?:e|es|ed|ing)|omit(?:s|ted|ting)?|without|skip(?:s|ped|ping)?|no(?: need for)?|leaving out|except)|(or\s+)?(but|includ(?:e|es|ed|ing)|add(?:s|ed|ing)?|collect(?:s|ed|ing)?|requir(?:e|es|ing)|ask(?:s|ed|ing)? for))\b/g;
      for (const directive of before.matchAll(directives)) {
        if (directive[1] || directive[3]) {
          negated = directive[2] === 'require' ? 'optional' : 'exclude';
        } else if (directive[4] && negated && directive[5] !== 'but') {
          negated = directive[5] === 'require' ? 'optional' : 'exclude';
        } else {
          negated = undefined;
        }
      }
      // The head clause's own polarity starts the list's anchor.
      if (headPending) { anchorNegated = negated; headPending = false; }
      const prefix = /\b(not\s+(?:\w+\s+)?)?(require|required|must collect|optional|optionally)\s*(?:(?:an?|the)\s*)?$/.exec(before);
      const suffix = /^((?:is|are|as)\s+)?(not\s+(?:\w+\s+)?)?(required|optional)\b/.exec(after);
      const requirement = prefix ? qualifier(prefix[2] ?? '', Boolean(prefix[1]))
        : suffix ? qualifier(suffix[3] ?? '', Boolean(suffix[2])) : undefined;
      // A requirement stated after the list states the rule for its subject. The subject decides how far the
      // requirement reaches: a plural copula ("Name and email are required.") names the whole list, a bare
      // word ("email and phone required") names the coordinated phrase before it, and a negation ("notes not
      // required") or a singular copula ("phone is required") names one field.
      const copula = !prefix && suffix !== null ? suffix[1] : undefined;
      const singular = copula !== undefined && /^(?:is|as)\s/.test(copula);
      const negatedQualifier = !prefix && suffix !== null && Boolean(suffix[2]);
      const trailing = !prefix && suffix !== null && requirement !== undefined && !negatedQualifier && !singular;
      if (!negated) {
        const entry = append(mention, requirement ?? (isContinuation ? inherited : undefined));
        if (entry) {
          // The coordinated chain: the fields joined by "and" or "as well as", and the fields of a plain
          // comma-separated list ("name, email, and phone"). An explicit coordinator completes a phrase, so
          // a comma after one starts a new phrase instead of extending it.
          const coordinated = /^and$/.test(before) || /^as well as$/.test(before);
          const joinsChain = coordinated || (comma && !before && !chain.coordinated);
          if (!joinsChain) chain = { members: [], coordinated: false };
          chain.members.push(entry);
          if (coordinated) chain.coordinated = true;
          if (trailing) {
            for (const member of chain.members) {
              if (member.required === undefined) member.required = requirement;
            }
          }
        }
      } else if (negated === 'exclude') {
        // An excluded field ends the coordinated phrase it belonged to.
        chain = { members: [], coordinated: false };
        if (mention.candidates.length === 1) {
          const name = mention.candidates[0]!.name;
          draft.fields = draft.fields.filter(({ field }) => field.name !== name);
        }
        draft.unmatched = draft.unmatched.filter((label) => label !== mention.label);
      } else {
        // "Do not require phone" states that phone is not required, so the field belongs to the
        // form as an optional one. That is the same reading the adjective form gives ("not
        // required phone"), and the field was dropped before, so the request disappeared.
        append(mention, false);
      }
      previousEnd = mention.end;
      comma = false;
      // Only a forward-scoped list requirement carries to the next coordinated item. An exclusion says nothing
      // about how mandatory the rest of the list is, so it does not end the requirement scope: "Require email,
      // don't include phone, and notes." keeps notes with the required head of the list.
      if (!negated) {
        if (requirement === false || (!isContinuation && !prefix)) inherited = undefined;
        else if (prefix) inherited = requirement;
      }
    }
    // A clause that ends positive becomes the anchor for the items coordinated with it.
    if (negated === undefined) anchorNegated = undefined;
  }
  return draft;
}
