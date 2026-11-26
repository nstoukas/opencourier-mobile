import givenNamesFile from './given-names.json';

// Spec 0053 (AC-4): notes describe the place, never the person. A copy of the backend's check
// (opencourier-backend src/domains/location-note/personal-data-check.ts): before a note is sent, the
// app looks for a phone number, an email address or a common first name, and asks the rider to edit
// it or save it anyway. The server runs the same check, so a phone with an old copy still gets the
// warning, as a 422. Keep the two the same (row 180: a test runs both on the same texts and expects
// the same answer); the name list itself is copied from the backend by scripts/copyGivenNames.js.

export type PersonalDataKind = 'phone' | 'email' | 'name';

// 8 or more digits, with up to 3 spaces, dashes or dots between any two and an optional leading +
// (row 82 review: "694 - 123 - 4567" and double spaces are how people type numbers too).
const PHONE_PATTERN = /\+?\d(?:[\s.-]{0,3}\d){7,}/;

// Something@something.something, the shape of any email address.
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;

// The names, already folded (lower case, no accents, every sigma as σ) in the file.
const GIVEN_NAMES: ReadonlySet<string> = new Set(givenNamesFile.names);

// Greek letters with an accent or diaeresis, and the plain letter each folds to. Used only on a phone
// whose JavaScript engine has no normalize, which cannot split letters from their accents.
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
// Row 180: the same steps in the same order as the backend's foldForNameCheck, so the two give the
// same answer while their Unicode tables match (the app's are fixed when it is built, the server's
// come with its Node version; both Unicode 17 on 2026-11-26). NFD splits each accented letter into the letter and its accent mark, and
// `\p{M}` (any mark, in any alphabet) drops them. Hermes cannot read `\p{...}` itself; the React
// Native Babel preset rewrites it into plain character ranges when the app is built.
export const foldForNameCheck = (text: string): string => {
  if (typeof text.normalize !== 'function') {
    // A phone with no normalize: lower case and the Greek table only.
    return Array.from(
      text.toLowerCase(),
      letter => GREEK_ACCENTS[letter] ?? letter,
    ).join('');
  }
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ς/g, 'σ');
};

// The words of the folded text: runs of letters in any alphabet (`\p{L}` is "any letter" in
// Unicode), as on the server. A name glued to a letter from another alphabet ("ømaria") is then one
// word that is not a name, on the phone and on the server alike (row 180).
const wordsOf = (text: string): string[] =>
  foldForNameCheck(text)
    .split(/[^\p{L}]+/u)
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
