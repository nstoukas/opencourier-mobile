import { capitals } from './capitals';

describe('capitals utility (spec 0054, row 47 live check: Greek headings in capitals drop accents)', () => {
  it('uppercases plain English text without modifying non-accent characters', () => {
    expect(capitals('Customer')).toBe('CUSTOMER');
    expect(capitals('Restaurant')).toBe('RESTAURANT');
    expect(capitals('Souvlaki Bar · picked up 14:41')).toBe(
      'SOUVLAKI BAR · PICKED UP 14:41',
    );
  });

  it('drops Greek accents in uppercase: "ΤΟ ΦΑΓΗΤΟ", not "ΤΟ ΦΑΓΗΤΌ"', () => {
    expect(capitals('Το φαγητό')).toBe('ΤΟ ΦΑΓΗΤΟ');
    expect(capitals('ΤΟ ΦΑΓΗΤΌ')).toBe('ΤΟ ΦΑΓΗΤΟ');
  });

  it('drops accents for every Greek accented vowel (lowercase and uppercase)', () => {
    expect(capitals('ά έ ή ί ό ύ ώ')).toBe('Α Ε Η Ι Ο Υ Ω');
    expect(capitals('Ά Έ Ή Ί Ό Ύ Ώ')).toBe('Α Ε Η Ι Ο Υ Ω');
    expect(capitals('Άφιξη')).toBe('ΑΦΙΞΗ');
    expect(capitals('Έτοιμο')).toBe('ΕΤΟΙΜΟ');
    expect(capitals('Ήχος')).toBe('ΗΧΟΣ');
    expect(capitals('Ίσως')).toBe('ΙΣΩΣ');
    expect(capitals('Όνομα')).toBe('ΟΝΟΜΑ');
    expect(capitals('Ύψος')).toBe('ΥΨΟΣ');
    expect(capitals('Ώρα')).toBe('ΩΡΑ');
  });

  it('preserves diaeresis for vowels with both accent and diaeresis (ΐ -> Ϊ, ΰ -> Ϋ)', () => {
    expect(capitals('ΐ')).toBe('Ϊ');
    expect(capitals('ΰ')).toBe('Ϋ');
    expect(capitals('πρωτεΐνη')).toBe('ΠΡΩΤΕΪΝΗ');
    expect(capitals('ταΐζω')).toBe('ΤΑΪΖΩ');
  });

  it('preserves numbers, punctuation and spaces', () => {
    expect(capitals('1 είδος!')).toBe('1 ΕΙΔΟΣ!');
    expect(capitals('3,50 € / χλμ.')).toBe('3,50 € / ΧΛΜ.');
  });
});
