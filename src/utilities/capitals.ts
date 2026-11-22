// Greek written in capitals drops its accents: "ΤΟ ΦΑΓΗΤΟ", never "ΤΟ ΦΑΓΗΤΌ" (row 47 live
// check). The style `textTransform: 'uppercase'` keeps them, so a heading in capitals is made
// with this instead. English is unchanged apart from the capitals. The two vowels with both
// marks keep their diaeresis (ΐ becomes Ϊ), as Greek capitals do.
const WITHOUT_ACCENT: Record<string, string> = {
  ά: 'α',
  έ: 'ε',
  ή: 'η',
  ί: 'ι',
  ό: 'ο',
  ύ: 'υ',
  ώ: 'ω',
  ΐ: 'ϊ',
  ΰ: 'ϋ',
  Ά: 'Α',
  Έ: 'Ε',
  Ή: 'Η',
  Ί: 'Ι',
  Ό: 'Ο',
  Ύ: 'Υ',
  Ώ: 'Ω',
};

/** The text in capitals, with Greek accents dropped. */
export const capitals = (text: string): string =>
  text
    .replace(/[άέήίόύώΐΰΆΈΉΊΌΎΏ]/g, letter => WITHOUT_ACCENT[letter])
    .toUpperCase();
