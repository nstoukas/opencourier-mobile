import givenNamesFile from './given-names.json';

// Spec 0053 (AC-4): notes describe the place, never the person. A copy of the backend's check
// (opencourier-backend src/domains/location-note/personal-data-check.ts): before a note is sent, the
// app looks for a phone number, an email address or a common first name, and asks the rider to edit
// it or save it anyway. The server runs the same check, so a phone with an old copy still gets the
// warning, as a 422. Keep the two the same; the name list itself is copied from the backend by
// scripts/copyGivenNames.js.

export type PersonalDataKind = 'phone' | 'email' | 'name';

// 8 or more digits, with up to 3 spaces, dashes or dots between any two and an optional leading +
// (row 82 review: "694 - 123 - 4567" and double spaces are how people type numbers too).
const PHONE_PATTERN = /\+?\d(?:[\s.-]{0,3}\d){7,}/;

// Something@something.something, the shape of any email address.
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;

// The names, already folded (lower case, no accents, every sigma as σ) in the file.
const GIVEN_NAMES: ReadonlySet<string> = new Set(givenNamesFile.names);

// Greek letters with an accent or diaeresis, and the plain letter each folds to. Spelled out because
// not every phone's JavaScript engine can split letters from their accents (normalize).
const GREEK_ACCENTS: Record<string, string> = {
  ά: 'α',
  έ: 'ε',
  ή: 'η',
  ί: 'ι',
  ϊ: 'ι',
  ΐ: 'ι',
  ό: 'ο',
  ύ: 'υ',
  ϋ: 'υ',
  ΰ: 'υ',
  ώ: 'ω',
  ς: 'σ',
};

// Lower case, accents removed, final sigma as σ: "Γιώργος" and "ΓΙΩΡΓΟΣ" both become "γιωργοσ".
export const foldForNameCheck = (text: string): string => {
  const lower = text.toLowerCase();
  // NFD splits a Latin letter from its accent (é into e and the accent mark); the marks are dropped.
  const withoutMarks =
    typeof lower.normalize === 'function'
      ? lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      : lower;
  return Array.from(
    withoutMarks,
    letter => GREEK_ACCENTS[letter] ?? letter,
  ).join('');
};

// The words of the folded text: runs of Latin or Greek letters.
const wordsOf = (text: string): string[] =>
  foldForNameCheck(text)
    .split(/[^a-z\u03b1-\u03c9]+/)
    .filter(Boolean);

// Every kind found, in a fixed order; an empty list means the note looks fine.
export const findPersonalData = (text: string): PersonalDataKind[] => {
  const found: PersonalDataKind[] = [];
  if (PHONE_PATTERN.test(text)) {
    found.push('phone');
  }
  if (EMAIL_PATTERN.test(text)) {
    found.push('email');
  }
  if (wordsOf(text).some(word => GIVEN_NAMES.has(word))) {
    found.push('name');
  }
  return found;
};

export const looksLikePersonalData = (text: string): boolean =>
  findPersonalData(text).length > 0;
